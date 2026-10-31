/*
 * 카드 그림(spec §6) — 모든 카드를 같은 방식(2D 레이어 조합)으로 코드가 그린다. 화풍이 정답 단서가 되지 않게.
 * 바탕(골목·거리·교차로·고가 아래 지상 교차로) × 시간(낮/밤) × 물(마름/젖음/얕음/깊음) × 변형(네온 반사·흙탕물·물청소).
 * 장소는 카드 종류가 아니라 변형 번호로 고른다(장소가 정답 단서가 되지 않게).
 * "?" 카드의 애매함도 같은 레이어 값으로 만든다(ambiguity:'high').
 * ⚠️ 지하차도는 그리지 않는다(기획서 §10). 'overpass'는 고가도로 아래의 지상 교차로다.
 */
(function (root) {
  'use strict';

  var cache = new Map();
  var PLACES = ['alley', 'street', 'crossing', 'overpass'];

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) { return root.DR.Rng.create(seed); }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  function cached(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  }
  function pick(r, arr) { return arr[Math.floor(r.next() * arr.length)]; }

  function artOf(mission, id) {
    if (mission.cardTypes[id]) return mission.cardTypes[id].art;
    var a = (mission.ambiguous || []).concat(mission.fakes || []).filter(function (q) { return q.id === id; })[0];
    if (!a) throw new Error('알 수 없는 카드: ' + id);
    return a.art;
  }

  /* ---------- 도로 장면(S×S 좌표, 그릴 때 size/256 배율) ---------- */
  var HZ = 0.44; // 지평선 높이 비율

  function drawSky(g, S, o, r) {
    var grd = g.createLinearGradient(0, 0, 0, S * HZ);
    if (o.time === 'night') { grd.addColorStop(0, '#0b0a26'); grd.addColorStop(1, '#2b2160'); }
    else { grd.addColorStop(0, '#7fb8ff'); grd.addColorStop(1, '#d9ecff'); }
    g.fillStyle = grd; g.fillRect(0, 0, S, S * HZ + 2);
    if (o.time === 'night') {
      g.fillStyle = 'rgba(255,255,255,.7)';
      for (var i = 0; i < 18; i++) g.fillRect(r.next() * S, r.next() * S * HZ * 0.6, 1.5, 1.5);
    }
  }

  // 건물 줄 — 장소마다 높이·간격이 다르다. 네온 간판 위치를 돌려준다.
  function drawBuildings(g, S, o, r, place) {
    var neon = [];
    var night = o.time === 'night';
    var x = -10, base = S * (HZ + 0.02);
    var tall = place === 'alley' ? 0.32 : place === 'street' ? 0.26 : 0.22;
    while (x < S) {
      var w = S * (0.08 + r.next() * 0.12), h = S * (0.08 + r.next() * tall);
      g.fillStyle = night ? pick(r, ['#1c173f', '#231c4d', '#18143a']) : pick(r, ['#b9c2d8', '#a4aec7', '#c9cfdf', '#d6c9b8']);
      g.fillRect(x, base - h, w, h);
      // 창문
      for (var wy = base - h + 6; wy < base - 8; wy += 10) for (var wx = x + 4; wx < x + w - 6; wx += 9) {
        if (r.next() < (night ? 0.45 : 0.8)) {
          g.fillStyle = night ? (r.next() < 0.8 ? '#ffd88a' : '#9fe8ff') : 'rgba(80,110,160,.55)';
          g.fillRect(wx, wy, 4, 5);
        }
      }
      if (night && (o.variant === 'neon' || place === 'crossing') && r.next() < 0.55) {
        var col = pick(r, ['#ff4fb0', '#4ff3ff', '#b46bff']);
        var ny = base - h * (0.3 + r.next() * 0.4);
        g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 10;
        g.fillRect(x + w * 0.15, ny, w * 0.7, 7);
        g.shadowBlur = 0;
        neon.push({ x: x + w * 0.5, w: w * 0.7, color: col });
      }
      x += w + S * (place === 'alley' ? 0 : r.next() * 0.03);
    }
    return neon;
  }

  function roadPoly(S, place) {
    var top = place === 'alley' ? 0.07 : 0.11, bot = place === 'alley' ? 0.38 : 0.62;
    return [[S * (0.5 - top), S * HZ], [S * (0.5 + top), S * HZ], [S * (0.5 + bot), S], [S * (0.5 - bot), S]];
  }
  function pathPoly(g, p) { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.closePath(); }

  function drawGround(g, S, o, r, place) {
    var night = o.time === 'night';
    // 보도
    g.fillStyle = night ? '#2a2744' : '#c3c0b8';
    g.fillRect(0, S * HZ, S, S * (1 - HZ));
    if (place === 'alley') {
      // 골목 담벼락
      g.fillStyle = night ? '#221d45' : '#d8cbb4';
      g.beginPath(); g.moveTo(0, S * 0.25); g.lineTo(S * 0.38, S * HZ); g.lineTo(S * 0.38, S * (HZ + 0.02)); g.lineTo(0, S * 0.9); g.fill();
      g.beginPath(); g.moveTo(S, S * 0.25); g.lineTo(S * 0.62, S * HZ); g.lineTo(S * 0.62, S * (HZ + 0.02)); g.lineTo(S, S * 0.9); g.fill();
    }
    var road = roadPoly(S, place);
    pathPoly(g, road);
    g.fillStyle = night ? '#2c2d3c' : '#6d717c';
    g.fill();
    g.strokeStyle = night ? '#4a4766' : '#e7e3d8'; g.lineWidth = 2; g.stroke();
    // 차선 표시
    g.fillStyle = night ? 'rgba(240,230,170,.55)' : 'rgba(255,255,255,.85)';
    if (place === 'crossing' || place === 'overpass') {
      for (var i = 0; i < 7; i++) {
        var y = S * (0.78 + i * 0.0), xs = S * (0.5 - 0.5 + 0.08 + i * 0.12);
        g.fillRect(xs, S * 0.8, S * 0.06, S * 0.07);
      }
    } else if (place === 'street') {
      for (var d = 0; d < 5; d++) { var t = d / 5, yy = S * (HZ + (1 - HZ) * t * t); g.fillRect(S * 0.5 - 1 - t * 2, yy, 2 + t * 4, 4 + t * 14); }
    }
    return road;
  }

  function drawOverpass(g, S, o) {
    var night = o.time === 'night';
    g.fillStyle = night ? '#141228' : '#8c919e';
    g.fillRect(0, S * 0.2, S, S * 0.09);
    g.fillStyle = night ? '#1b1838' : '#a1a6b2';
    g.fillRect(S * 0.12, S * 0.29, S * 0.05, S * 0.4);
    g.fillRect(S * 0.83, S * 0.29, S * 0.05, S * 0.4);
    // 고가 그림자 — 수위가 잘 안 보이는 이유
    g.fillStyle = night ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.22)';
    g.fillRect(0, S * HZ, S, S * 0.3);
  }

  function drawLamps(g, S, o, place) {
    if (o.time !== 'night') return [];
    var xs = place === 'alley' ? [0.3, 0.72] : [0.08, 0.92];
    return xs.map(function (fx) {
      var x = S * fx, top = S * 0.3;
      g.strokeStyle = '#3d3a5c'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, S * 0.75); g.lineTo(x, top); g.stroke();
      var grd = g.createRadialGradient(x, top, 0, x, top, S * 0.12);
      grd.addColorStop(0, 'rgba(255,220,140,.9)'); grd.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = grd; g.fillRect(x - S * 0.12, top - S * 0.12, S * 0.24, S * 0.24);
      return { x: x, color: '#ffd88a' };
    });
  }

  function drawCar(g, S, x, y, w, col) {
    g.fillStyle = col;
    g.fillRect(x, y - w * 0.28, w, w * 0.28);
    g.fillRect(x + w * 0.18, y - w * 0.46, w * 0.6, w * 0.2);
    g.fillStyle = 'rgba(160,200,255,.7)'; g.fillRect(x + w * 0.24, y - w * 0.43, w * 0.48, w * 0.13);
    g.fillStyle = '#111';
    g.beginPath(); g.arc(x + w * 0.22, y, w * 0.1, 0, 7); g.arc(x + w * 0.78, y, w * 0.1, 0, 7); g.fill();
  }

  // 반사 줄기(젖은 도로·네온) — 빛 위치 아래로 길게
  function drawReflections(g, S, lights, strength) {
    lights.forEach(function (l) {
      var grd = g.createLinearGradient(0, S * HZ, 0, S);
      grd.addColorStop(0, hexA(l.color, 0.05 * strength));
      grd.addColorStop(0.5, hexA(l.color, 0.35 * strength));
      grd.addColorStop(1, hexA(l.color, 0.12 * strength));
      g.fillStyle = grd;
      var w = (l.w || S * 0.05) * 0.6;
      g.fillRect(l.x - w / 2, S * (HZ + 0.03), w, S * (1 - HZ));
    });
  }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + Math.max(0, Math.min(1, a)) + ')';
  }

  function drawWater(g, S, o, r, road, lights) {
    var night = o.time === 'night', amb = o.ambiguity === 'high';
    var muddy = o.variant === 'muddy';
    if (o.water === 'dry') return;
    if (o.water === 'wet') {
      pathPoly(g, road);
      g.fillStyle = night ? 'rgba(10,10,30,.35)' : 'rgba(40,45,60,.28)'; g.fill();
      g.save(); pathPoly(g, road); g.clip();
      var strength = o.variant === 'neon' ? (amb ? 2.4 : 1.6) : 1;
      drawReflections(g, S, lights, strength);
      if (o.variant === 'clean') {
        // 물청소 줄무늬(청소차 바퀴 자국)
        g.fillStyle = 'rgba(30,35,50,.3)';
        for (var i = 0; i < 4; i++) g.fillRect(S * (0.3 + i * 0.12), S * HZ, S * 0.05, S);
        if (amb) { g.fillStyle = 'rgba(120,150,190,.35)'; g.beginPath(); g.ellipse(S * 0.5, S * 0.86, S * 0.3, S * 0.06, 0, 0, 7); g.fill(); }
      }
      if (!night) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(S * 0.35, S * 0.6, S * 0.3, S * 0.02); }
      g.restore();
      return;
    }
    var level = o.water === 'deep' ? 0.5 : (amb ? 0.8 : 0.72);
    var col = muddy ? (night ? '#5a4526' : '#8a6a3c') : (night ? '#1d3550' : '#6f93b8');
    var alpha = o.water === 'deep' ? 0.88 : (amb ? 0.42 : 0.62);
    g.fillStyle = hexA(col, alpha);
    g.fillRect(0, S * level, S, S * (1 - level));
    // 수면 경계선(애매하면 거의 안 보이게)
    g.fillStyle = 'rgba(255,255,255,' + (amb ? 0.08 : 0.35) + ')';
    g.fillRect(0, S * level, S, 2);
    // 물결
    g.strokeStyle = 'rgba(255,255,255,' + (amb ? 0.08 : 0.25) + ')'; g.lineWidth = 1.5;
    for (var k = 0; k < 6; k++) {
      var y = S * (level + 0.04 + r.next() * (0.94 - level)), x = r.next() * S;
      g.beginPath(); g.ellipse(x, y, S * 0.08, S * 0.012, 0, 0, 7); g.stroke();
    }
    if (night) drawReflections(g, S, lights, 0.9);
  }

  function drawRoad(c, o, seed) {
    var S = c.width, g = c.getContext('2d'), r = rng(seed);
    var place = o.place || PLACES[seed % PLACES.length];
    drawSky(g, S, o, r);
    var neon = drawBuildings(g, S, o, r, place);
    var road = drawGround(g, S, o, r, place);
    if (place === 'overpass') drawOverpass(g, S, o);
    var lamps = drawLamps(g, S, o, place);
    // 크기 비교용 세워 둔 차
    if (o.car !== false) {
      var cw = S * 0.22, cx = S * (r.next() < 0.5 ? 0.12 : 0.62), cy = S * 0.86;
      drawCar(g, S, cx, cy, cw, o.time === 'night' ? '#5a5f86' : pick(r, ['#d95b5b', '#4f7fd9', '#e8e8e8']));
    }
    var lights = lamps.concat(neon);
    if (o.time === 'night' && !lights.length) lights.push({ x: S * 0.5, color: '#ffd88a' });
    if (o.time === 'day') lights = [{ x: S * 0.5, w: S * 0.3, color: '#ffffff' }];
    drawWater(g, S, o, r, road, lights);
  }

  /* ---------- 도로가 아닌 장소(1 임무 가짜) — 도로와 같은 하늘·건물 붓, 바닥만 다르다 ---------- */
  function drawPlace(c, o, seed) {
    var S = c.width, g = c.getContext('2d'), r = rng(seed);
    drawSky(g, S, o, r);
    drawBuildings(g, S, o, r, 'street');
    g.fillStyle = '#d9d2c3';
    g.fillRect(0, S * HZ, S, S * (1 - HZ));
    if (o.place === 'pool') drawPool(g, S, r);
    else drawFountain(g, S, r);
  }

  // 수영장: 파란 물 + 흰 타일 테두리 + 빨강·흰 레인 줄 + 사다리
  function drawPool(g, S, r) {
    var poly = [[S * 0.2, S * (HZ + 0.06)], [S * 0.8, S * (HZ + 0.06)], [S * 1.05, S], [S * -0.05, S]];
    pathPoly(g, poly);
    g.fillStyle = '#f4f6f8'; g.fill();
    var inner = [[S * 0.24, S * (HZ + 0.09)], [S * 0.76, S * (HZ + 0.09)], [S * 0.97, S * 0.97], [S * 0.03, S * 0.97]];
    pathPoly(g, inner);
    g.fillStyle = '#29a3e0'; g.fill();
    g.save(); pathPoly(g, inner); g.clip();
    // 바닥 타일 줄
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1;
    for (var t = 0; t < 8; t++) { var yy = S * (HZ + 0.09) + (S * (0.97 - HZ - 0.09)) * (t / 8) * (t / 8 + 0.3); g.beginPath(); g.moveTo(0, yy); g.lineTo(S, yy); g.stroke(); }
    // 레인 줄(빨강·흰 구슬)
    for (var l = 1; l < 5; l++) {
      var x0 = S * (0.24 + 0.52 * l / 5), x1 = S * (0.03 + 0.94 * l / 5);
      for (var k = 0; k < 14; k++) {
        var f = k / 14, x = x0 + (x1 - x0) * f, y = S * (HZ + 0.09) + S * (0.88 - HZ) * f;
        g.fillStyle = k % 2 ? '#ffffff' : '#e8434a';
        g.beginPath(); g.arc(x, y, 1.5 + f * 4, 0, 7); g.fill();
      }
    }
    g.fillStyle = 'rgba(255,255,255,.25)';
    for (var w = 0; w < 6; w++) { g.beginPath(); g.ellipse(r.next() * S, S * (0.6 + r.next() * 0.35), S * 0.06, S * 0.01, 0, 0, 7); g.fill(); }
    g.restore();
    // 사다리(오른쪽 앞)
    g.strokeStyle = '#c9d2db'; g.lineWidth = S * 0.018; g.lineCap = 'round';
    [0.78, 0.86].forEach(function (fx) { g.beginPath(); g.moveTo(S * fx, S * 0.62); g.quadraticCurveTo(S * fx, S * 0.56, S * (fx + 0.04), S * 0.56); g.moveTo(S * fx, S * 0.62); g.lineTo(S * fx, S * 0.8); g.stroke(); });
    g.lineWidth = S * 0.01;
    for (var rr = 0; rr < 3; rr++) { g.beginPath(); g.moveTo(S * 0.78, S * (0.67 + rr * 0.05)); g.lineTo(S * 0.86, S * (0.67 + rr * 0.05)); g.stroke(); }
  }

  // 분수 광장: 보도블록 + 둥근 돌 수반 + 위로 솟는 물줄기
  function drawFountain(g, S, r) {
    g.strokeStyle = 'rgba(120,105,85,.35)'; g.lineWidth = 1;
    for (var y = S * HZ; y < S; y += S * 0.05) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    var cx = S * 0.5, cy = S * 0.74, rx = S * 0.38, ry = S * 0.13;
    g.fillStyle = '#9a9488'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
    g.fillStyle = '#5fa8d8'; g.beginPath(); g.ellipse(cx, cy, rx * 0.88, ry * 0.8, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.3)';
    for (var w = 0; w < 5; w++) { g.beginPath(); g.ellipse(cx + (r.next() - 0.5) * rx, cy + (r.next() - 0.5) * ry, S * 0.05, S * 0.008, 0, 0, 7); g.fill(); }
    // 가운데 기둥과 물줄기
    g.fillStyle = '#b5ae9f'; g.fillRect(cx - S * 0.03, cy - S * 0.12, S * 0.06, S * 0.12);
    g.strokeStyle = 'rgba(235,248,255,.95)'; g.lineWidth = S * 0.014; g.lineCap = 'round';
    for (var j = -3; j <= 3; j++) {
      g.beginPath(); g.moveTo(cx, cy - S * 0.12);
      g.quadraticCurveTo(cx + j * S * 0.05, cy - S * 0.42, cx + j * S * 0.1, cy - S * 0.02);
      g.stroke();
    }
    g.fillStyle = 'rgba(235,248,255,.95)'; g.beginPath(); g.arc(cx, cy - S * 0.3, S * 0.035, 0, 7); g.fill();
  }

  /* ---------- 물건 하나(가짜·2 임무) — 동물 그림과 같은 단색 판 ---------- */
  function drawObject(c, o, seed) {
    var S = c.width, g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = pick(r, ['#f3e6d3', '#dfe9f3', '#efe0ea']); g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, S * 0.78, S, S * 0.22);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(S * 0.5, S * 0.9, S * 0.26, S * 0.04, 0, 0, 7); g.fill();
    if (o.object === 'fridge') drawFridge(g, S, r);
  }

  function drawFridge(g, S, r) {
    var body = pick(r, ['#f7f7f4', '#dfe5ea', '#cfe8dc']);
    var x = S * 0.3, y = S * 0.08, w = S * 0.4, h = S * 0.82;
    g.fillStyle = body; roundRect(g, x, y, w, h, S * 0.04); g.fill();
    g.strokeStyle = 'rgba(40,50,60,.45)'; g.lineWidth = 2; roundRect(g, x, y, w, h, S * 0.04); g.stroke();
    g.beginPath(); g.moveTo(x, y + h * 0.36); g.lineTo(x + w, y + h * 0.36); g.stroke();
    g.fillStyle = '#5b6470';
    g.fillRect(x + w * 0.08, y + h * 0.12, S * 0.025, h * 0.16);
    g.fillRect(x + w * 0.08, y + h * 0.44, S * 0.025, h * 0.24);
    // 자석 메모
    g.fillStyle = pick(r, ['#ffd166', '#ef767a', '#7bdff2']); g.fillRect(x + w * 0.55, y + h * 0.5, w * 0.25, w * 0.25);
  }

  /* ---------- 동물(튜토리얼) ---------- */
  function drawAnimal(c, o, seed) {
    var S = c.width, g = c.getContext('2d'), r = rng(seed);
    var bg = pick(r, ['#f3e6d3', '#dfe9f3', '#efe0ea']);
    if (!o.noBg) { g.fillStyle = bg; g.fillRect(0, 0, S, S); g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, S * 0.7, S, S * 0.3); }
    var fur = o.animal === 'dog' ? pick(r, ['#c8893f', '#8a5a2b', '#e8c48a', '#3d3027']) : pick(r, ['#9a9aa6', '#e09a4f', '#3b3b42', '#e8e2d8']);
    var cx = S * 0.5, cy = S * 0.55;
    g.fillStyle = fur;
    g.beginPath(); g.ellipse(cx, S * 0.8, S * 0.25, S * 0.14, 0, 0, 7); g.fill(); // 몸
    g.beginPath(); g.arc(cx, cy, S * 0.2, 0, 7); g.fill(); // 머리
    if (o.animal === 'dog') {
      g.fillStyle = shade(fur);
      g.beginPath(); g.ellipse(cx - S * 0.19, cy - S * 0.02, S * 0.06, S * 0.13, 0.3, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx + S * 0.19, cy - S * 0.02, S * 0.06, S * 0.13, -0.3, 0, 7); g.fill();
      g.fillStyle = '#f5ead9'; g.beginPath(); g.ellipse(cx, cy + S * 0.08, S * 0.09, S * 0.07, 0, 0, 7); g.fill();
      g.fillStyle = '#222'; g.beginPath(); g.arc(cx, cy + S * 0.05, S * 0.03, 0, 7); g.fill();
    } else {
      g.beginPath(); g.moveTo(cx - S * 0.18, cy - S * 0.08); g.lineTo(cx - S * 0.12, cy - S * 0.3); g.lineTo(cx - S * 0.02, cy - S * 0.17); g.fill();
      g.beginPath(); g.moveTo(cx + S * 0.18, cy - S * 0.08); g.lineTo(cx + S * 0.12, cy - S * 0.3); g.lineTo(cx + S * 0.02, cy - S * 0.17); g.fill();
      g.strokeStyle = 'rgba(30,30,30,.7)'; g.lineWidth = 1.5;
      [-1, 1].forEach(function (s) { for (var i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx + s * S * 0.05, cy + S * 0.07); g.lineTo(cx + s * S * 0.2, cy + S * 0.05 + i * S * 0.03); g.stroke(); } });
      g.fillStyle = '#e88a9a'; g.beginPath(); g.moveTo(cx - S * 0.02, cy + S * 0.05); g.lineTo(cx + S * 0.02, cy + S * 0.05); g.lineTo(cx, cy + S * 0.075); g.fill();
    }
    g.fillStyle = '#1b1b1b';
    g.beginPath(); g.arc(cx - S * 0.07, cy - S * 0.03, S * 0.025, 0, 7); g.arc(cx + S * 0.07, cy - S * 0.03, S * 0.025, 0, 7); g.fill();
  }
  function shade(hex) { var n = parseInt(hex.slice(1), 16); var f = function (v) { return Math.round(v * 0.7); }; return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }

  /* ---------- 공개 API ---------- */
  function card(mission, id, variant, size) {
    return cached(mission.id + '|' + id + '|' + variant + '|' + size, function () {
      var o = artOf(mission, id), c = canvas(size), seed = hash(id) + variant * 7919;
      if (o.animal) drawAnimal(c, o, seed);
      else if (o.place === 'pool' || o.place === 'fountain') drawPlace(c, o, seed);
      else if (o.object) drawObject(c, o, seed);
      else drawRoad(c, Object.assign({}, o, { place: PLACES[(hash(id) + variant) % PLACES.length] }), seed);
      return c;
    });
  }

  function thumb(src, cells) {
    cells = cells || 24;
    var k = Math.max(1, Math.floor(src.width / cells));
    var small = canvas(cells), sg = small.getContext('2d');
    sg.drawImage(src, 0, 0, cells, cells);
    var out = canvas(cells * k), og = out.getContext('2d');
    og.imageSmoothingEnabled = false;
    og.drawImage(small, 0, 0, cells * k, cells * k);
    return out;
  }

  var ICON_BG = '#1a1240';
  function icon(name, size) {
    return cached('icon|' + name + '|' + size, function () {
      var c = canvas(size), g = c.getContext('2d'), S = size, m = S / 2;
      g.fillStyle = ICON_BG; roundRect(g, 0, 0, S, S, S * 0.22); g.fill();
      g.lineCap = 'round'; g.lineJoin = 'round';
      switch (name) {
        case 'day':
          g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(m, m, S * 0.18, 0, 7); g.fill();
          g.strokeStyle = '#ffd24a'; g.lineWidth = S * 0.07;
          for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; g.beginPath(); g.moveTo(m + Math.cos(a) * S * 0.27, m + Math.sin(a) * S * 0.27); g.lineTo(m + Math.cos(a) * S * 0.37, m + Math.sin(a) * S * 0.37); g.stroke(); }
          break;
        case 'night':
          g.fillStyle = '#e8e4ff'; g.beginPath(); g.arc(m, m, S * 0.3, 0, 7); g.fill();
          g.fillStyle = ICON_BG; g.beginPath(); g.arc(m + S * 0.14, m - S * 0.1, S * 0.26, 0, 7); g.fill();
          break;
        case 'flood_deep': waves(g, S, 3, '#4fb3ff'); break;
        case 'flood_shallow': waves(g, S, 1, '#4fb3ff'); break;
        case 'wet':
          drop(g, S, '#9fe8ff'); break;
        case 'dry':
          drop(g, S, null);
          g.strokeStyle = '#ff9f5a'; g.lineWidth = S * 0.08; g.beginPath(); g.moveTo(S * 0.22, S * 0.78); g.lineTo(S * 0.78, S * 0.22); g.stroke();
          break;
        case 'unknown':
          g.fillStyle = '#ff5fb0'; g.font = 'bold ' + Math.round(S * 0.7) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', m, m + S * 0.04);
          break;
        case 'dog':
          g.fillStyle = '#e8b06a'; g.beginPath(); g.arc(m, m + S * 0.04, S * 0.24, 0, 7); g.fill();
          g.fillStyle = '#9a6430';
          g.beginPath(); g.ellipse(m - S * 0.24, m, S * 0.08, S * 0.17, 0.3, 0, 7); g.fill();
          g.beginPath(); g.ellipse(m + S * 0.24, m, S * 0.08, S * 0.17, -0.3, 0, 7); g.fill();
          g.fillStyle = '#222'; g.beginPath(); g.arc(m, m + S * 0.1, S * 0.05, 0, 7); g.fill();
          break;
        case 'cat':
          g.fillStyle = '#c8c8d8'; g.beginPath(); g.arc(m, m + S * 0.06, S * 0.23, 0, 7); g.fill();
          g.beginPath(); g.moveTo(m - S * 0.22, m); g.lineTo(m - S * 0.16, m - S * 0.3); g.lineTo(m - S * 0.02, m - S * 0.14); g.fill();
          g.beginPath(); g.moveTo(m + S * 0.22, m); g.lineTo(m + S * 0.16, m - S * 0.3); g.lineTo(m + S * 0.02, m - S * 0.14); g.fill();
          g.fillStyle = '#222'; g.beginPath(); g.arc(m - S * 0.08, m + S * 0.04, S * 0.035, 0, 7); g.arc(m + S * 0.08, m + S * 0.04, S * 0.035, 0, 7); g.fill();
          break;
        default: throw new Error('알 수 없는 아이콘: ' + name);
      }
      return c;
    });
  }
  function waves(g, S, n, col) {
    g.strokeStyle = col; g.lineWidth = S * 0.08;
    for (var i = 0; i < n; i++) {
      var y = S * (0.72 - i * 0.2);
      g.beginPath(); g.moveTo(S * 0.15, y);
      for (var x = 0; x <= 4; x++) g.quadraticCurveTo(S * (0.15 + x * 0.175 + 0.0875), y + (x % 2 ? S * 0.08 : -S * 0.08), S * (0.15 + (x + 1) * 0.175), y);
      g.stroke();
    }
  }
  function drop(g, S, fill) {
    g.beginPath(); g.moveTo(S * 0.5, S * 0.15);
    g.bezierCurveTo(S * 0.78, S * 0.5, S * 0.78, S * 0.82, S * 0.5, S * 0.82);
    g.bezierCurveTo(S * 0.22, S * 0.82, S * 0.22, S * 0.5, S * 0.5, S * 0.15);
    if (fill) { g.fillStyle = fill; g.fill(); } else { g.strokeStyle = '#9fe8ff'; g.lineWidth = S * 0.06; g.stroke(); }
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function wrapText(g, text, x, y, maxW, lh) {
    // 띄어쓰기 단위로 줄바꿈(숫자·단어 중간에서 끊지 않게)
    var line = '', lines = [], words = text.split(' ');
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (g.measureText(t).width > maxW && line) { lines.push(line); line = words[i]; } else line = t;
    }
    if (line) lines.push(line);
    lines.forEach(function (l, k) { g.fillText(l, x, y + k * lh); });
  }

  // 단서: usual_photo는 같은 장소의 평소(마른) 모습, 나머지는 계기판 모양 문구
  function clue(mission, ambiguousId, index, size) {
    return cached('clue|' + mission.id + '|' + ambiguousId + '|' + index + '|' + size, function () {
      var q = mission.ambiguous.filter(function (a) { return a.id === ambiguousId; })[0];
      var cl = q.clues[index], c = canvas(size);
      if (cl.type === 'usual_photo') {
        drawRoad(c, Object.assign({}, q.art, { water: 'dry', ambiguity: null, place: PLACES[hash(ambiguousId) % PLACES.length] }), hash(ambiguousId));
        return c;
      }
      var g = c.getContext('2d'), S = size;
      g.fillStyle = '#0f1a2e'; g.fillRect(0, 0, S, S);
      g.strokeStyle = '#7ff9ff'; g.lineWidth = 3; roundRect(g, 8, 8, S - 16, S - 16, 14); g.stroke();
      g.fillStyle = '#7ff9ff';
      if (cl.type === 'sensor') { g.fillRect(S * 0.42, S * 0.14, S * 0.16, S * 0.36); g.fillStyle = '#4fb3ff'; g.fillRect(S * 0.44, S * 0.4, S * 0.12, S * 0.08); }
      else if (cl.type === 'wheel') { g.beginPath(); g.arc(S * 0.5, S * 0.32, S * 0.15, 0, 7); g.fill(); g.fillStyle = 'rgba(79,179,255,.7)'; g.fillRect(S * 0.25, S * 0.38, S * 0.5, S * 0.1); }
      else if (cl.type === 'time') { g.lineWidth = 4; g.beginPath(); g.arc(S * 0.5, S * 0.32, S * 0.15, 0, 7); g.stroke(); g.beginPath(); g.moveTo(S * 0.5, S * 0.32); g.lineTo(S * 0.5, S * 0.22); g.moveTo(S * 0.5, S * 0.32); g.lineTo(S * 0.58, S * 0.35); g.stroke(); }
      else { g.fillRect(S * 0.3, S * 0.24, S * 0.3, S * 0.14); g.fillRect(S * 0.6, S * 0.28, S * 0.12, S * 0.1); g.fillStyle = '#0f1a2e'; g.beginPath(); g.arc(S * 0.38, S * 0.4, S * 0.04, 0, 7); g.arc(S * 0.64, S * 0.4, S * 0.04, 0, 7); g.fill(); }
      g.fillStyle = '#f4f1ff'; g.font = 'bold ' + Math.round(S * 0.075) + 'px sans-serif'; g.textAlign = 'center';
      wrapText(g, cl.text, S * 0.5, S * 0.66, S * 0.8, S * 0.1);
      return c;
    });
  }

  // 장면 그림(브리핑 'neutral' / 결과 'pass'·'danger'·'inconvenience')
  function scene(mission, sceneId, outcome, size) {
    return cached('scene|' + mission.id + '|' + sceneId + '|' + outcome + '|' + size, function () {
      var s = mission.scenes.filter(function (x) { return x.id === sceneId; })[0];
      var c = canvas(size), g = c.getContext('2d'), S = size, seed = hash(sceneId);
      if (s.art.place === 'shelter') {
        drawAnimal(c, { animal: 'dog' }, seed);
        var half = canvas(Math.round(S * 0.55)); drawAnimal(half, { animal: 'cat', noBg: true }, seed + 1);
        g.drawImage(half, S * 0.45, S * 0.45);
      } else {
        drawRoad(c, Object.assign({ car: false }, s.art), seed);
      }
      var flood = s.art.water === 'deep' || s.art.water === 'shallow';
      if (outcome === 'pass') {
        if (flood) barrier(g, S);
        badge(g, S, '#5be3a1', 'check');
      } else if (outcome === 'inconvenience') {
        barrier(g, S);
        g.strokeStyle = '#ff9f5a'; g.lineWidth = S * 0.03;
        g.beginPath(); g.moveTo(S * 0.35, S * 0.95); g.quadraticCurveTo(S * 0.05, S * 0.7, S * 0.25, S * 0.5); g.stroke();
        g.fillStyle = '#ff9f5a'; g.beginPath(); g.moveTo(S * 0.21, S * 0.47); g.lineTo(S * 0.31, S * 0.5); g.lineTo(S * 0.22, S * 0.57); g.fill();
        badge(g, S, '#ff9f5a', 'bar');
      } else if (outcome === 'danger') {
        drawCar(g, S, S * 0.55, S * 0.93, S * 0.3, '#e8e8e8');
        // 감독관 실루엣 — 멈춤 손
        g.fillStyle = '#10093a';
        g.beginPath(); g.arc(S * 0.38, S * 0.6, S * 0.045, 0, 7); g.fill();
        g.fillRect(S * 0.35, S * 0.645, S * 0.06, S * 0.18);
        g.fillRect(S * 0.41, S * 0.66, S * 0.1, S * 0.025);
        g.fillStyle = '#ff5f6d'; g.beginPath(); g.arc(S * 0.53, S * 0.672, S * 0.03, 0, 7); g.fill();
        badge(g, S, '#ff5f6d', 'bang');
      }
      return c;
    });
  }
  function barrier(g, S) {
    var y = S * 0.7, x0 = S * 0.2, x1 = S * 0.8, n = 8;
    for (var i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff4f5e'; g.fillRect(x0 + (x1 - x0) * i / n, y, (x1 - x0) / n, S * 0.035); }
    g.fillStyle = '#333'; g.fillRect(x0, y, S * 0.015, S * 0.12); g.fillRect(x1 - S * 0.015, y, S * 0.015, S * 0.12);
  }
  function badge(g, S, col, mark) {
    var x = S * 0.86, y = S * 0.14, r = S * 0.08;
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = '#10093a'; g.fillStyle = '#10093a'; g.lineWidth = S * 0.02; g.lineCap = 'round';
    if (mark === 'check') { g.beginPath(); g.moveTo(x - r * 0.45, y); g.lineTo(x - r * 0.1, y + r * 0.35); g.lineTo(x + r * 0.45, y - r * 0.35); g.stroke(); }
    else if (mark === 'bar') { g.beginPath(); g.moveTo(x - r * 0.45, y); g.lineTo(x + r * 0.45, y); g.stroke(); }
    else { g.beginPath(); g.moveTo(x, y - r * 0.5); g.lineTo(x, y + r * 0.1); g.stroke(); g.beginPath(); g.arc(x, y + r * 0.4, S * 0.012, 0, 7); g.fill(); }
  }

  var api = { card: card, thumb: thumb, icon: icon, clue: clue, scene: scene };
  root.DR = root.DR || {};
  root.DR.CardArt = api;
})(window);
