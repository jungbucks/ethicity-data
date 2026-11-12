/*
 * 결승 "도착" 표지판(2026-11-12 사용자 결정 — Rising Banner를 three.js 장면 안에서, DOM 막 아님).
 * 결승선을 지나면('arrive'만) 러너가 멈출 자리 앞 길 아래에서 표지판이 솟아올라 작게 튕기고 선다(ease-out-back,
 * config.finish.bannerRise초) → 그 뒤는 예전 그대로(어두워짐 "도착 · 가방 n/m" → 다음 화면).
 * - HP 0('knockout')은 표지판 없음(예전 그대로).
 * - 움직임 줄이기: 솟거나 튕기지 않고 처음부터 제자리.
 * - 모양: 판 하나(PlaneGeometry) + 캔버스 텍스처(위쪽 = 결승 게이트와 같은 체크무늬·남색 칸·노랑 "도착", 아래쪽 = 시안 기둥 둘).
 *   길 높이(y = 0) 아래는 잘라 낸다(clipping plane) — 그래서 길 아래에서 "솟는" 것처럼 보이고, 기둥 끝은 길 속에 SINK m 묻혀 튕길 때도 뜨지 않는다.
 * 여기는 순수 계산만(node 테스트 finish-banner.test). 그리기·장면은 run3d.js.
 */
(function (root) {
  'use strict';

  var OVERSHOOT = 1.70158;   // ease-out-back 기본값 — 끝에서 약 10% 넘었다가 돌아온다(작은 튕김)
  var SLOW_POW = 1.6;        // run3d currentSpeed의 끝맺음 감속 곡선 speed0 × (1 − t/slow)^1.6
  var LOOK_AHEAD = 16;       // run3d 카메라가 바라보는 곳(러너 앞 m)

  // 텍스처·판 크기(m). 판 윗부분 PANEL_PX가 표지판, 그 아래는 기둥
  var TEX_W = 1024, TEX_H = 720, PANEL_PX = 410;
  var W = 6.0, H = W * TEX_H / TEX_W, PANEL_H = H * PANEL_PX / TEX_H;
  var SINK = 0.5;            // 다 선 뒤 기둥이 길 속에 묻힌 깊이(m) — 튕김(이동 거리 × 약 10%)보다 커야 기둥 끝이 뜨지 않는다

  function shows(kind) { return kind === 'arrive'; }

  function easeOutBack(p) {
    if (!(p > 0)) return 0;
    if (p >= 1) return 1;
    var q = p - 1;
    return 1 + (OVERSHOOT + 1) * q * q * q + OVERSHOOT * q * q;
  }

  // 솟은 정도: 0 = 길 아래에 다 숨음, 1 = 제자리(잠깐 1을 넘는 게 튕김). 움직임 줄이기 = 처음부터 1
  function rise(t, sec, reduced) {
    if (reduced || !(sec > 0)) return 1;
    return easeOutBack(t / sec);
  }

  // 판 밑변 높이(y, m): 숨음 −H(윗변이 길 높이) → 제자리 −SINK
  function bottomAt(r) { return -H + (H - SINK) * r; }

  // 끝맺음 감속 동안 더 가는 거리 = ∫ speed0 (1 − t/slow)^1.6 dt = speed0 × slow / 2.6
  function stopDistance(speed0, slow) { return slow > 0 ? speed0 * slow / (SLOW_POW + 1) : 0; }

  // 표지판 자리(코스 z): 러너가 멈출 자리 + ahead m 앞
  function placeZ(z0, speed0, slow, ahead) { return z0 + stopDistance(speed0, slow) + ahead; }

  // 화면 가로 가운데에 오는 x: 카메라(x = camX)가 러너 앞 LOOK_AHEAD m의 camX × 0.5를 본다(run3d animate) —
  // 멈춘 뒤 카메라에서 back + ahead m 떨어진 곳의 시선 x
  function centerX(camX, back, ahead) { return camX - camX * 0.5 * (back + ahead) / (back + LOOK_AHEAD); }

  // 다 선 뒤 어두워지기 시작할 때까지 가만히 보이는 시간(s)
  function holdSec(finish) { return finish.slow - finish.bannerRise; }

  var FinishBanner = {
    OVERSHOOT: OVERSHOOT, SLOW_POW: SLOW_POW, LOOK_AHEAD: LOOK_AHEAD,
    TEX_W: TEX_W, TEX_H: TEX_H, PANEL_PX: PANEL_PX, W: W, H: H, PANEL_H: PANEL_H, SINK: SINK,
    shows: shows, easeOutBack: easeOutBack, rise: rise, bottomAt: bottomAt, stopDistance: stopDistance, placeZ: placeZ, centerX: centerX, holdSec: holdSec
  };

  root.DR = root.DR || {};
  root.DR.FinishBanner = FinishBanner;
  if (typeof module !== 'undefined' && module.exports) module.exports = FinishBanner;
})(typeof window !== 'undefined' ? window : globalThis);
