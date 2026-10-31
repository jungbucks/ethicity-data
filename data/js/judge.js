/*
 * 규칙 기반 판정(기획서 §5, spec §5.4) — 실제 AI가 아니라 단순화한 규칙이다.
 * 장면마다 조합(필요한 데이터 묶음)이 가방에 충분히 들었는지만 본다.
 * - 일반 카드: 그 key +1. 한 카드는 그 key를 쓰는 모든 장면의 조합에 함께 센다.
 * - "?" 카드: 붙인 설명표가 맞으면 truthKey +ambiguousWeight, 틀리면 셈 없이 mislabeled.
 *   assigned가 null(넣지 않기)·undefined(미결정)면 제출에서 빠진다.
 * - 실패 종류는 빠진 조합으로 정한다: 침수 조합(danger)이 하나라도 빠지면 'danger', 아니면 'inconvenience'.
 * - 이름표가 틀린 카드(가짜·잘못 고친 카드, spec §3.3): 조합을 채우지 않고 그 이름표를 쓰는 모든 장면에 쌓인다.
 *   한 장면에 cfg.fakeLimit장 이상이면 오염 → 실패. 쌓인 것 중 위험물이 있으면 'danger'.
 */
(function (root) {
  'use strict';

  function cardsApi() {
    if (root.DR && root.DR.Cards) return root.DR.Cards;
    return require('./cards.js');
  }

  function tally(mission, bag, cfg) {
    var C = cardsApi();
    var counts = {}, mislabeled = [], stacked = {};
    var weight = (cfg && cfg.ambiguousWeight) || 1;
    var amb = {};
    (mission.ambiguous || []).forEach(function (a) { amb[a.id] = a; });
    bag.forEach(function (card) {
      if (card.ambiguousId) {
        if (card.assigned === null || card.assigned === undefined) return;
        var def = amb[card.ambiguousId];
        if (def && card.assigned === def.correctLabel) counts[def.truthKey] = (counts[def.truthKey] || 0) + weight;
        else mislabeled.push(card.id);
        return;
      }
      if (C.isMislabeled(mission, card)) {
        var entry = { source: C.sourceId(mission, card), harm: C.harm(mission, card) };
        C.scenesForLabel(mission, C.currentLabel(mission, card)).forEach(function (sid) {
          (stacked[sid] = stacked[sid] || []).push(entry);
        });
        return;
      }
      var k = C.truthKey(mission, card);
      counts[k] = (counts[k] || 0) + 1;
    });
    return { counts: counts, mislabeled: mislabeled, stacked: stacked };
  }

  // 조합이 빠졌을 때의 결과 종류: fail.kind가 있으면 그것(장면의 정답과 맞추려고), 없으면 침수 조합 = 위험
  function failKindOf(c) { return c.fail ? c.fail.kind : (c.danger ? 'danger' : 'inconvenience'); }

  function judge(mission, bag, cfg) {
    var t = tally(mission, bag || [], cfg);
    var scenes = mission.scenes.map(function (scene) {
      var missing = scene.combos.filter(function (c) {
        var have = c.keys.reduce(function (n, k) { return n + (t.counts[k] || 0); }, 0);
        return have < c.need;
      });
      var pile = t.stacked[scene.id] || [];
      var dirty = pile.length >= ((cfg && cfg.fakeLimit) || 2);
      var contaminated = [];
      if (dirty) pile.forEach(function (e) { if (contaminated.indexOf(e.source) < 0) contaminated.push(e.source); });
      var pass = missing.length === 0 && !dirty;
      var danger = missing.some(function (c) { return failKindOf(c) === 'danger'; }) ||
        (dirty && pile.some(function (e) { return e.harm === 'danger'; }));
      var failKind = pass ? null : (danger ? 'danger' : 'inconvenience');
      // 조합이 자기 결과 묘사(fail.line)를 가지면 장면 문구 대신 쓴다(같은 실패 종류일 때만)
      var own = pass ? null : missing.filter(function (c) { return c.fail && c.fail.kind === failKind; })[0];
      return {
        id: scene.id,
        pass: pass,
        failKind: failKind,
        failLine: own ? own.fail.line : null,
        missing: missing.map(function (c) { return c.id; }),
        contaminated: contaminated
      };
    });
    return { scenes: scenes, mislabeled: t.mislabeled, allPass: scenes.every(function (s) { return s.pass; }) };
  }

  // 빠진 조합의 결과 문구(장면 순서, 같은 문구는 한 번만)
  function missingLines(mission, result) {
    var byId = {};
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { byId[c.id] = c; }); });
    var out = [];
    result.scenes.forEach(function (s) {
      s.missing.forEach(function (id) {
        var line = byId[id] && byId[id].missingLine;
        if (line && out.indexOf(line) < 0) out.push(line);
      });
    });
    return out;
  }

  // 오염 결과 문구(장면 순서, 중복 없음): 데이터에 적힌 가짜는 그 line, 플레이어가 만든 오표기는 일반 문구
  function contaminationLine(mission, source) {
    var C = cardsApi();
    if (source.indexOf('mis:') === 0) {
      var parts = source.split(':'), t = mission.cardTypes[parts[1]];
      return '우리가 넣은 데이터에 ' + ((t && t.name) || parts[1]) + ' 사진이 \'' + C.labelText(mission, parts[2]) + '\'로 들어갔다.';
    }
    var f = C.fakeDef(mission, source);
    return (f && f.line) || '';
  }

  function contaminationLines(mission, result) {
    var out = [];
    result.scenes.forEach(function (s) {
      (s.contaminated || []).forEach(function (src) {
        var line = contaminationLine(mission, src);
        if (line && out.indexOf(line) < 0) out.push(line);
      });
    });
    return out;
  }

  // 빠진 조합을 채우려면 key마다 몇 장이 더 필요한지(보충 코스용). 여러 장면이 같은 key를 쓰면 큰 쪽.
  function shortfall(mission, bag, cfg) {
    var t = tally(mission, bag || [], cfg), out = {};
    mission.scenes.forEach(function (s) {
      s.combos.forEach(function (c) {
        var have = c.keys.reduce(function (n, k) { return n + (t.counts[k] || 0); }, 0);
        var lack = c.need - have, k0 = c.keys[0];
        if (lack > 0) out[k0] = Math.max(out[k0] || 0, lack);
      });
    });
    return out;
  }

  var api = { judge: judge, missingLines: missingLines, shortfall: shortfall, contaminationLine: contaminationLine, contaminationLines: contaminationLines };
  root.DR = root.DR || {};
  root.DR.Judge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
