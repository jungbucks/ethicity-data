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
    laneMoveSec: 0.12,      // s — 레인 한 칸 옮겨 가는 시간(화면 보간, 벽 간격 계산에도 쓴다)
    wallSlow: { factor: 0.5, seconds: 1 },  // 벽·불꽃 충돌 감속
    wallPenalty: { drop: 1, pick: 'last', invuln: 0.5 },  // 벽에 부딪히면 가방에서 잃는 카드 — 장 수·고르는 법('last' 최근 / 'first' 처음)·다시 안 잃는 시간 s
    hp: 3,                  // 불꽃에 이만큼 맞으면 연결이 끊겨 그 달리기를 처음부터
    fire: { warn: 1.2, speed: 14, invuln: 1 },  // 경고 s · 날아오는 속도 m/s · 맞은 뒤 무적 s
    rareWallGapSec: [[0, 2.0], [0.4, 1.2], [0.75, 0.6]],  // [코스 진행 비율, s] — 드문 카드 앞 벽까지 시간. 그 비율부터 다음 칸 전까지(거리 = 그 지점 속도 × 초)
    bagFullRush: { speed: 1.5 },  // 가방이 차면 결승선까지 이 배수로 달린다(카드를 잃으면 원래 속도)
    finish: { gate: 3, slow: 1.2, fade: 0.8, fadeIn: 0.4, flash: 0.5, reducedFade: 0.3, skipAfter: 0.3 },  // s — 결승 게이트 보이는 구간·감속·어두워짐·다음 화면 밝아짐·HP 0 빨간 플래시·움직임 줄이기 페이드·건너뛰기 허용 시작
    swipeMin: 30,           // px
    maxDt: 0.05,            // s — 프레임 간격 상한(탭 전환 뒤 건너뛰기 방지)
    ambiguousWeight: 2,     // 올바르게 분류한 "?" 카드는 2장 몫
    fakeLimit: 2,           // 한 장면에 이름표가 틀린 카드가 이만큼 쌓이면 오염(실패)
    conveyor: { step: 1.2 }, // s — 2 임무 결과 컨베이어에서 물건 하나가 함까지 가는 시간(2배속은 절반)
    maxPixelRatio: 1.25,    // 달리기 3D 화소 비율 상한(기기 DPR이 커도 이 이상 그리지 않음). ?low=1이면 1, 계단 다듬기 끔(저사양 모드)
    maxSupplements: 2,
    supplementFreeSlots: 6,
    randomSeed: false       // true면 시작할 때마다 코스가 바뀐다
  };

  root.DR = root.DR || {};
  root.DR.config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})(typeof window !== 'undefined' ? window : globalThis);
