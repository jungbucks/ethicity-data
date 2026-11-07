/*
 * 빛의 다리 겉모습 데이터(설계 docs/specs/2026-11-07-run-bridge-world-design.md). 그리는 쪽은 js/run-world.js.
 * 밤(연습·1 임무) / 낮(3 임무) 팔레트와 임무·구역별 모습(하늘 색조·다리 아래 불빛 비율·비·소품).
 * 색은 사용자가 고른 시안 2번(어두운 남색 철판, 가장 밝은 빛 = 다리 가장자리). 카드·벽과 겹치면 색은 지키고 밝기로 양보.
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
    }
  };

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
  LOOKS.m1._ = LOOKS.m1.S1; LOOKS.m3._ = LOOKS.m3.S1;

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

  var api = { PALETTE: PALETTE, look: look, contrast: contrast };
  root.DR = root.DR || {};
  root.DR.BridgeLook = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
