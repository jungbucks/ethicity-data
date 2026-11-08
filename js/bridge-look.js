/*
 * 빛의 다리 겉모습 데이터(설계 docs/specs/2026-11-07-run-bridge-world-design.md). 그리는 쪽은 js/run-world.js.
 * 밤(연습·1 임무) / 낮(3 임무) 팔레트와 임무·구역별 모습(하늘 색조·다리 아래 불빛 비율·비·소품).
 * 색은 사용자가 고른 시안 2번(어두운 남색 철판, 가장 밝은 빛 = 다리 가장자리). 카드·벽과 겹치면 색은 지키고 밝기로 양보.
 * 2차 실내 무대(설계 docs/specs/2026-11-08-run-indoor-stages-design.md): 2 임무 선별장·4 임무 채점 센터(S4 교무실) — 실제 장소 색.
 *   보라 네온은 1차 데이터 세계(다리)에만. 바닥(벨트)은 카드보다 어둡게, 창밖 = 낮 도시 그림 + 시간대 색조(window).
 */
(function (root) {
  'use strict';
  var PALETTE = {
    night: {
      deck: '#16162f', seam: '#232347', lane: '#7ff9ff', laneOpacity: 0.42, edge: '#7ff9ff', edgeOpacity: 1, side: '#0e0d24',
      fog: '#1b1340', lights: ['#ffd24a', '#7ff9ff', '#ff5fb0'], lightOpacity: 0.55, reflect: ['#ff5fb0', '#7ff9ff'], reflectOpacity: 0.1,
      wall: { opacity: 0.72, noise: ['#ffffff', '#ff5fb0', '#c2307f'] } // 노이즈 벽 원래 모습 그대로(run3d.js 벽 텍스처)
    },
    // 낮: 하늘보다 어두운 청회색 철판 — 반투명 분홍 벽(노이즈)이 묻히지 않게 대비 2.2 이상
    day: {
      deck: '#535d76', seam: '#5f6a84', lane: '#e6faff', laneOpacity: 0.5, edge: '#a6e9f0', edgeOpacity: 0.75, side: '#3a4258',
      fog: '#cfe4ef', lights: ['#ffd24a', '#a6e9f0', '#f2b8d6'], lightOpacity: 0.35, reflect: ['#f2b8d6', '#a6e9f0'], reflectOpacity: 0.08,
      // 리뷰 I1: 진분홍(#c2307f) 칸은 낮 바닥과 밝기가 거의 같다(대비 1.1) → 낮에만 밝은 분홍 칸 + 덜 투명하게
      wall: { opacity: 0.9, noise: ['#ffffff', '#ff5fb0', '#ff8fca'] }
    },
    // ---- 실내(2차). deck = 달리는 벨트, ground = 벨트 옆 바닥, fog = 먼 바닥이 그림 속 바닥선과 이어지는 색(그림 아래 3% 평균에 맞춤)
    // 선별장(밝은 오후): 어두운 초록 고무 벨트 + 롤러 이음매, 가장자리 = 안전 노랑, 옆 = 콘크리트
    sorting: {
      deck: '#1d3a2b', seam: '#2f5240', lane: '#d6dfd8', laneOpacity: 0.22, edge: '#f2c230', edgeOpacity: 0.9, side: '#4a4f55',
      ground: '#6b6457', fog: '#827466', wall: { opacity: 0.88, noise: ['#ffffff', '#ff5fb0', '#ff8fca'] }
    },
    // 채점 센터(맑은 늦은 오후): 어두운 남색 벨트(흰 답안지·흰 카드가 묻히지 않게), 가장자리 = 흰빛, 안쪽 줄 = 민트 조금
    grading: {
      deck: '#1b2840', seam: '#2a3b5a', lane: '#a8e6d6', laneOpacity: 0.28, edge: '#e8f1ff', edgeOpacity: 0.85, side: '#5b6b85',
      ground: '#6f7c93', fog: '#8495af', wall: { opacity: 0.88, noise: ['#ffffff', '#ff5fb0', '#ff8fca'] }
    },
    // 교무실(퇴근 뒤 노을): 어두운 리놀륨, 더 따뜻하고 어둡게(정체 공개·결판으로 이어지는 구역)
    office: {
      deck: '#33241e', seam: '#43312a', lane: '#e9c9a0', laneOpacity: 0.2, edge: '#f0b878', edgeOpacity: 0.7, side: '#2c211c',
      ground: '#5a4330', fog: '#866540', wall: { opacity: 0.9, noise: ['#ffffff', '#ff5fb0', '#ff8fca'] }
    }
  };
  var ART = { sorting: 'assets/title/int-sorting.webp', grading: 'assets/title/int-grading.webp', office: 'assets/title/int-teachers-office.webp' };
  var INDOOR_ART = [ART.sorting, ART.grading, ART.office];
  // 실내 모습: room = 팔레트·벽 그림, window = 창밖 낮 도시에 덮는 시간대 색조(구역마다 조금씩 — 시간이 흐르는 느낌)
  function R(id, room, window) { return { id: id, time: 'day', room: room, art: ART[room], window: window, tint: null, lightMix: [1, 0, 0], rain: false, wet: false, lanterns: false, river: false }; }

  function L(id, time, tint, mix, extra) {
    var o = { id: id, time: time, tint: tint, lightMix: mix, rain: false, wet: false, lanterns: false, river: false };
    for (var k in extra || {}) o[k] = extra[k];
    return o;
  }
  var NIGHT_RAIN = { rain: true, wet: true };
  var LOOKS = {
    tutorial: { _: L('tutorial', 'night', null, [0.4, 0.35, 0.25], NIGHT_RAIN) },
    // 1 임무 구역(우산·지갑·스마트폰): 선별장 무대가 구역마다 색이 바뀌던 신호를 하늘 색조·불빛 비율로
    m1: {
      S1: L('m1-S1', 'night', 'rgba(70,120,190,.18)', [0.25, 0.5, 0.25], NIGHT_RAIN),
      S2: L('m1-S2', 'night', 'rgba(190,140,70,.16)', [0.55, 0.2, 0.25], NIGHT_RAIN),
      S3: L('m1-S3', 'night', 'rgba(170,70,150,.16)', [0.25, 0.25, 0.5], NIGHT_RAIN)
    },
    // 3 임무 낮 다리: 시장 골목은 저녁빛(등불), 강변길은 강물, 학교 앞은 흐리고 비
    m3: {
      S1: L('m3-S1', 'day', null, [0.4, 0.4, 0.2]),
      S2: L('m3-S2', 'day', 'rgba(120,60,90,.38)', [0.6, 0.1, 0.3], { lanterns: true }),
      S3: L('m3-S3', 'day', 'rgba(120,200,255,.10)', [0.3, 0.5, 0.2], { river: true }),
      S4: L('m3-S4', 'day', 'rgba(60,70,90,.30)', [0.4, 0.4, 0.2], { rain: true, wet: true })
    }
  };
  // 2 임무 선별장: 같은 그림, 구역 신호는 분류함 색(run-scenery) — 창빛만 오후에서 늦은 오후로 조금씩
  LOOKS.m2 = {
    S1: R('m2-S1', 'sorting', 'rgba(255,244,214,.06)'),
    S2: R('m2-S2', 'sorting', 'rgba(255,236,200,.10)'),
    S3: R('m2-S3', 'sorting', 'rgba(255,226,184,.14)'),
    S4: R('m2-S4', 'sorting', 'rgba(255,214,168,.18)')
  };
  // 4 임무 채점 센터(맑은 늦은 오후) → S4 교무실(노을)
  LOOKS.m4 = {
    S1: R('m4-S1', 'grading', 'rgba(255,214,160,.12)'),
    S2: R('m4-S2', 'grading', 'rgba(255,206,150,.16)'),
    S3: R('m4-S3', 'grading', 'rgba(255,196,140,.20)'),
    S4: R('m4-S4', 'office', 'rgba(255,128,72,.30)')
  };
  LOOKS.m1._ = LOOKS.m1.S1; LOOKS.m3._ = LOOKS.m3.S1; LOOKS.m2._ = LOOKS.m2.S1; LOOKS.m4._ = LOOKS.m4.S1;
  // 분류함: 카드 테두리와 같은 색상(의도된 단서 "이 카드는 이 함으로")은 지키고 밝기만 낮춰 카드와 겹쳐 보이지 않게
  function dimBin(hex, k) {
    k = k == null ? 0.72 : k;
    var n = parseInt(hex.slice(1), 16);
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { return Math.round(v * k).toString(16).padStart(2, '0'); }).join('');
  }

  function look(missionId, zoneId) {
    var t = LOOKS[missionId];
    if (!t) return LOOKS.tutorial._;
    return t[zoneId] || t._;
  }

  function lum(hex) {
    var n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  var api = { PALETTE: PALETTE, look: look, contrast: contrast, dimBin: dimBin, INDOOR_ART: INDOOR_ART };
  root.DR = root.DR || {};
  root.DR.BridgeLook = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
