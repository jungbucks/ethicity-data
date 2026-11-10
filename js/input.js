/*
 * 입력 — 조작은 두 가지뿐(기획서 §4.2): 레인 이동(←/→, A/D, 좌우 스와이프), 잡기(Space, 탭).
 * 키 반복(꾹 누르기)은 무시한다: 누름 한 번 = 잡기 시도 한 번.
 */
(function (root) {
  'use strict';

  function classify(dx, dy, cfg) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax >= cfg.swipeMin && ax > ay) return dx > 0 ? 'right' : 'left';
    if (ax < cfg.swipeMin && ay < cfg.swipeMin) return 'tap';
    return null;
  }

  // 레인 한 칸 옮기기(끝에서 멈춤) · 출발 레인(3레인 = 가운데, 4레인 = 가운데 왼쪽). n = 임무 레인 수(DR.Stream.laneCount)
  function nextLane(lane, dir, n) { return Math.max(0, Math.min((n || 3) - 1, lane + dir)); }
  function startLane(n) { return Math.floor(((n || 3) - 1) / 2); }

  // 터치 한 번의 흐름(순수): start → move(문턱을 넘는 순간 'left'/'right' 한 번) → end('tap' | 늦게 판정된 'left'/'right' | 'done' = 이미 옮김 | null)
  //   한 번 밀기 = 한 칸(길게 밀어도 두 칸 가지 않는다) — 2026-11-10, 전엔 손가락을 뗄 때 판정해 휴대폰에서 한 박자 늦었다
  function tracker(cfg) {
    var from = null, fired = false;
    return {
      start: function (x, y) { from = { x: x, y: y }; fired = false; },
      move: function (x, y) {
        if (!from || fired) return null;
        var kind = classify(x - from.x, y - from.y, cfg);
        if (kind !== 'left' && kind !== 'right') return null;
        fired = true;
        return kind;
      },
      end: function (x, y) {
        if (!from) return null;
        var kind = fired ? 'done' : classify(x - from.x, y - from.y, cfg);
        from = null; fired = false;
        return kind;
      },
      cancel: function () { from = null; fired = false; }
    };
  }

  // handlers: { lane(dir), grab() } → unbind()
  function bind(target, handlers, cfg) {
    function onKey(e) {
      // 일시정지 메뉴·도움말 같은 다이얼로그 안의 키는 달리기 조작이 아니다(Space로 버튼을 눌러야 함)
      if (e.target && e.target.closest && e.target.closest('dialog')) return;
      var k = e.code || e.key;
      var lane = (k === 'ArrowLeft' || k === 'KeyA' || e.key === 'a' || e.key === 'A') ? -1
        : (k === 'ArrowRight' || k === 'KeyD' || e.key === 'd' || e.key === 'D') ? 1 : 0;
      var grab = k === 'Space' || e.key === ' ';
      if (!lane && !grab) return;
      e.preventDefault();
      if (e.repeat) return;
      if (lane) handlers.lane(lane); else handlers.grab();
    }
    // 스와이프는 문턱을 넘는 순간 바로(손가락을 뗄 때까지 기다리지 않는다), 탭은 뗄 때
    var tr = tracker(cfg);
    function laneOf(kind) { if (kind === 'left') handlers.lane(-1); else if (kind === 'right') handlers.lane(1); }
    function onStart(e) {
      var t = e.changedTouches[0];
      tr.start(t.clientX, t.clientY);
    }
    function onMove(e) {
      var t = e.changedTouches[0];
      laneOf(tr.move(t.clientX, t.clientY));
    }
    function onEnd(e) {
      var t = e.changedTouches[0];
      var kind = tr.end(t.clientX, t.clientY);
      if (kind === 'tap') handlers.grab(); else laneOf(kind);
      // 스크롤·확대는 CSS touch-action:none이 막는다. 취소 가능한 이벤트일 때만 클릭 합성을 막는다.
      if (kind && e.cancelable) e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    target.addEventListener('touchstart', onStart, { passive: true });
    target.addEventListener('touchmove', onMove, { passive: true });
    target.addEventListener('touchend', onEnd, { passive: false });
    target.addEventListener('touchcancel', tr.cancel, { passive: true });
    return function unbind() {
      window.removeEventListener('keydown', onKey);
      target.removeEventListener('touchstart', onStart);
      target.removeEventListener('touchmove', onMove);
      target.removeEventListener('touchend', onEnd);
      target.removeEventListener('touchcancel', tr.cancel);
    };
  }

  var api = { classify: classify, tracker: tracker, bind: bind, nextLane: nextLane, startLane: startLane };
  root.DR = root.DR || {};
  root.DR.Input = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
