/*
 * 잡기 규칙(기획서 §4.2) — 카드는 닿기만 해선 안 들어가고 잡기를 눌러야 한다.
 * - 판정 구간: 닿기 catchLead초 전부터 닿은 뒤 catchLate초까지(넓게).
 * - 잡기 입력은 grabBuffer초 동안 들고 있다가, 그 사이 현재 레인에 잡을 카드가 생기면 잡는다
 *   (레인 이동 직전·직후에 누른 손 버릇 허용).
 * - 퍼펙트는 닿는 순간 ±perfectWindow초. 연출만 하고 판정에는 쓰지 않는다.
 */
(function (root) {
  'use strict';

  // 판정 구간은 거리로 고정한다(기준 속도 기준). 벽에 부딪혀 느려져도 구간이 줄어들지 않게 —
  // 드문 카드는 벽 바로 뒤에 있어서, 속도 비례면 부딪히는 순간 빛나던 카드를 못 잡았다.
  function reach(speed, cfg) { return Math.max(speed, cfg.baseSpeed); }

  function phase(item, runnerZ, speed, cfg) {
    var d = item.z - runnerZ, v = reach(speed, cfg);
    if (d < -v * (cfg.catchLate || 0)) return 'passed';
    return d <= v * cfg.catchLead ? 'active' : 'far';
  }

  function grabber(cfg) {
    var pressedAt = null;
    return {
      press: function (now) { pressedAt = now; },
      pending: function () { return pressedAt !== null; },
      update: function (s) {
        if (pressedAt !== null && s.now - pressedAt > cfg.grabBuffer) pressedAt = null;
        if (pressedAt === null) return null;
        if (s.bagCount >= s.bagMax) { pressedAt = null; return { full: true }; }
        var best = null;
        for (var i = 0; i < s.items.length; i++) {
          var it = s.items[i];
          if (it.kind !== 'card' || it.lane !== s.lane || s.taken.has(it.uid)) continue;
          if (phase(it, s.runnerZ, s.speed, cfg) !== 'active') continue;
          if (!best || it.z < best.z) best = it;
        }
        if (best) {
          pressedAt = null;
          return { item: best, perfect: Math.abs(best.z - s.runnerZ) <= reach(s.speed, cfg) * cfg.perfectWindow };
        }
        return null;
      }
    };
  }

  var api = { phase: phase, grabber: grabber };
  root.DR = root.DR || {};
  root.DR.Catch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
