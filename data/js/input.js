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
    var start = null;
    function onStart(e) {
      var t = e.changedTouches[0];
      start = { x: t.clientX, y: t.clientY };
    }
    function onEnd(e) {
      if (!start) return;
      var t = e.changedTouches[0];
      var kind = classify(t.clientX - start.x, t.clientY - start.y, cfg);
      start = null;
      if (kind === 'left') handlers.lane(-1);
      else if (kind === 'right') handlers.lane(1);
      else if (kind === 'tap') handlers.grab();
      // 스크롤·확대는 CSS touch-action:none이 막는다. 취소 가능한 이벤트일 때만 클릭 합성을 막는다.
      if (kind && e.cancelable) e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    target.addEventListener('touchstart', onStart, { passive: true });
    target.addEventListener('touchend', onEnd, { passive: false });
    return function unbind() {
      window.removeEventListener('keydown', onKey);
      target.removeEventListener('touchstart', onStart);
      target.removeEventListener('touchend', onEnd);
    };
  }

  var api = { classify: classify, bind: bind };
  root.DR = root.DR || {};
  root.DR.Input = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
