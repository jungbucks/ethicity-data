/*
 * 4 임무 결판 · 동기 합류 규칙(설계 §5.6) — 순수 모듈(node로 단위 테스트).
 * 결판에서 선배 답안을 못 읽으면 동기가 따로 모아 둔 카드(mission.peerCards: 크게 기운 1 ×2 · 표 안 답 ×2)를 내놓는다.
 *   남은 보충 2번 이상 → 'removable'(NEW로 들어옴, 뺄 수 있음 — 판단은 플레이어)
 *   남은 보충 1번(마지막)  → 'fixed'(빼기·이름표 고치기 대신 "동기와 함께 넣음")
 *   남은 보충 0번          → 'resubmit'(달리기 없이 고정으로 넣고 다시 제출 1회, 보충 횟수 밖)
 * → 어느 길로 가도 결판은 결국 "읽음"(테스트로 고정). 결판 판정은 DR.Judge.readable(결판 장면의 조합만, 오염은 보지 않음).
 */
(function (root) {
  'use strict';

  function left(state, cfg) { return Math.max(0, cfg.maxSupplements - ((state && state.supplements) || 0)); }

  function peerMode(state, cfg) {
    var n = left(state, cfg);
    return n >= 2 ? 'removable' : n === 1 ? 'fixed' : 'resubmit';
  }

  function peerId(key, i) { return 'peer_' + key + '_' + i; }

  // 동기 카드: 가방에 없는 것만 새로 만든다(돌려줌). 이미 가방에 있으면 다시 넣지 않고, fixed면 고정으로만 바꾼다
  // (고정하면서 플레이어가 바꿔 둔 이름표는 원래대로 — 고정 카드는 고칠 수 없으므로 늘 제 몫을 한다)
  function peerCards(mission, bag, fixed) {
    var out = [];
    (mission.peerCards || []).forEach(function (p) {
      for (var i = 0; i < p.n; i++) {
        var id = peerId(p.key, i), have = null;
        for (var k = 0; k < bag.length; k++) if (bag[k].id === id) { have = bag[k]; break; }
        if (have) {
          if (fixed) { have.fixed = true; delete have.label; }
          continue;
        }
        var c = { id: id, key: p.key, peer: true };
        if (fixed) c.fixed = true;
        out.push(c);
      }
    });
    return out;
  }

  // 동기가 합류할 때 보충 달리기 없이 다시 제출로 가나(플레이테스트 2026-11-18 P0-3) — 보충 준비(ui-inspect supplementPrep)와 같은 규칙:
  //   남은 보충 0번(resubmit) 또는 지금 가방 + 동기 카드로 모자란 조합이 없음. shortfall = DR.Judge.shortfall. 가방은 바꾸지 않는다(fixed 없이 셈)
  function peerNoRun(mission, state, cfg, shortfall) {
    if (peerMode(state, cfg) === 'resubmit') return true;
    var bag = (state && state.bag) || [];
    return Object.keys(shortfall(mission, bag.concat(peerCards(mission, bag, false)), cfg)).length === 0;
  }
  // 선배가 "또 지웠잖아"라고 할 만한가(P0-4): 이번 임무 검수·보충 준비에서 뺀 카드 종류(erased) 중 결판 장면 조합의 카드가 있나
  function erasedMine(mission, erased) {
    var sc = (mission.scenes || []).filter(function (s) { return s.id === mission.showdownScene; })[0], keys = [];
    if (sc) sc.combos.forEach(function (c) { keys = keys.concat(c.keys); });
    return (erased || []).some(function (k) { return keys.indexOf(k) >= 0; });
  }

  var api = { left: left, peerMode: peerMode, peerCards: peerCards, peerId: peerId, peerNoRun: peerNoRun, erasedMine: erasedMine };
  root.DR = root.DR || {};
  root.DR.Showdown = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
