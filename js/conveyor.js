/*
 * 컨베이어 실제 분류(spec §5.5) — 규칙 기반, 같은 판정이면 늘 같은 결과.
 * 물건마다 임무 데이터의 causes 중 하나라도 이번 판정에서 실제로 일어났으면 wrongBin, 아니면 맞는 함(bin).
 * 원인: 조합 id = 그 조합이 빠짐 / 가짜 id = 그 가짜가 이 물건의 장면을 오염 / 'contaminated:S#' = 그 장면이 무엇으로든 오염 /
 *       'danger:S#' = 그 장면이 '위험'으로 실패(위험 장면 = 그 장면의 건전지가 비상 정지, 결과 장면과 어긋나지 않게).
 * 그래서 빨간 물건은 늘 플레이어의 가방과 한 줄로 이어지고, 통과한 장면의 물건은 모두 맞는 함으로 간다.
 * 숫자(맞힌 개수·%)는 돌려주지 않는다.
 */
(function (root) {
  'use strict';

  function sceneOf(judged, id) {
    for (var i = 0; i < judged.scenes.length; i++) if (judged.scenes[i].id === id) return judged.scenes[i];
    return null;
  }

  // sceneId를 주면 가짜 원인은 그 장면의 오염만 본다(물건 자기 장면). 주지 않으면 어느 장면이든.
  function happened(judged, cause, sceneId) {
    if (cause.indexOf('danger:') === 0) {
      var d = sceneOf(judged, cause.slice('danger:'.length));
      return !!(d && d.failKind === 'danger');
    }
    if (cause.indexOf('contaminated:') === 0) {
      var s = sceneOf(judged, cause.slice('contaminated:'.length));
      return !!(s && s.contaminated && s.contaminated.length);
    }
    // 'any:가짜id' = 그 가짜가 어떤 이름표로든(원래 이름표 또는 플레이어가 바꾼 틀린 이름표 'mis:가짜id:…') 이 물건의 장면을 오염(4 임무)
    if (cause.indexOf('any:') === 0) {
      var fid = cause.slice('any:'.length), any = false;
      judged.scenes.forEach(function (s) {
        if (sceneId && s.id !== sceneId) return;
        (s.contaminated || []).forEach(function (src) { if (src === fid || src.indexOf('mis:' + fid + ':') === 0) any = true; });
      });
      return any;
    }
    var hit = false;
    judged.scenes.forEach(function (s) {
      if (s.missing.indexOf(cause) >= 0) hit = true;
      if ((!sceneId || s.id === sceneId) && (s.contaminated || []).indexOf(cause) >= 0) hit = true;
    });
    return hit;
  }

  function hazardous(mission, art) {
    var t = mission.cardTypes[art];
    if (t) return !!t.hazard;
    var f = (mission.fakes || []).filter(function (x) { return x.id === art; })[0];
    return !!(f && f.truth && mission.cardTypes[f.truth] && mission.cardTypes[f.truth].hazard);
  }

  // 원인의 갈래(플레이테스트 2026-11-18 P0-1): 'contam' = 가짜·옛 사진이 그 장면을 오염(가짜 id·'contaminated:'·'any:'·'mis:') /
  //   'short' = 조합이 모자람만(그 밖의 원인 — 'danger:S#'는 그 장면의 위험 실패라 어느 쪽인지는 다른 원인이 정한다). 맞으면 null.
  //   판정·맞고 틀림·cause(첫 원인)는 그대로 — 화면 문구만 이것으로 고른다
  function causeKind(mission, hits) {
    if (!hits.length) return null;
    var fakes = (mission.fakes || []).map(function (f) { return f.id; });
    var contam = hits.some(function (c) { return /^(contaminated|any|mis):/.test(c) || fakes.indexOf(c) >= 0; });
    return contam ? 'contam' : 'short';
  }

  // items를 주면 그 목록(3 임무 길 안내 질문), 아니면 mission.conveyor
  function sort(mission, judged, items) {
    return (items || mission.conveyor || []).map(function (it) {
      var hits = it.causes.filter(function (c) { return happened(judged, c, it.scene); });
      var cause = hits.length ? hits[0] : null;
      var correct = !cause;
      return {
        id: it.id, art: it.art, variant: it.variant, scene: it.scene,
        bin: correct ? it.bin : it.wrongBin, correctBin: it.bin, correct: correct, cause: cause, causeKind: causeKind(mission, hits),
        emergency: !correct && (!!it.hazard || hazardous(mission, it.art))
      };
    });
  }

  // 3 임무 길 안내 시연의 틀린 답·까닭 한 줄: 원인이 부족뿐이면 wrongShort·noteShort(있을 때), 아니면 원래 문구(P0-1)
  function guideText(g, it) {
    var short = it && !it.correct && it.causeKind === 'short';
    return { wrong: short && g.wrongShort ? g.wrongShort : g.wrong, note: short && g.noteShort ? g.noteShort : g.note };
  }
  // 장면 결과 칩 문구 열쇠: 실패했는데 오염이 없으면(모자람만) outcomeText의 '…Short'(있을 때) — 옛 사진 탓으로 읽히지 않게(P0-1)
  function outcomeKey(mission, sceneResult) {
    var r = sceneResult, k = r.pass ? 'pass' : r.failKind;
    if (!r.pass && !(r.contaminated && r.contaminated.length) && mission.outcomeText && mission.outcomeText[k + 'Short']) return k + 'Short';
    return k;
  }

  var api = { sort: sort, happened: happened, guideText: guideText, outcomeKey: outcomeKey };
  root.DR = root.DR || {};
  root.DR.Conveyor = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
