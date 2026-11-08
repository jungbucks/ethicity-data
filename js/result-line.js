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

  var out = { sceneLine: sceneLine };
  root.DR = root.DR || {};
  root.DR.ResultLine = out;
  if (typeof module !== 'undefined' && module.exports) module.exports = out;
})(typeof window !== 'undefined' ? window : globalThis);
