/*
 * 4 임무 같은 답안지 전후 비교(교사 피드백 2026-11-09) — 순수 모듈(node로 단위 테스트). 판정 규칙은 읽기만 한다.
 * snapshot(mission, judged, bag): 첫 판정 때 채점 시연 결과(DR.Conveyor.sort — 답안지마다 도장·맞았나·원인) + 실패한 장면의 빠진 조합·오염 원인
 *   + 첫 가방(최소 필드). App.state.firstGrade로 저장(선택 필드 — 옛 저장엔 없음 → 표 없음).
 * rows(mission, first, finalJudged, finalBag, cfg): 마지막 판정과 같은 답안지끼리 — 결과가 바뀐 답안지(changed, 채점 순서로 최대 3장),
 *   자리가 남으면 아직 틀린 답안지(still), 그리고 처음부터 맞게 채점한 답안지 1장(control, 비교용). 줄마다 처음 판정·개선 후 판정 글과
 *   "내가 바꾼 자료"(처음 판정의 원인 → 그 조합 장 수 변화, 이름표가 틀린 카드를 고침·뺌). 처음부터 다 맞았으면 firstAllOk + 빈 줄.
 * 임무가 끝난 뒤라 가짜 이름·진짜 장 수를 말해도 된다(결과 화면이 이미 오염 원인을 이름으로 말함).
 */
(function (root) {
  'use strict';

  function api(name, file) {
    if (root.DR && root.DR[name]) return root.DR[name];
    return require(file);
  }
  var KEEP = ['id', 'key', 'fakeId', 'ambiguousId', 'label', 'assigned', 'peer', 'fixed', 'privateId', 'masked'];
  function slim(card) {
    var o = {};
    KEEP.forEach(function (k) { if (card[k] !== undefined) o[k] = card[k]; });
    return o;
  }

  function snapshot(mission, judged, bag) {
    var Conv = api('Conveyor', './conveyor.js');
    var items = Conv.sort(mission, judged, mission.grading);
    var scenes = {};
    judged.scenes.forEach(function (s) {
      if (s.pass) return;
      scenes[s.id] = { missing: s.missing.slice(), contaminated: (s.contaminated || []).slice(), failKind: s.failKind };
    });
    return {
      v: 1,
      sheets: items.map(function (it) { return { id: it.id, bin: it.bin, correct: it.correct, cause: it.cause }; }),
      scenes: scenes,
      bag: (bag || []).map(slim)
    };
  }

  function word(mission, id) { return api('Cards', './cards.js').labelShort(mission, id); }
  // 답안지에 실제로 쓴 글(다른 표기면 'AI' (= 인공지능)) — ui-grade.js와 같은 규칙
  function wrote(mission, g) {
    var t = mission.cardTypes[g.art], w = t && t.art && t.art.word, l = word(mission, g.chose);
    return w && w !== l ? "'" + w + "' (= " + l + ')' : l;
  }
  function verdictText(mission, g, it) {
    var J = api('Josa', './josa.js');
    if (it.bin === 'hold') return '사람 채점 · 못 읽음';
    if (it.bin === 'x' && it.correct) return '✕ 정말 틀린 답';
    var read = it.correct ? g.chose : g.read;
    return (it.bin === 'o' ? '○ ' : '✕ ') + J.attach(word(mission, read), '으로') + ' 읽음';
  }

  function comboOf(mission, id) {
    for (var i = 0; i < mission.scenes.length; i++) for (var k = 0; k < mission.scenes[i].combos.length; k++) if (mission.scenes[i].combos[k].id === id) return mission.scenes[i].combos[k];
    return null;
  }

  function comboChange(mission, cfg, first, finalBag, id) {
    var J = api('Judge', './judge.js'), C = api('Cards', './cards.js'), c = comboOf(mission, id);
    var before = J.comboHave(mission, first.bag, cfg, id), after = J.comboHave(mission, finalBag, cfg, id);
    if (before === after) return null;
    var peer = finalBag.filter(function (card) { return card.peer && c.keys.indexOf(card.key) >= 0; }).length;
    return C.comboName(mission, c) + ' ' + before + '장 → ' + after + '장' + (peer ? '(동기 카드 ' + peer + '장)' : '');
  }

  function sourceChange(mission, first, finalBag, src) {
    var C = api('Cards', './cards.js');
    var cards = first.bag.filter(function (card) { return !card.ambiguousId && C.isMislabeled(mission, card) && C.sourceId(mission, card) === src; });
    if (!cards.length) return null;
    var byId = {};
    finalBag.forEach(function (card) { byId[card.id] = card; });
    var fixed = 0, removed = 0, kept = 0;
    cards.forEach(function (card) {
      var now = byId[card.id];
      if (!now) removed++;
      else if (C.isMislabeled(mission, now)) kept++;
      else fixed++;
    });
    if (!fixed && !removed) return null;
    var name, label;
    if (src.indexOf('mis:') === 0) {
      var parts = src.split(':'), f = C.fakeDef(mission, parts[1]), t = mission.cardTypes[parts[1]];
      name = (f && f.name) || (t && t.name) || parts[1]; label = word(mission, parts[2]);
    } else {
      var fd = C.fakeDef(mission, src);
      name = fd ? fd.name : src; label = fd ? word(mission, fd.label) : '';
    }
    var what = [];
    if (fixed) what.push('이름표 고침 ' + fixed + '장');
    if (removed) what.push('뺌 ' + removed + '장');
    if (kept) what.push('그대로 ' + kept + '장');
    return "'" + label + "' 이름표가 붙은 " + name + ' ' + cards.length + '장 → ' + what.join(' · ');
  }

  // 처음 판정의 원인 하나 → "내가 바꾼 자료" 줄들(최대 2)
  function changesFor(mission, cfg, first, finalBag, sheet, g) {
    var cause = sheet.cause, out = [];
    function add(t) { if (t && out.indexOf(t) < 0) out.push(t); }
    var sc = first.scenes[g.scene] || { missing: [], contaminated: [] };
    if (!cause) return out;
    if (cause.indexOf('danger:') === 0 || cause.indexOf('contaminated:') === 0) {
      var s = first.scenes[cause.slice(cause.indexOf(':') + 1)] || { missing: [], contaminated: [] };
      if (cause.indexOf('danger:') === 0) s.missing.forEach(function (id) { add(comboChange(mission, cfg, first, finalBag, id)); });
      s.contaminated.forEach(function (src) { add(sourceChange(mission, first, finalBag, src)); });
    } else if (cause.indexOf('any:') === 0) {
      var fid = cause.slice(4);
      sc.contaminated.forEach(function (src) { if (src === fid || src.indexOf('mis:' + fid + ':') === 0) add(sourceChange(mission, first, finalBag, src)); });
    } else if (comboOf(mission, cause)) add(comboChange(mission, cfg, first, finalBag, cause));
    else add(sourceChange(mission, first, finalBag, cause));
    return out.slice(0, 2);
  }

  function rows(mission, first, finalJudged, finalBag, cfg) {
    if (!first || first.v !== 1 || !Array.isArray(first.sheets) || !Array.isArray(first.bag)) return null;
    var Conv = api('Conveyor', './conveyor.js');
    var after = {};
    Conv.sort(mission, finalJudged, mission.grading).forEach(function (it) { after[it.id] = it; });
    var before = {};
    first.sheets.forEach(function (s) { before[s.id] = s; });
    var firstAllOk = first.sheets.every(function (s) { return s.correct; });
    var changed = [], still = [], control = null;
    mission.grading.forEach(function (g) {
      var b = before[g.id], a = after[g.id];
      if (!b || !a) return;
      if (!b.correct && a.correct) changed.push(g);
      else if (!b.correct) still.push(g);
      else if (a.correct && !control && g.bin === 'o') control = g;
    });
    if (firstAllOk) return { firstAllOk: true, rows: [] };
    var pick = changed.slice(0, 3).map(function (g) { return { g: g, kind: 'changed' }; });
    still.slice(0, Math.max(0, 3 - pick.length)).forEach(function (g) { pick.push({ g: g, kind: 'still' }); });
    if (control) pick.push({ g: control, kind: 'control' });
    var out = pick.map(function (p) {
      var g = p.g, b = before[g.id], a = after[g.id];
      var changes = p.kind === 'control' ? ['바꿀 필요 없었음'] : changesFor(mission, cfg, first, finalBag, b, g);
      if (!changes.length) changes = [p.kind === 'still' ? '아직 바꾸지 못함' : '같은 장면 자료를 다시 정리함'];
      return { id: g.id, art: g.art, variant: g.variant, scene: g.scene, kind: p.kind, wrote: wrote(mission, g),
        before: { bin: b.bin, correct: b.correct, text: verdictText(mission, g, b) },
        after: { bin: a.bin, correct: a.correct, text: verdictText(mission, g, a) },
        changes: changes };
    });
    return { firstAllOk: false, rows: out };
  }

  var out = { snapshot: snapshot, rows: rows, verdictText: verdictText, wrote: wrote };
  root.DR = root.DR || {};
  root.DR.GradeCompare = out;
  if (typeof module !== 'undefined' && module.exports) module.exports = out;
})(typeof window !== 'undefined' ? window : globalThis);
