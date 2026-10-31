/*
 * 조정값 — 손맛·판정 수치를 한 곳에 모은다(기획서 "초기값"에서 시작, 첫 팀 플레이 뒤 조정).
 * 실제 AI 성능 모형이 아니라 게임 조정값이다.
 */
(function (root) {
  'use strict';

  var config = {
    baseSpeed: 16,          // m/s — 코스 z 좌표의 기준 속도
    speedRamp: 0.25,        // 코스 끝까지 최대 +25%
    laneWidth: 2.4,         // m
    catchLead: 0.7,         // s — 닿기 이만큼 전부터 잡을 수 있다(판정 구간)
    catchLate: 0.12,        // s — 닿은 직후에도 이만큼은 잡힌다(닿는 순간 누르는 손 버릇)
    perfectWindow: 0.08,    // s — 닿는 순간 ± 이 안이면 퍼펙트(연출만)
    grabBuffer: 0.15,       // s — 잡기 입력을 이만큼 들고 있는다(레인 이동 직전·직후 허용)
    wallSlow: { factor: 0.5, seconds: 1 },  // 벽·불꽃 충돌 감속
    hp: 3,                  // 불꽃에 이만큼 맞으면 연결이 끊겨 그 달리기를 처음부터
    fire: { warn: 1.2, speed: 14, invuln: 1 },  // 경고 s · 날아오는 속도 m/s · 맞은 뒤 무적 s
    rareWallGap: 6,         // m — 드문 카드 앞 벽까지 최대 거리
    swipeMin: 30,           // px
    maxDt: 0.05,            // s — 프레임 간격 상한(탭 전환 뒤 건너뛰기 방지)
    ambiguousWeight: 2,     // 올바르게 분류한 "?" 카드는 2장 몫
    fakeLimit: 2,           // 한 장면에 이름표가 틀린 카드가 이만큼 쌓이면 오염(실패)
    maxSupplements: 2,
    supplementFreeSlots: 6,
    randomSeed: false       // true면 시작할 때마다 코스가 바뀐다
  };

  root.DR = root.DR || {};
  root.DR.config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})(typeof window !== 'undefined' ? window : globalThis);
