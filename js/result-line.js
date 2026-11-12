/*
 * 장면 결과 문구(플레이테스트 2) — 장면마다 고정 문장이 아니라 **실제로 실패한 원인** 기준으로 고른다. 판정은 DR.Judge 그대로(문구만).
 *   1) 그 실패 종류를 만든 빠진 조합(결정 조합)이 하나 → 그 조합의 문장(cut, 없으면 기존 fail.line)
 *   2) 결정 조합이 여럿 → 임무 틀 cutTemplate[종류]에 이름들을 "A와 B"로(조합 item, 없으면 what) — 틀이 없는 임무는 첫 조합 문장(예전 그대로)
 *   3) 빠진 조합 없이 오염만 → 원인(가짜 카드)의 cut, 없으면 임무 틀 cutTemplate.contam[종류]({what} 원인 이름, {label} 붙은 이름표)
 *   4) 아무것도 없으면 장면 cuts[종류](예전 그대로 — 4 임무처럼 데이터를 안 바꾼 임무는 문구가 같다, result-line.test)
 * 조사는 DR.Josa.fill('{what:이}')이 앞말 끝소리(숫자·영문 포함)에 맞춘다.
 */
(function (root) {
  'use strict';

  function api(name, file) {
    if (root.DR && root.DR[name]) return root.DR[name];
    return require(file);
  }
  function J() { return api('Josa', './josa.js'); }
  function C() { return api('Cards', './cards.js'); }

  // 판정과 같은 규칙(judge.js failKindOf): 조합이 빠졌을 때의 실패 종류
  function failKindOf(c) { return c.fail ? c.fail.kind : (c.danger ? 'danger' : 'inconvenience'); }
  function ownLine(c, kind) {
    if (typeof c.cut === 'string') return c.cut;
    if (c.cut && c.cut[kind]) return c.cut[kind];
    return c.fail && c.fail.kind === kind ? c.fail.line : null;
  }
  function itemName(c) { return c.item || c.what; }
  function tpl(mission, path) {
    var t = mission.cutTemplate;
    for (var i = 0; t && i < path.length; i++) t = t[path[i]];
    return typeof t === 'string' ? t : null;
  }

  // 오염 원인(source = 가짜 id 또는 'mis:종류나가짜:이름표') → { name, label, harm, cut }
  function sourceInfo(mission, src) {
    var parts = String(src).split(':'), mis = parts[0] === 'mis', id = mis ? parts[1] : src;
    var f = C().fakeDef(mission, id), t = mission.cardTypes[f ? f.truth : id];
    var harm = (f && f.harm) || (t && t.hazard ? 'danger' : 'inconvenience');
    var label = mis ? parts[2] : (f && f.label);
    return { name: (f && f.name) || (mission.cardTypes[id] && mission.cardTypes[id].name) || id, label: label ? C().labelText(mission, label) : '', harm: harm,
      cut: !mis && f && f.cut ? f.cut : null };
  }

  function sceneLine(mission, scene, r) {
    if (r.pass) return scene.passLine;
    var kind = r.failKind;
    var combos = {};
    scene.combos.forEach(function (c) { combos[c.id] = c; });
    var decisive = (r.missing || []).map(function (id) { return combos[id]; }).filter(function (c) { return c && failKindOf(c) === kind; });
    if (decisive.length === 1) {
      var own = ownLine(decisive[0], kind);
      if (own) return own;
    }
    if (decisive.length) {
      var many = tpl(mission, [kind]);
      if (many) return J().fill(many, { what: decisive.map(itemName) });
      var first = ownLine(decisive[0], kind);
      if (first) return first;
    }
    // 빠진 조합이 아니라 섞인 사진 때문에 실패(그 종류의 위험을 만든 원인부터)
    var srcs = (r.contaminated || []).map(function (s) { return sourceInfo(mission, s); })
      .filter(function (s) { return kind !== 'danger' || s.harm === 'danger'; });
    if (srcs.length) {
      var s0 = srcs[0];
      if (s0.cut) return s0.cut;
      var ct = tpl(mission, ['contam', kind]);
      if (ct) return J().fill(ct, { what: s0.name, label: s0.label });
    }
    return (scene.cuts && scene.cuts[kind]) || '';
  }

  /* ---------- 컨베이어에서 잘못 간 물건까지 덮는 문구(2 임무, 플레이테스트 2026-11-12) ----------
   * 전엔 장면 문구가 원인 하나(칫솔)만 말해, 아래 '컨베이어에서 잘못 간 물건' 목록(투명 페트병 → 비닐 함, 비닐봉지 → 일반쓰레기 함)과 안 맞았다.
   * wrong = DR.Conveyor.sort 결과 중 이 장면에서 틀린 함으로 간 물건들. 임무 틀(cutTemplate.wrongAll·wrongRest·because·also)이 있는 임무만 — 없으면 예전 그대로. */
  function artName(mission, art) {
    var t = mission.cardTypes[art], f = C().fakeDef(mission, art);
    return (t && t.name) || (f && f.name) || art;
  }
  // 같은 함으로 간 물건끼리 묶는다: 'A와 B는 X 함으로, C는 Y 함으로' — p = 이름 뒤 조사('은'·'이'), '도'는 그대로 붙인다
  function binList(mission, items, p) {
    var groups = [], by = {};
    items.forEach(function (it) {
      var name = artName(mission, it.art);
      if (!by[it.bin]) { by[it.bin] = { bin: it.bin, names: [] }; groups.push(by[it.bin]); }
      if (by[it.bin].names.indexOf(name) < 0) by[it.bin].names.push(name);
    });
    return groups.map(function (g) {
      var who = J().join(g.names), bin = C().labelText(mission, g.bin) + ' ' + (mission.binWord || '함');
      return (p === '도' ? who + '도' : J().attach(who, p)) + ' ' + J().attach(bin, '으로');
    }).join(', ');
  }
  // 장면 머리 문구: 잘못 간 물건이 둘 이상이면 전부 말한다. 불편 = 목록 문장 / 위험 = 원래 위험 문구(비상 정지) + 건전지 말고 잘못 간 나머지
  function leadLine(mission, scene, r, wrong) {
    var base = sceneLine(mission, scene, r);
    wrong = wrong || [];
    if (r.pass || wrong.length < 2) return base;
    if (r.failKind === 'danger') {
      var rest = wrong.filter(function (it) { return !it.emergency; }), tr = tpl(mission, ['wrongRest']);
      return tr && rest.length ? base + ' ' + J().fill(tr, { list: binList(mission, rest, '은') }) : base;
    }
    var ta = tpl(mission, ['wrongAll']);
    return ta ? J().fill(ta, { list: binList(mission, wrong, '은') }) : base;
  }
  // 오염 원인 줄 뒤에 붙이는 '그래서 …'(그 원인 때문에 잘못 간 물건), 원인을 하나로 못 짚는 물건('contaminated:S#')은 '…도'로 한 줄
  function becauseLine(mission, items) {
    var t = tpl(mission, ['because']);
    return t && items && items.length ? J().fill(t, { list: binList(mission, items, '이') }) : '';
  }
  function alsoLine(mission, items) {
    var t = tpl(mission, ['also']);
    return t && items && items.length ? J().fill(t, { list: binList(mission, items, '도') }) : '';
  }

  var out = { sceneLine: sceneLine, leadLine: leadLine, becauseLine: becauseLine, alsoLine: alsoLine, binList: binList };
  root.DR = root.DR || {};
  root.DR.ResultLine = out;
  if (typeof module !== 'undefined' && module.exports) module.exports = out;
})(typeof window !== 'undefined' ? window : globalThis);
