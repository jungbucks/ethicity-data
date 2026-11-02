/*
 * 규칙 기반 판정(기획서 §5, spec §5.4) — 실제 AI가 아니라 단순화한 규칙이다.
 * 장면마다 조합(필요한 데이터 묶음)이 가방에 충분히 들었는지만 본다.
 * - 일반 카드: 그 key +1. 한 카드는 그 key를 쓰는 모든 장면의 조합에 함께 센다.
 * - "?" 카드: 붙인 설명표가 맞으면 truthKey +ambiguousWeight, 틀리면 셈 없이 mislabeled.
 *   assigned가 null(넣지 않기)·undefined(미결정)면 제출에서 빠진다.
 * - 실패 종류는 빠진 조합으로 정한다: 침수 조합(danger)이 하나라도 빠지면 'danger', 아니면 'inconvenience'.
 * - 이름표가 틀린 카드(가짜·잘못 고친 카드, spec §3.3): 조합을 채우지 않고 그 이름표를 쓰는 모든 장면에 쌓인다.
 *   한 장면에 cfg.fakeLimit장 이상이면 오염 → 실패. 쌓인 것 중 위험물이 있으면 'danger'.
 * - opts.named = 앞선 제출의 결과에서 오염 원인으로 이름이 나온 것(source 목록). 그중 하나라도 아직 가방에 있으면
 *   그 장면은 개수와 상관없이 실패(lingering). 결과에서 이름까지 본 가짜를 1장 남겨 두고 통과하는 운을 막는다. 첫 제출은 fakeLimit 그대로.
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
        C.fakeScenes(mission, card).forEach(function (sid) {
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

  function judge(mission, bag, cfg, opts) {
    var t = tally(mission, bag || [], cfg);
    var named = (opts && opts.named) || [];
    var scenes = mission.scenes.map(function (scene) {
      var missing = scene.combos.filter(function (c) {
        var have = c.keys.reduce(function (n, k) { return n + (t.counts[k] || 0); }, 0);
        return have < c.need;
      });
      var pile = t.stacked[scene.id] || [];
      var over = pile.length >= ((cfg && cfg.fakeLimit) || 2);
      var lingering = [];
      pile.forEach(function (e) { if (named.indexOf(e.source) >= 0 && lingering.indexOf(e.source) < 0) lingering.push(e.source); });
      var dirty = over || lingering.length > 0;
      // 오염 원인: 문턱을 넘었으면 쌓인 것 전부, 아니면 이름이 나왔는데 남아 있는 것만
      var cause = over ? pile : pile.filter(function (e) { return lingering.indexOf(e.source) >= 0; });
      var contaminated = [];
      cause.forEach(function (e) { if (contaminated.indexOf(e.source) < 0) contaminated.push(e.source); });
      var pass = missing.length === 0 && !dirty;
      var danger = missing.some(function (c) { return failKindOf(c) === 'danger'; }) ||
        cause.some(function (e) { return e.harm === 'danger'; });
      var failKind = pass ? null : (danger ? 'danger' : 'inconvenience');
      // 조합이 자기 결과 묘사(fail.line)를 가지면 장면 문구 대신 쓴다(같은 실패 종류일 때만)
      var own = pass ? null : missing.filter(function (c) { return c.fail && c.fail.kind === failKind; })[0];
      return {
        id: scene.id,
        pass: pass,
        failKind: failKind,
        failLine: own ? own.fail.line : null,
        missing: missing.map(function (c) { return c.id; }),
        missingHave: missing.reduce(function (o, c) { o[c.id] = c.keys.reduce(function (n, k) { return n + (t.counts[k] || 0); }, 0); return o; }, {}),
        contaminated: contaminated,
        lingering: lingering
      };
    });
    return { scenes: scenes, mislabeled: t.mislabeled, allPass: scenes.every(function (s) { return s.pass; }) };
  }

  function comboOf(mission, id) {
    for (var i = 0; i < mission.scenes.length; i++) for (var k = 0; k < mission.scenes[i].combos.length; k++) if (mission.scenes[i].combos[k].id === id) return mission.scenes[i].combos[k];
    return null;
  }
  // 받침 있으면 a, 없으면 b(이/가, 을/를)
  function josa(word, a, b) {
    var c = word.charCodeAt(word.length - 1) - 0xAC00;
    return c >= 0 && c <= 11171 && c % 28 !== 0 ? a : b;
  }
  // 빠진 조합 문구: 가진 개수가 0이면 "…없었다", 0보다 크고 모자라면 "…부족했다"(have = 화면이 보여 주는 그 개수)
  function missingLine(mission, comboId, have) {
    var c = comboOf(mission, comboId);
    if (!c) return '';
    return '우리가 넣은 데이터에는 ' + c.what + josa(c.what, '이', '가') + (have > 0 ? ' 부족했다.' : ' 없었다.');
  }

  // 이름표를 맞게 고친 카드가 있는데도 개수가 모자란 조합 → 원인은 이름표가 아니라 개수(장면 id → 문구들)
  function fixedNotes(mission, bag, result) {
    var C = cardsApi(), out = {};
    result.scenes.forEach(function (s) {
      if (s.pass) return;
      s.missing.forEach(function (id) {
        var c = comboOf(mission, id);
        var fixed = (bag || []).some(function (card) {
          return card.label !== undefined && !card.ambiguousId && card.label !== C.originalLabel(mission, card) &&
            !C.isMislabeled(mission, card) && c.keys.indexOf(C.truthKey(mission, card)) >= 0;
        });
        if (!fixed) return;
        var t = mission.cardTypes[c.keys[0]], name = (t && t.name) || c.what, have = (s.missingHave || {})[id] || 0;
        (out[s.id] = out[s.id] || []).push('이름표는 맞게 고쳤지만, ' + name + ' 사진이 ' + have + '장뿐이라 AI가 ' + name + josa(name, '을', '를') + ' 배우지 못했다.');
      });
    });
    return out;
  }

  // 빠진 조합의 결과 문구(장면 순서, 같은 문구는 한 번만) — 판정이 센 개수로 없었다/부족했다
  function missingLines(mission, result) {
    var out = [];
    result.scenes.forEach(function (s) {
      s.missing.forEach(function (id) {
        var line = missingLine(mission, id, (s.missingHave || {})[id] || 0);
        if (line && out.indexOf(line) < 0) out.push(line);
      });
    });
    return out;
  }

  // 오염 결과 문구(장면 순서, 중복 없음): 데이터에 적힌 가짜는 그 line, 플레이어가 만든 오표기는 일반 문구
  // still = 앞선 결과에서 이름이 나왔는데 아직 가방에 남아 있는 것("…사진이 아직 남아 있다")
  function contaminationLine(mission, source, still) {
    var C = cardsApi();
    if (source.indexOf('mis:') === 0) {
      var parts = source.split(':'), t = mission.cardTypes[parts[1]] || C.fakeDef(mission, parts[1]), label = C.labelText(mission, parts[2]);
      var name = (t && t.name) || parts[1];
      if (still) return '우리가 넣은 데이터에 ' + name + ' 사진이 아직 \'' + label + '\' 이름표로 남아 있다.';
      return '우리가 넣은 데이터에 ' + name + ' 사진이 \'' + label + '\'' + roJosa(label) + ' 들어갔다.';
    }
    var f = C.fakeDef(mission, source);
    if (still) return f ? '우리가 넣은 데이터에 ' + f.name + ' 사진이 아직 남아 있다.' : '';
    return (f && f.line) || '';
  }

  // '…로/으로': 받침이 없거나 ㄹ이면 '로', 그 밖의 받침이면 '으로'
  function roJosa(word) {
    var c = word.charCodeAt(word.length - 1) - 0xAC00;
    if (c < 0 || c > 11171) return '로';
    var jong = c % 28;
    return jong === 0 || jong === 8 ? '로' : '으로';
  }

  function contaminationLines(mission, result) {
    var out = [];
    result.scenes.forEach(function (s) {
      (s.contaminated || []).forEach(function (src) {
        var line = contaminationLine(mission, src, (s.lingering || []).indexOf(src) >= 0);
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

  // 4 임무 결판: 결판 장면(mission.showdownScene)의 조합이 다 찼나 — 오염은 보지 않는다(설계 §5.6, 결판 보장이 깨지지 않게)
  function readable(mission, result) {
    var id = mission.showdownScene;
    var s = id && result.scenes.filter(function (x) { return x.id === id; })[0];
    return !!(s && s.missing.length === 0);
  }

  var api = { judge: judge, readable: readable, missingLine: missingLine, fixedNotes: fixedNotes, missingLines: missingLines, shortfall: shortfall, contaminationLine: contaminationLine, contaminationLines: contaminationLines };
  root.DR = root.DR || {};
  root.DR.Judge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
