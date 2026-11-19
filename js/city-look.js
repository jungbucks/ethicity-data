/*
 * 도시 복구 그림 자리 계산(순수, node 테스트 tests/city-look.test.mjs). 그리는 쪽은 js/ui-city.js + css "도시 복구".
 * 그림 city-N.webp = 1600×600(8:3), 가로로 구역 5개가 20%씩, city-N은 왼쪽 N칸만 색. 케이블은 높이 config.city.cableY.
 * 넓은 화면: 틀도 8:3 → 그림 좌표 = 틀 좌표. 좁은 화면(≤640px): 틀 4:3 + object-fit: cover → 그림 높이가 맞고
 *   가로는 틀의 2배(scale k = (8/3)/(4/3)), 보이는 건 그림의 절반. object-position x(= pos)로 새 구역이 틀 가운데쯤 오게.
 *   그림 좌표 f(0~1) → 틀 좌표 = k·f − (k−1)·pos (cover에서 밀린 만큼 뺀다).
 * 케이블 빛·열리는 칸은 그림 위 겹이라 틀 좌표로 바꿔 CSS 변수로 넘긴다(넓은·좁은 두 벌 → CSS 미디어 쿼리가 고름).
 */
(function (root) {
  'use strict';
  var ZONES = 5, ART = 8 / 3, NARROW = 4 / 3;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function center(n) { return (n - 0.5) / ZONES; }   // n번 구역 중심(그림 비율)
  function edge(n) { return n / ZONES; }              // n번 구역 오른쪽 끝(0이면 왼쪽 끝)
  function scale(narrow) { return narrow ? ART / NARROW : 1; }
  // object-position x(0~1): 보이는 폭 1/k 창을 새 구역 중심에 맞추고, 그림 밖으로 나가지 않게 자른다
  function posX(to, k) {
    if (k <= 1) return 0.5;
    var vis = 1 / k, start = clamp(center(to) - vis / 2, 0, 1 - vis);
    return start / (1 - vis);
  }
  function toBox(f, k, pos) { return k * f - (k - 1) * pos; }

  // from → to 연출 자리(틀 비율 0~1). 마지막 칸(to = 5)은 케이블 전체를 한 번 쭉
  function layout(from, to, narrow) {
    var k = scale(narrow), pos = posX(to, k), final = to >= ZONES;
    function box(f) { return clamp(toBox(f, k, pos), 0, 1); }
    return {
      pos: pos, final: final,
      cableFrom: final ? 0 : box(edge(from)), cableTo: final ? 1 : box(center(to)),
      revealFrom: box(edge(from)), revealTo: box(edge(to))
    };
  }

  function pct(v) { return Math.round(v * 100000) / 1000 + '%'; }
  // 화면에 거는 CSS 변수 — 넓은(-w)·좁은(-n) 두 벌
  function css(from, to) {
    var out = {};
    [['w', false], ['n', true]].forEach(function (s) {
      var L = layout(from, to, s[1]);
      out['--city-pos-' + s[0]] = pct(L.pos);
      out['--city-cable-left-' + s[0]] = pct(L.cableFrom);
      out['--city-cable-len-' + s[0]] = pct(L.cableTo - L.cableFrom);
      out['--city-clip-l-' + s[0]] = pct(L.revealFrom);
      out['--city-clip-r-' + s[0]] = pct(1 - L.revealTo);
    });
    return out;
  }

  /* 깬 임무 기준 구간(플레이테스트 2026-11-18 P0-2, DR.Save.citySections) — lit = 켜진 구간 번호(0~4, 새 구간 포함), add = 이번에 켜지는 구간.
   * 왼쪽부터 차례로 켜졌으면(lit = 0..add) 예전 그대로 그림 두 장(city-from → city-to, layout·css). 아니면 그림을 바꾸지 않고 겹으로:
   * 바탕 city-0(전부 흑백) 위에 켜진 구간마다 city-5(전부 색)를 그 구간 폭만 잘라 올린다(others), 새 구간 겹은 아래→위로 열린다. */
  function inOrder(lit, add) {
    if (add !== lit.length - 1) return false;
    for (var i = 0; i < lit.length; i++) if (lit[i] !== i) return false;
    return true;
  }
  function sectionLayout(lit, add, narrow) {
    var k = scale(narrow), pos = posX(add + 1, k), final = lit.length >= ZONES;
    function box(f) { return clamp(toBox(f, k, pos), 0, 1); }
    // 케이블 빛은 새 구간 왼쪽 끝 → 가운데(꺼진 구간 위로는 지나가지 않게). 다 켜지면 전체
    return {
      pos: pos, final: final,
      cableFrom: final ? 0 : box(edge(add)), cableTo: final ? 1 : box(center(add + 1)),
      revealFrom: box(edge(add)), revealTo: box(edge(add + 1)),
      others: lit.filter(function (i) { return i !== add; }).map(function (i) { return { i: i, l: box(edge(i)), r: box(edge(i + 1)) }; })
    };
  }
  // 화면 CSS 변수(css()와 같은 이름) + 켜져 있던 구간 겹마다 --sec-l/r-w·-n(others 순서)
  function sectionCss(lit, add) {
    var out = { others: [] };
    [['w', false], ['n', true]].forEach(function (s) {
      var L = sectionLayout(lit, add, s[1]);
      out['--city-pos-' + s[0]] = pct(L.pos);
      out['--city-cable-left-' + s[0]] = pct(L.cableFrom);
      out['--city-cable-len-' + s[0]] = pct(L.cableTo - L.cableFrom);
      out['--city-clip-l-' + s[0]] = pct(L.revealFrom);
      out['--city-clip-r-' + s[0]] = pct(1 - L.revealTo);
      L.others.forEach(function (o, j) {
        var v = out.others[j] = out.others[j] || { i: o.i };
        v['--sec-l-' + s[0]] = pct(o.l); v['--sec-r-' + s[0]] = pct(1 - o.r);
      });
    });
    return out;
  }

  var api = { ZONES: ZONES, center: center, edge: edge, scale: scale, posX: posX, toBox: toBox, layout: layout, css: css, inOrder: inOrder, sectionLayout: sectionLayout, sectionCss: sectionCss };
  root.DR = root.DR || {};
  root.DR.CityLook = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
