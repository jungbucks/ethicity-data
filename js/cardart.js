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

  /* ---------- 물건 하나(가짜·2 임무) — 동물 그림과 같은 단색 판 ----------
   * 2 임무 물건은 가운데 한 물건을 크게(24칸 썸네일에서도 실루엣이 남게). variant로 색·기울기·종류(신문지/상자 등)가 바뀐다.
   * o.noBg면 판 없이 물건만(선별장 컷에 얹을 때). 가짜도 같은 붓 — 테두리·반짝임 같은 표식 없음. */
  var TILT = [-0.12, 0.1, 0, 0.22, -0.26];
  function drawObject(c, o, seed, variant) {
    var S = c.width, g = c.getContext('2d'), r = rng(seed), v = variant || 0;
    if (!o.noBg) {
      g.fillStyle = pick(r, ['#f3e6d3', '#dfe9f3', '#efe0ea']); g.fillRect(0, 0, S, S);
      g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, S * 0.78, S, S * 0.22);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(S * 0.5, S * 0.9, S * 0.26, S * 0.04, 0, 0, 7); g.fill();
    }
    if (o.object === 'fridge') { drawFridge(g, S, r); return; }
    var fn = OBJECTS[o.object];
    if (!fn) throw new Error('알 수 없는 물건: ' + o.object);
    g.save();
    g.translate(S * 0.5, S * 0.5);
    g.rotate(TILT[v % TILT.length]);
    g.lineJoin = 'round'; g.lineCap = 'round';
    fn(g, S, r, v);
    g.restore();
  }

  // 아래 그리기 함수는 모두 물건 가운데(0,0) 기준 좌표
  function rr(g, x, y, w, h, rad) { roundRect(g, x, y, w, h, Math.min(rad, w / 2, h / 2)); }
  function outline(g, S, col) { g.strokeStyle = col || 'rgba(30,35,50,.55)'; g.lineWidth = Math.max(1.5, S * 0.012); g.stroke(); }

  function drawDrinkCan(g, S, r) {
    var col = pick(r, ['#d93a3a', '#2f6fd6', '#2aa35a', '#f0a429', '#8e44ad']);
    var w = S * 0.34, h = S * 0.56, x = -w / 2, y = -h / 2 + S * 0.02;
    rr(g, x, y, w, h, S * 0.03); g.fillStyle = col; g.fill(); outline(g, S);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + w * 0.16, y + h * 0.06, w * 0.1, h * 0.88);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + w * 0.78, y + h * 0.04, w * 0.18, h * 0.92);
    // 물결 로고 띠
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = S * 0.035;
    g.beginPath(); g.moveTo(x + w * 0.05, y + h * 0.55); g.bezierCurveTo(x + w * 0.35, y + h * 0.4, x + w * 0.6, y + h * 0.7, x + w * 0.95, y + h * 0.5); g.stroke();
    // 은색 윗면·바닥 테두리 + 따개
    g.fillStyle = '#cfd6de'; g.beginPath(); g.ellipse(0, y, w * 0.5, w * 0.14, 0, 0, 7); g.fill(); outline(g, S);
    g.fillStyle = '#9aa4ae'; g.beginPath(); g.ellipse(0, y, w * 0.38, w * 0.09, 0, 0, 7); g.fill();
    g.fillStyle = '#e8edf2'; rr(g, -w * 0.12, y - w * 0.05, w * 0.24, w * 0.08, w * 0.04); g.fill();
    g.fillStyle = '#b8c0c9'; g.fillRect(x, y + h - S * 0.025, w, S * 0.025);
  }

  function drawTinCan(g, S, r) {
    var col = pick(r, ['#e8743b', '#3c9d5d', '#c0392b', '#e0b020']);
    var w = S * 0.5, h = S * 0.38, x = -w / 2, y = -h / 2 + S * 0.06;
    g.fillStyle = '#c3cad2'; g.fillRect(x, y, w, h); g.beginPath(); g.rect(x, y, w, h); outline(g, S);
    // 종이 라벨 + 둥근 그림
    g.fillStyle = col; g.fillRect(x, y + h * 0.16, w, h * 0.68);
    g.fillStyle = '#fff8e8'; g.beginPath(); g.ellipse(0, y + h * 0.5, w * 0.2, h * 0.24, 0, 0, 7); g.fill();
    g.fillStyle = shade(col); g.beginPath(); g.arc(0, y + h * 0.5, h * 0.11, 0, 7); g.fill();
    // 띠 홈
    g.strokeStyle = 'rgba(60,70,80,.45)'; g.lineWidth = 1.5;
    [0.07, 0.93].forEach(function (f) { g.beginPath(); g.moveTo(x, y + h * f); g.lineTo(x + w, y + h * f); g.stroke(); });
    // 윗면 + 고리
    g.fillStyle = '#dfe4ea'; g.beginPath(); g.ellipse(0, y, w * 0.5, w * 0.16, 0, 0, 7); g.fill(); outline(g, S);
    g.strokeStyle = '#8e98a3'; g.lineWidth = S * 0.012; g.beginPath(); g.ellipse(0, y, w * 0.4, w * 0.12, 0, 0, 7); g.stroke();
    g.lineWidth = S * 0.02; g.beginPath(); g.ellipse(w * 0.18, y, w * 0.08, w * 0.04, 0, 0, 7); g.stroke();
    g.fillStyle = '#aab2bb'; g.beginPath(); g.ellipse(0, y + h, w * 0.5, w * 0.12, 0, 0, Math.PI); g.fill();
  }

  // 투명 페트병(세운 모양) — 라벨 없이(실제 배출 방법), 연한 파란 투명 몸통 + 진한 테두리
  function bottlePath(g, S) {
    var hw = S * 0.13, top = -S * 0.36, neck = S * 0.045, sh = top + S * 0.17, bot = S * 0.36;
    g.beginPath();
    g.moveTo(-neck, top + S * 0.06);
    g.quadraticCurveTo(-hw, sh - S * 0.06, -hw, sh);
    g.lineTo(-hw, bot - S * 0.04); g.quadraticCurveTo(-hw, bot, -hw + S * 0.04, bot);
    g.lineTo(hw - S * 0.04, bot); g.quadraticCurveTo(hw, bot, hw, bot - S * 0.04);
    g.lineTo(hw, sh); g.quadraticCurveTo(hw, sh - S * 0.06, neck, top + S * 0.06);
    g.closePath();
  }
  function drawBottle(g, S, r, crushed) {
    var cap = pick(r, ['#2f80ed', '#27ae60', '#f4f4f4', '#e74c3c']);
    bottlePath(g, S);
    g.fillStyle = 'rgba(170,215,240,.62)'; g.fill(); outline(g, S, 'rgba(40,95,140,.8)');
    // 허리 홈·바닥 홈
    g.strokeStyle = 'rgba(40,95,140,.45)'; g.lineWidth = Math.max(1, S * 0.008);
    [0.02, 0.07, 0.24].forEach(function (f) { g.beginPath(); g.moveTo(-S * 0.13, S * f); g.lineTo(S * 0.13, S * f); g.stroke(); });
    // 반사광
    g.fillStyle = 'rgba(255,255,255,.75)'; rr(g, -S * 0.09, -S * 0.14, S * 0.035, S * 0.4, S * 0.02); g.fill();
    if (crushed) {
      // 찌그러진 주름
      g.strokeStyle = 'rgba(30,70,110,.7)'; g.lineWidth = Math.max(1.5, S * 0.012);
      g.beginPath();
      for (var i = 0; i <= 6; i++) { var y = -S * 0.12 + i * S * 0.075; g[i ? 'lineTo' : 'moveTo']((i % 2 ? 1 : -1) * S * 0.12, y); }
      g.stroke();
    }
    // 목 고리·뚜껑
    g.fillStyle = 'rgba(170,215,240,.9)'; g.fillRect(-S * 0.05, -S * 0.31, S * 0.1, S * 0.02);
    g.fillStyle = cap; rr(g, -S * 0.055, -S * 0.39, S * 0.11, S * 0.075, S * 0.015); g.fill(); outline(g, S);
  }
  function drawPetClear(g, S, r) { drawBottle(g, S, r, false); }
  function drawPetCrushed(g, S, r) {
    // 눕혀서 납작하게 누른 페트병
    g.rotate(1.38); g.scale(0.62, 0.92);
    drawBottle(g, S, r, true);
  }

  function drawVinylBag(g, S, r) {
    var col = pick(r, ['#f7f7f7', '#f6c6d8', '#cfe6f7', '#e3f2c4']);
    // 손잡이 고리
    g.strokeStyle = col; g.lineWidth = S * 0.05;
    [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(s * S * 0.13, -S * 0.2, S * 0.07, S * 0.11, 0, Math.PI, 2 * Math.PI); g.stroke(); });
    g.strokeStyle = 'rgba(110,110,130,.55)'; g.lineWidth = Math.max(1.5, S * 0.01);
    [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(s * S * 0.13, -S * 0.2, S * 0.095, S * 0.135, 0, Math.PI, 2 * Math.PI); g.stroke(); });
    // 몸통(아래가 넓고 둥글다)
    g.beginPath();
    g.moveTo(-S * 0.22, -S * 0.2); g.lineTo(S * 0.22, -S * 0.2);
    g.quadraticCurveTo(S * 0.3, S * 0.1, S * 0.26, S * 0.3);
    g.quadraticCurveTo(0, S * 0.38, -S * 0.26, S * 0.3);
    g.quadraticCurveTo(-S * 0.3, S * 0.1, -S * 0.22, -S * 0.2);
    g.closePath();
    g.fillStyle = col; g.fill(); outline(g, S, 'rgba(110,110,130,.7)');
    // 구김
    g.strokeStyle = 'rgba(90,90,110,.35)'; g.lineWidth = Math.max(1, S * 0.008);
    for (var i = 0; i < 6; i++) {
      var x = -S * 0.18 + r.next() * S * 0.36, y = -S * 0.12 + r.next() * S * 0.36;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + S * 0.05, y + S * 0.03, x + S * 0.02, y + S * 0.09); g.stroke();
    }
  }

  function drawPaper(g, S, r, v) {
    if (v % 2) {
      // 종이 상자(펼친 날개 + 테이프)
      var w = S * 0.56, h = S * 0.36, x = -w / 2, y = -S * 0.06;
      g.fillStyle = '#d9a663';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - S * 0.06, y - S * 0.16); g.lineTo(x + w * 0.45, y - S * 0.16); g.lineTo(x + w * 0.5, y); g.closePath(); g.fill(); outline(g, S);
      g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w + S * 0.06, y - S * 0.16); g.lineTo(x + w * 0.55, y - S * 0.16); g.lineTo(x + w * 0.5, y); g.closePath(); g.fill(); outline(g, S);
      g.fillStyle = '#c58f4f'; g.fillRect(x, y, w, h); g.beginPath(); g.rect(x, y, w, h); outline(g, S);
      g.fillStyle = 'rgba(240,225,190,.75)'; g.fillRect(-S * 0.05, y, S * 0.1, h);
      g.strokeStyle = 'rgba(70,45,20,.6)'; g.lineWidth = S * 0.012;
      g.beginPath(); g.moveTo(x + w * 0.62, y + h * 0.5); g.lineTo(x + w * 0.9, y + h * 0.42); g.stroke();
      return;
    }
    // 접은 신문지: 큰 제목 띠 + 사진 칸 + 두 단 글줄
    var W = S * 0.66, H = S * 0.5, X = -W / 2, Y = -H / 2;
    g.fillStyle = '#efece4'; g.fillRect(X, Y, W, H); g.beginPath(); g.rect(X, Y, W, H); outline(g, S);
    g.fillStyle = '#2b2b2b'; g.fillRect(X + W * 0.06, Y + H * 0.07, W * 0.6, H * 0.1);
    g.fillStyle = '#9aa3ad'; g.fillRect(X + W * 0.06, Y + H * 0.24, W * 0.38, H * 0.3);
    g.fillStyle = '#8a8a8a';
    for (var i = 0; i < 9; i++) {
      var yy = Y + H * (0.26 + i * 0.075);
      if (yy > Y + H * 0.24 && yy < Y + H * 0.56) g.fillRect(X + W * 0.5, yy, W * 0.42, Math.max(1.5, S * 0.008));
      else if (yy <= Y + H * 0.92) { g.fillRect(X + W * 0.06, yy, W * 0.4, Math.max(1.5, S * 0.008)); g.fillRect(X + W * 0.52, yy, W * 0.4, Math.max(1.5, S * 0.008)); }
    }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(-S * 0.008, Y, S * 0.016, H);
  }

  function drawMilkPack(g, S, r) {
    var col = pick(r, ['#2f80ed', '#27ae60', '#e05a6a', '#e0a92a']);
    var w = S * 0.32, h = S * 0.46, x = -w / 2 - S * 0.04, y = -S * 0.12;
    // 옆면(입체)
    g.fillStyle = '#d8dad4';
    g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w + S * 0.1, y - S * 0.05); g.lineTo(x + w + S * 0.1, y + h - S * 0.05); g.lineTo(x + w, y + h); g.closePath(); g.fill(); outline(g, S);
    // 지붕(박공) + 꼭대기 날개
    g.fillStyle = '#ecece6';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * 0.5, y - S * 0.15); g.lineTo(x + w, y); g.closePath(); g.fill(); outline(g, S);
    g.beginPath(); g.moveTo(x + w * 0.5, y - S * 0.15); g.lineTo(x + w * 0.5 + S * 0.1, y - S * 0.2); g.lineTo(x + w + S * 0.1, y - S * 0.05); g.lineTo(x + w, y); g.closePath(); g.fillStyle = '#d0d2cc'; g.fill(); outline(g, S);
    g.fillStyle = '#f4f4ee'; g.fillRect(x + w * 0.5 - S * 0.012, y - S * 0.2, S * 0.024 + S * 0.1, S * 0.03);
    // 앞면
    g.fillStyle = '#fbfbf7'; g.fillRect(x, y, w, h); g.beginPath(); g.rect(x, y, w, h); outline(g, S);
    g.fillStyle = col; g.fillRect(x, y + h * 0.55, w, h * 0.45);
    g.fillStyle = '#fbfbf7'; g.beginPath(); g.moveTo(x, y + h * 0.6); g.quadraticCurveTo(x + w * 0.5, y + h * 0.48, x + w, y + h * 0.62); g.lineTo(x + w, y + h * 0.55); g.lineTo(x, y + h * 0.55); g.fill();
    // 물방울(우유) 표시
    g.fillStyle = col; g.beginPath(); g.moveTo(x + w * 0.5, y + h * 0.12); g.quadraticCurveTo(x + w * 0.72, y + h * 0.36, x + w * 0.5, y + h * 0.42); g.quadraticCurveTo(x + w * 0.28, y + h * 0.36, x + w * 0.5, y + h * 0.12); g.fill();
  }

  // 일반쓰레기(재활용 안 되는 것): 고무장갑 / 스펀지 / 쓴 휴지 뭉치
  function drawTrash(g, S, r, v) {
    var kind = v % 3;
    if (kind === 0) {
      g.fillStyle = '#f4c430';
      rr(g, -S * 0.16, -S * 0.04, S * 0.3, S * 0.26, S * 0.08); g.fill(); outline(g, S);
      for (var i = 0; i < 4; i++) { rr(g, -S * 0.15 + i * S * 0.075, -S * 0.3, S * 0.06, S * 0.3, S * 0.03); g.fill(); outline(g, S); }
      g.save(); g.rotate(-0.6); rr(g, -S * 0.27, -S * 0.02, S * 0.06, S * 0.2, S * 0.03); g.fill(); outline(g, S); g.restore();
      g.fillStyle = '#e0a800'; g.fillRect(-S * 0.17, S * 0.2, S * 0.32, S * 0.12); g.beginPath(); g.rect(-S * 0.17, S * 0.2, S * 0.32, S * 0.12); outline(g, S);
    } else if (kind === 1) {
      g.fillStyle = '#ffd84d'; g.fillRect(-S * 0.24, -S * 0.06, S * 0.48, S * 0.2); g.beginPath(); g.rect(-S * 0.24, -S * 0.06, S * 0.48, S * 0.2); outline(g, S);
      g.fillStyle = '#2e8b57'; g.fillRect(-S * 0.24, -S * 0.13, S * 0.48, S * 0.07); g.beginPath(); g.rect(-S * 0.24, -S * 0.13, S * 0.48, S * 0.07); outline(g, S);
      g.fillStyle = 'rgba(180,140,20,.6)';
      for (var k = 0; k < 9; k++) { g.beginPath(); g.arc(-S * 0.2 + r.next() * S * 0.4, -S * 0.03 + r.next() * S * 0.14, S * 0.012, 0, 7); g.fill(); }
    } else {
      g.fillStyle = '#f7f7f4';
      g.beginPath();
      for (var j = 0; j < 12; j++) { var a = j / 12 * Math.PI * 2, rad = S * (0.2 + r.next() * 0.07); g[j ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad * 0.85); }
      g.closePath(); g.fill(); outline(g, S, 'rgba(120,120,130,.6)');
      g.strokeStyle = 'rgba(120,120,130,.45)'; g.lineWidth = Math.max(1, S * 0.008);
      for (var q = 0; q < 6; q++) { var x0 = (r.next() - 0.5) * S * 0.3, y0 = (r.next() - 0.5) * S * 0.25; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + S * 0.06, y0 + S * 0.04); g.lineTo(x0 + S * 0.02, y0 + S * 0.09); g.stroke(); }
    }
  }

  // AA 건전지: 가늘고 긴 원통 + 두 색 띠 + 위 볼록(+극)
  function drawBattery(g, S, r, v) {
    // 컨베이어 물건(변형 3 이상)은 학습 카드와 다른 모양 — 학생이 고친 카드와 같은 그림이 잘못 가는 것처럼 보이지 않게
    if (v >= 3) { if (v % 2) drawBatteryPair(g, S, r); else drawBattery9v(g, S, r); return; }
    var tone = pick(r, [['#2b2b2b', '#d98a2b'], ['#1f4fa0', '#c9ced6'], ['#1e7a46', '#c9ced6'], ['#7a1f2b', '#e8c547']]);
    var w = S * 0.2, h = S * 0.6, x = -w / 2, y = -h / 2 + S * 0.03;
    g.fillStyle = '#b8c0c9'; rr(g, -S * 0.035, y - S * 0.035, S * 0.07, S * 0.045, S * 0.01); g.fill(); outline(g, S);
    rr(g, x, y, w, h, S * 0.025); g.fillStyle = tone[0]; g.fill();
    g.save(); rr(g, x, y, w, h, S * 0.025); g.clip(); g.fillStyle = tone[1]; g.fillRect(x, y, w, h * 0.32); g.restore();
    rr(g, x, y, w, h, S * 0.025); outline(g, S);
    g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x + w * 0.16, y + h * 0.05, w * 0.12, h * 0.9);
    g.strokeStyle = '#ffffff'; g.lineWidth = S * 0.018;
    g.beginPath(); g.moveTo(-S * 0.035, y + h * 0.5); g.lineTo(S * 0.035, y + h * 0.5); g.moveTo(0, y + h * 0.5 - S * 0.035); g.lineTo(0, y + h * 0.5 + S * 0.035); g.stroke();
  }

  // 건전지 두 개 묶음(짧고 굵은 C형 두 개가 나란히)
  function drawBatteryPair(g, S, r) {
    var tone = pick(r, [['#e0a020', '#2b2b2b'], ['#c0392b', '#c9ced6'], ['#6c3fb5', '#c9ced6']]);
    [-1, 1].forEach(function (side) {
      g.save(); g.translate(side * S * 0.13, 0);
      var w = S * 0.2, h = S * 0.42, x = -w / 2, y = -h / 2;
      g.fillStyle = '#b8c0c9'; rr(g, -S * 0.035, y - S * 0.035, S * 0.07, S * 0.045, S * 0.01); g.fill(); outline(g, S);
      rr(g, x, y, w, h, S * 0.03); g.fillStyle = tone[1]; g.fill();
      g.save(); rr(g, x, y, w, h, S * 0.03); g.clip(); g.fillStyle = tone[0]; g.fillRect(x, y + h * 0.4, w, h * 0.6); g.restore();
      rr(g, x, y, w, h, S * 0.03); outline(g, S);
      g.strokeStyle = '#ffffff'; g.lineWidth = S * 0.016;
      g.beginPath(); g.moveTo(-S * 0.03, y + h * 0.2); g.lineTo(S * 0.03, y + h * 0.2); g.moveTo(0, y + h * 0.2 - S * 0.03); g.lineTo(0, y + h * 0.2 + S * 0.03); g.stroke();
      g.restore();
    });
  }
  // 네모난 9V 건전지(위에 단자 두 개)
  function drawBattery9v(g, S, r) {
    var col = pick(r, ['#2b2b2b', '#1f4fa0', '#7a1f2b']);
    var w = S * 0.34, h = S * 0.48, x = -w / 2, y = -h / 2 + S * 0.04;
    g.fillStyle = '#c9ced6';
    g.beginPath(); g.arc(-w * 0.22, y - S * 0.03, S * 0.035, 0, 7); g.fill(); outline(g, S);
    rr(g, w * 0.12, y - S * 0.065, S * 0.08, S * 0.065, S * 0.01); g.fill(); outline(g, S);
    rr(g, x, y, w, h, S * 0.03); g.fillStyle = col; g.fill(); outline(g, S);
    g.fillStyle = '#e8c547'; g.fillRect(x, y + h * 0.18, w, h * 0.2);
    g.fillStyle = '#ffffff'; g.font = 'bold ' + Math.round(S * 0.11) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('9V', 0, y + h * 0.66);
  }

  // 영수증(감열지): 길고 좁은 흰 띠 + 회색 글줄 + 바코드 + 톱니 아래끝
  function drawReceipt(g, S, r) {
    var w = S * 0.3, h = S * 0.7, x = -w / 2, y = -h / 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h);
    for (var i = 0; i < 8; i++) g.lineTo(x + w - (i + 0.5) * w / 8, y + h + (i % 2 ? 0 : -S * 0.025));
    g.lineTo(x, y + h); g.closePath();
    g.fillStyle = '#fdfdf8'; g.fill(); outline(g, S, 'rgba(120,120,130,.6)');
    g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x + w * 0.85, y, w * 0.15, h);
    g.fillStyle = '#555'; g.fillRect(x + w * 0.2, y + h * 0.05, w * 0.6, h * 0.04);
    g.fillStyle = '#9a9a9a';
    for (var k = 0; k < 8; k++) {
      var yy = y + h * (0.15 + k * 0.065);
      g.fillRect(x + w * 0.1, yy, w * (0.35 + r.next() * 0.15), Math.max(1.5, S * 0.008));
      g.fillRect(x + w * 0.7, yy, w * 0.2, Math.max(1.5, S * 0.008));
    }
    g.fillStyle = '#444'; g.fillRect(x + w * 0.1, y + h * 0.7, w * 0.8, h * 0.025);
    for (var b = 0; b < 14; b++) g.fillRect(x + w * (0.12 + b * 0.055), y + h * 0.78, w * (b % 3 ? 0.02 : 0.035), h * 0.1);
  }

  // 칫솔: 가는 막대(대각선) + 솔
  function drawToothbrush(g, S, r) {
    var col = pick(r, ['#3db7e4', '#ff7aa2', '#7ed957', '#9b59b6']);
    g.rotate(-0.7);
    rr(g, -S * 0.4, -S * 0.035, S * 0.56, S * 0.07, S * 0.035); g.fillStyle = col; g.fill(); outline(g, S);
    rr(g, S * 0.14, -S * 0.022, S * 0.1, S * 0.044, S * 0.02); g.fill();
    rr(g, S * 0.22, -S * 0.035, S * 0.18, S * 0.07, S * 0.03); g.fill(); outline(g, S);
    for (var i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#7fd3ff';
      g.fillRect(S * (0.235 + i * 0.026), -S * 0.12, S * 0.02, S * 0.09);
    }
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-S * 0.36, -S * 0.02, S * 0.4, S * 0.012);
  }

  var OBJECTS = {
    can_drink: drawDrinkCan, can_tin: drawTinCan, pet_clear: drawPetClear, pet_crushed: drawPetCrushed,
    vinyl_bag: drawVinylBag, paper_news: drawPaper, pack_milk: drawMilkPack, trash_misc: drawTrash,
    battery_aa: drawBattery, receipt: drawReceipt, toothbrush: drawToothbrush
  };

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

  /* ---------- 3 임무 눈높이 거리 풍경 — 역 앞·시장 골목·강변길·학교 앞, 지금/바뀌기 전(era:'old') ----------
   * 같은 붓(하늘·건물 줄·바닥)을 쓰고 장소의 표지물만 바꾼다. 옛 사진도 같은 붓 — 세피아·흐림 같은 표식 없음.
   * 바뀌기 전 표지물: 역 앞 = 광장 자리의 빌딩, 강변 = 길 자리의 공사 펜스·공터, 학교 앞 = 횡단보도 자리의 육교. 지하보도 금지. */
  function viewSky(g, S, o, r) {
    if (o.time === 'evening') {
      var grd = g.createLinearGradient(0, 0, 0, S * HZ);
      grd.addColorStop(0, '#3b2a5c'); grd.addColorStop(1, '#f2a35e');
      g.fillStyle = grd; g.fillRect(0, 0, S, S * HZ + 2);
    } else drawSky(g, S, { time: o.time === 'night' ? 'night' : 'day' }, r);
    if (o.rain) { g.fillStyle = 'rgba(40,50,70,.35)'; g.fillRect(0, 0, S, S * HZ + 2); }
  }
  function windows(g, x, y, w, h, night, r) {
    for (var wy = y + 6; wy < y + h - 8; wy += 10) for (var wx = x + 5; wx < x + w - 6; wx += 9) {
      if (r.next() < (night ? 0.5 : 0.85)) { g.fillStyle = night ? '#ffd88a' : 'rgba(80,110,160,.55)'; g.fillRect(wx, wy, 4, 5); }
    }
  }
  function drawStation(g, S, o, r) {
    var night = o.time === 'night';
    // 뒤의 역 건물(넓고 낮은 지붕 + 시계 + '역' 간판)
    var bx = S * 0.18, by = S * 0.22, bw = S * 0.64, bh = S * 0.24;
    g.fillStyle = night ? '#2a2f55' : '#c9b79a'; g.fillRect(bx, by, bw, bh);
    g.fillStyle = night ? '#1b1f3d' : '#8a6d4d';
    g.beginPath(); g.moveTo(bx - S * 0.03, by); g.lineTo(S * 0.5, by - S * 0.08); g.lineTo(bx + bw + S * 0.03, by); g.closePath(); g.fill();
    g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(S * 0.5, by + S * 0.05, S * 0.035, 0, 7); g.fill();
    g.strokeStyle = '#333'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(S * 0.5, by + S * 0.05); g.lineTo(S * 0.5, by + S * 0.025); g.moveTo(S * 0.5, by + S * 0.05); g.lineTo(S * 0.518, by + S * 0.055); g.stroke();
    g.fillStyle = '#1f4fa0'; g.fillRect(S * 0.42, by + S * 0.11, S * 0.16, S * 0.06);
    g.fillStyle = '#fff'; g.font = 'bold ' + Math.round(S * 0.045) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('역', S * 0.5, by + S * 0.14);
    g.fillStyle = night ? '#ffd88a' : '#5a4630';
    for (var d = 0; d < 4; d++) g.fillRect(bx + bw * (0.12 + d * 0.22), by + bh * 0.62, bw * 0.1, bh * 0.38);
    // 광장 바닥(타일)
    g.fillStyle = night ? '#3a3a52' : '#d9d2c3'; g.fillRect(0, S * HZ, S, S * (1 - HZ));
    g.strokeStyle = night ? 'rgba(255,255,255,.08)' : 'rgba(120,105,85,.3)'; g.lineWidth = 1;
    for (var t = 1; t < 7; t++) { var yy = S * HZ + S * (1 - HZ) * (t / 7) * (t / 7 + 0.2); g.beginPath(); g.moveTo(0, yy); g.lineTo(S, yy); g.stroke(); }
    for (var c = -4; c <= 4; c++) { g.beginPath(); g.moveTo(S * 0.5 + c * S * 0.04, S * HZ); g.lineTo(S * 0.5 + c * S * 0.2, S); g.stroke(); }
    if (o.era === 'old') {
      // 철거 전 빌딩: 광장 한가운데 높은 건물 + 간판
      var tx = S * 0.3, tw = S * 0.4, ty = S * 0.06, th = S * 0.74;
      g.fillStyle = night ? '#1c1d38' : '#7d8aa3'; g.fillRect(tx, ty, tw, th);
      g.strokeStyle = 'rgba(20,25,40,.6)'; g.lineWidth = 2; g.strokeRect(tx, ty, tw, th);
      windows(g, tx, ty + S * 0.08, tw, th - S * 0.12, night, r);
      g.fillStyle = '#e8434a'; g.fillRect(tx + tw * 0.15, ty + S * 0.015, tw * 0.7, S * 0.05);
      g.fillStyle = '#fff'; g.font = 'bold ' + Math.round(S * 0.035) + 'px sans-serif'; g.fillText('빌딩', S * 0.5, ty + S * 0.04);
    } else {
      // 지금: 비어 있는 광장 + 벤치·나무
      [0.2, 0.8].forEach(function (fx) {
        g.fillStyle = '#4c8a4a'; g.beginPath(); g.arc(S * fx, S * 0.6, S * 0.06, 0, 7); g.fill();
        g.fillStyle = '#6b4a2b'; g.fillRect(S * fx - S * 0.01, S * 0.64, S * 0.02, S * 0.08);
      });
      g.fillStyle = night ? '#55597a' : '#8a6d4d'; g.fillRect(S * 0.42, S * 0.8, S * 0.16, S * 0.025);
    }
  }
  function drawMarket(g, S, o, r) {
    var eve = o.time === 'evening', night = o.time === 'night';
    g.fillStyle = eve || night ? '#4a3b3a' : '#cbbfa8'; g.fillRect(0, S * HZ, S, S * (1 - HZ));
    // 좁은 골목 바닥
    g.fillStyle = eve || night ? '#5c4a44' : '#b3a68d';
    g.beginPath(); g.moveTo(S * 0.42, S * HZ); g.lineTo(S * 0.58, S * HZ); g.lineTo(S * 0.85, S); g.lineTo(S * 0.15, S); g.closePath(); g.fill();
    // 양쪽 가게 차양(줄무늬) 3겹 — 뒤로 갈수록 작게
    var cols = [['#e8434a', '#fff'], ['#2f80ed', '#fff'], ['#27ae60', '#fff'], ['#f2a33a', '#fff']];
    for (var k = 2; k >= 0; k--) {
      var f = 1 - k * 0.28, top = S * (HZ - 0.12 * f), h = S * 0.1 * f, w = S * 0.36 * f;
      [-1, 1].forEach(function (side) {
        var x0 = side < 0 ? S * 0.5 - S * 0.08 - w - S * 0.12 * (1 - f) * 2.2 : S * 0.5 + S * 0.08 + S * 0.12 * (1 - f) * 2.2;
        var c = pick(r, cols);
        g.fillStyle = eve || night ? '#3a2c2a' : '#e9dcc4'; g.fillRect(x0, top + h, w, S * 0.2 * f);
        for (var s = 0; s < 6; s++) { g.fillStyle = s % 2 ? c[1] : c[0]; g.fillRect(x0 + w * s / 6, top, w / 6, h); }
        g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x0, top + h, w, h * 0.25);
      });
    }
    // 매달린 등불
    for (var i = 0; i < 5; i++) {
      var lx = S * (0.3 + i * 0.1), ly = S * (0.12 + (i % 2) * 0.03);
      g.strokeStyle = '#444'; g.lineWidth = 1; g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx, ly); g.stroke();
      g.fillStyle = eve || night ? '#ffcf5a' : '#e8434a';
      if (eve || night) { g.shadowColor = '#ffcf5a'; g.shadowBlur = 12; }
      g.beginPath(); g.ellipse(lx, ly + S * 0.02, S * 0.018, S * 0.026, 0, 0, 7); g.fill(); g.shadowBlur = 0;
    }
  }
  function drawRiver(g, S, o, r) {
    var night = o.time === 'night';
    g.fillStyle = night ? '#23304a' : '#9fc77b'; g.fillRect(0, S * HZ, S, S * (1 - HZ));
    // 오른쪽 강물
    g.fillStyle = night ? '#162a4a' : '#4f9fd6';
    g.beginPath(); g.moveTo(S * 0.6, S * HZ); g.lineTo(S, S * HZ); g.lineTo(S, S); g.lineTo(S * 0.95, S); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5;
    for (var w = 0; w < 5; w++) { var wy = S * (0.5 + w * 0.09); g.beginPath(); g.ellipse(S * (0.85 + (w % 2) * 0.05), wy, S * 0.06, S * 0.008, 0, 0, 7); g.stroke(); }
    if (o.era === 'old') {
      // 공사 전 공터: 흙바닥 + 주황·흰 공사 펜스
      g.fillStyle = '#a57d52';
      g.beginPath(); g.moveTo(S * 0.3, S * HZ); g.lineTo(S * 0.6, S * HZ); g.lineTo(S * 0.95, S); g.lineTo(S * 0.0, S); g.closePath(); g.fill();
      g.fillStyle = 'rgba(80,55,30,.4)'; for (var p = 0; p < 10; p++) { g.beginPath(); g.arc(r.next() * S * 0.8, S * (0.55 + r.next() * 0.4), S * 0.01, 0, 7); g.fill(); }
      for (var fz = 0; fz < 6; fz++) {
        var fx = S * (0.05 + fz * 0.15), fy = S * 0.62, fw = S * 0.13, fh = S * 0.16;
        g.fillStyle = fz % 2 ? '#ffffff' : '#ef7d2d'; g.fillRect(fx, fy, fw, fh);
        g.strokeStyle = '#555'; g.lineWidth = 1.5; g.strokeRect(fx, fy, fw, fh);
      }
    } else {
      // 지금: 밝은 산책로 + 자전거길 줄 + 난간
      g.fillStyle = night ? '#4a4f6a' : '#e6dfcf';
      g.beginPath(); g.moveTo(S * 0.42, S * HZ); g.lineTo(S * 0.58, S * HZ); g.lineTo(S * 0.9, S); g.lineTo(S * 0.1, S); g.closePath(); g.fill();
      g.strokeStyle = night ? '#9fe8ff' : '#4fae5a'; g.lineWidth = S * 0.012; g.setLineDash([S * 0.04, S * 0.03]);
      g.beginPath(); g.moveTo(S * 0.5, S * HZ); g.lineTo(S * 0.5, S); g.stroke(); g.setLineDash([]);
      g.strokeStyle = night ? '#c9ced6' : '#5b6470'; g.lineWidth = S * 0.012;
      g.beginPath(); g.moveTo(S * 0.58, S * HZ); g.lineTo(S * 0.9, S); g.stroke();
      for (var q = 1; q < 7; q++) { var t = q / 7; g.beginPath(); g.moveTo(S * (0.58 + 0.32 * t), S * (HZ + (1 - HZ) * t)); g.lineTo(S * (0.58 + 0.32 * t), S * (HZ + (1 - HZ) * t) - S * 0.04 * (0.4 + t)); g.stroke(); }
      if (night) [0.25, 0.4].forEach(function (lx) {
        g.strokeStyle = '#3d3a5c'; g.lineWidth = 3; g.beginPath(); g.moveTo(S * lx, S * 0.75); g.lineTo(S * lx, S * 0.35); g.stroke();
        var gl = g.createRadialGradient(S * lx, S * 0.35, 0, S * lx, S * 0.35, S * 0.1); gl.addColorStop(0, 'rgba(255,220,140,.9)'); gl.addColorStop(1, 'rgba(255,220,140,0)');
        g.fillStyle = gl; g.fillRect(S * lx - S * 0.1, S * 0.25, S * 0.2, S * 0.2);
      });
    }
    // 나무
    [0.08, 0.22].forEach(function (tx) { g.fillStyle = night ? '#1f3b2a' : '#3f7d3c'; g.beginPath(); g.arc(S * tx, S * 0.4, S * 0.07, 0, 7); g.fill(); g.fillStyle = '#5a3d22'; g.fillRect(S * tx - S * 0.01, S * 0.44, S * 0.02, S * 0.08); });
  }
  function drawCrossing(g, S, o, r) {
    // 뒤의 학교 건물 + 시계
    g.fillStyle = '#e8d9b8'; g.fillRect(S * 0.12, S * 0.18, S * 0.76, S * 0.24);
    g.fillStyle = '#b5523b'; g.fillRect(S * 0.1, S * 0.16, S * 0.8, S * 0.03);
    windows(g, S * 0.12, S * 0.2, S * 0.76, S * 0.2, false, r);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(S * 0.5, S * 0.12, S * 0.04, 0, 7); g.fill(); g.strokeStyle = '#555'; g.lineWidth = 1.5; g.stroke();
    // 담장
    g.fillStyle = '#9aa0ad'; g.fillRect(0, S * 0.42, S, S * 0.04);
    // 보도 + 차도(가로)
    g.fillStyle = '#c3c0b8'; g.fillRect(0, S * 0.46, S, S * 0.54);
    g.fillStyle = '#5d616c'; g.fillRect(0, S * 0.6, S, S * 0.26);
    g.fillStyle = 'rgba(255,214,90,.9)'; g.fillRect(0, S * 0.725, S, S * 0.008);
    if (o.era === 'old') {
      // 철거 전 육교: 차도 위를 가로지르는 다리 + 양쪽 계단
      g.fillStyle = '#7f8796'; g.fillRect(S * 0.15, S * 0.5, S * 0.7, S * 0.05);
      g.fillStyle = '#9aa3b2'; g.fillRect(S * 0.15, S * 0.47, S * 0.7, S * 0.03);
      g.strokeStyle = '#5a6170'; g.lineWidth = S * 0.01;
      for (var b = 0; b < 8; b++) { g.beginPath(); g.moveTo(S * (0.17 + b * 0.095), S * 0.47); g.lineTo(S * (0.17 + b * 0.095), S * 0.44); g.stroke(); }
      [[0.15, -1], [0.85, 1]].forEach(function (p) {
        var x = S * p[0];
        g.fillStyle = '#7f8796';
        g.beginPath(); g.moveTo(x, S * 0.5); g.lineTo(x + p[1] * S * 0.12, S * 0.9); g.lineTo(x + p[1] * S * 0.17, S * 0.9); g.lineTo(x + p[1] * S * 0.05, S * 0.5); g.closePath(); g.fill();
        g.fillRect(x - S * 0.015, S * 0.55, S * 0.03, S * 0.31);
      });
    } else {
      // 지금: 횡단보도 줄무늬 + 신호등
      g.fillStyle = '#f4f4f4';
      for (var z = 0; z < 7; z++) g.fillRect(S * (0.2 + z * 0.09), S * 0.61, S * 0.05, S * 0.24);
      g.fillStyle = '#333'; g.fillRect(S * 0.86, S * 0.3, S * 0.02, S * 0.32);
      g.fillStyle = '#222'; g.fillRect(S * 0.83, S * 0.3, S * 0.08, S * 0.13);
      g.fillStyle = '#e8434a'; g.beginPath(); g.arc(S * 0.87, S * 0.335, S * 0.018, 0, 7); g.fill();
      g.fillStyle = '#4fdc7a'; g.beginPath(); g.arc(S * 0.87, S * 0.395, S * 0.018, 0, 7); g.fill();
    }
  }
  var VIEWS = { station: drawStation, market: drawMarket, river: drawRiver, crossing: drawCrossing };
  function drawStreetView(c, o, seed) {
    var S = c.width, g = c.getContext('2d'), r = rng(seed);
    viewSky(g, S, o, r);
    if (o.view !== 'market') drawBuildings(g, S, { time: o.time === 'night' ? 'night' : 'day' }, r, 'street');
    VIEWS[o.view](g, S, o, r);
    if (o.rain) {
      g.strokeStyle = 'rgba(200,220,240,.55)'; g.lineWidth = 1.2;
      for (var i = 0; i < 60; i++) { var x = r.next() * S, y = r.next() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x - S * 0.02, y + S * 0.06); g.stroke(); }
      g.fillStyle = 'rgba(160,190,220,.18)'; g.fillRect(0, S * 0.85, S, S * 0.15);
    }
  }

  // 길 안내 결과 컷: 지금의 거리 + 경로(초록 = 맞게 안내 / 빨강 점선 = 옛길로 안내), 위험 = 없는 육교로 안내 → 감독관 멈춤
  function route(g, S, col, dashed) {
    g.strokeStyle = col; g.lineWidth = S * 0.025; g.lineCap = 'round';
    if (dashed) g.setLineDash([S * 0.04, S * 0.03]);
    g.beginPath(); g.moveTo(S * 0.5, S * 0.98); g.quadraticCurveTo(S * 0.45, S * 0.7, dashed ? S * 0.18 : S * 0.55, S * 0.55); g.stroke();
    g.setLineDash([]);
    var ex = dashed ? S * 0.18 : S * 0.55, ey = S * 0.55;
    g.fillStyle = col; g.beginPath(); g.moveTo(ex, ey - S * 0.04); g.lineTo(ex - S * 0.035, ey + S * 0.02); g.lineTo(ex + S * 0.035, ey + S * 0.02); g.closePath(); g.fill();
  }
  function drawViewScene(c, mission, s, outcome, seed) {
    var S = c.width, g = c.getContext('2d');
    drawStreetView(c, Object.assign({}, s.art, { era: 'now' }), seed);
    if (outcome === 'pass') { route(g, S, '#5be3a1', false); badge(g, S, '#5be3a1', 'check'); }
    else if (outcome === 'inconvenience') {
      route(g, S, '#ff9f5a', true);
      // 헤매는 택배 기사 실루엣 + 물음표
      g.fillStyle = '#10093a'; g.beginPath(); g.arc(S * 0.2, S * 0.72, S * 0.035, 0, 7); g.fill(); g.fillRect(S * 0.175, S * 0.755, S * 0.05, S * 0.14);
      g.fillStyle = '#ff9f5a'; g.font = 'bold ' + Math.round(S * 0.08) + 'px sans-serif'; g.textAlign = 'center'; g.fillText('?', S * 0.2, S * 0.66);
      badge(g, S, '#ff9f5a', 'bar');
    } else if (outcome === 'danger') {
      // 없는 육교(흰 점선 윤곽) + 차도로 내려서려는 사람 + 감독관 멈춤 손
      if (s.art.view === 'crossing') {
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = S * 0.008; g.setLineDash([S * 0.02, S * 0.015]);
        g.strokeRect(S * 0.15, S * 0.47, S * 0.7, S * 0.08); g.setLineDash([]);
      } else route(g, S, '#ff5f6d', true);
      g.fillStyle = '#10093a';
      g.beginPath(); g.arc(S * 0.46, S * 0.56, S * 0.03, 0, 7); g.fill(); g.fillRect(S * 0.44, S * 0.59, S * 0.04, S * 0.12);
      g.beginPath(); g.arc(S * 0.3, S * 0.54, S * 0.045, 0, 7); g.fill();
      g.fillRect(S * 0.27, S * 0.585, S * 0.06, S * 0.18); g.fillRect(S * 0.33, S * 0.6, S * 0.1, S * 0.025);
      g.fillStyle = '#ff5f6d'; g.beginPath(); g.arc(S * 0.45, S * 0.612, S * 0.03, 0, 7); g.fill();
      badge(g, S, '#ff5f6d', 'bang');
    }
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
      else if (o.view) drawStreetView(c, o, seed);
      else if (o.place === 'pool' || o.place === 'fountain') drawPlace(c, o, seed);
      else if (o.object) drawObject(c, o, seed, variant);
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
        // 2 임무 분류함(이름표) 7종
        case 'can':
          g.fillStyle = '#cfd6de'; g.fillRect(m - S * 0.17, S * 0.26, S * 0.34, S * 0.5);
          g.fillStyle = '#e8434a'; g.fillRect(m - S * 0.17, S * 0.42, S * 0.34, S * 0.16);
          g.fillStyle = '#eef2f6'; g.beginPath(); g.ellipse(m, S * 0.26, S * 0.17, S * 0.06, 0, 0, 7); g.fill();
          g.fillStyle = '#9aa4ae'; g.beginPath(); g.ellipse(m, S * 0.76, S * 0.17, S * 0.05, 0, 0, Math.PI); g.fill();
          break;
        case 'pet':
          g.fillStyle = '#8fd3ff';
          g.beginPath(); g.moveTo(m - S * 0.06, S * 0.26); g.quadraticCurveTo(m - S * 0.17, S * 0.34, m - S * 0.17, S * 0.42);
          g.lineTo(m - S * 0.17, S * 0.84); g.lineTo(m + S * 0.17, S * 0.84); g.lineTo(m + S * 0.17, S * 0.42); g.quadraticCurveTo(m + S * 0.17, S * 0.34, m + S * 0.06, S * 0.26); g.fill();
          g.fillStyle = '#2f80ed'; g.fillRect(m - S * 0.08, S * 0.14, S * 0.16, S * 0.1);
          g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(m - S * 0.11, S * 0.46, S * 0.05, S * 0.3);
          break;
        case 'pack':
          g.fillStyle = '#f4f4ee'; g.fillRect(m - S * 0.18, S * 0.36, S * 0.36, S * 0.48);
          g.beginPath(); g.moveTo(m - S * 0.18, S * 0.36); g.lineTo(m, S * 0.16); g.lineTo(m + S * 0.18, S * 0.36); g.fill();
          g.fillStyle = '#25bdb0'; g.fillRect(m - S * 0.18, S * 0.62, S * 0.36, S * 0.22);
          break;
        case 'paper':
          g.fillStyle = '#c9b88f'; g.save(); g.translate(m + S * 0.04, m + S * 0.03); g.rotate(0.12); g.fillRect(-S * 0.24, -S * 0.3, S * 0.48, S * 0.6); g.restore();
          g.fillStyle = '#f2e6c9'; g.fillRect(m - S * 0.26, S * 0.18, S * 0.46, S * 0.6);
          g.fillStyle = '#7d7562'; for (var pl = 0; pl < 5; pl++) g.fillRect(m - S * 0.2, S * (0.28 + pl * 0.1), S * 0.32, S * 0.04);
          break;
        case 'vinyl':
          g.strokeStyle = '#f6c6d8'; g.lineWidth = S * 0.06;
          [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(m + s * S * 0.12, S * 0.34, S * 0.07, S * 0.12, 0, Math.PI, 2 * Math.PI); g.stroke(); });
          g.fillStyle = '#f6c6d8';
          g.beginPath(); g.moveTo(m - S * 0.22, S * 0.34); g.lineTo(m + S * 0.22, S * 0.34); g.quadraticCurveTo(m + S * 0.3, S * 0.7, m + S * 0.24, S * 0.84); g.lineTo(m - S * 0.24, S * 0.84); g.quadraticCurveTo(m - S * 0.3, S * 0.7, m - S * 0.22, S * 0.34); g.fill();
          g.strokeStyle = 'rgba(120,60,90,.5)'; g.lineWidth = S * 0.03; g.beginPath(); g.moveTo(m - S * 0.08, S * 0.5); g.lineTo(m + S * 0.02, S * 0.68); g.stroke();
          break;
        case 'battery':
          g.fillStyle = '#5be3a1'; g.fillRect(m - S * 0.13, S * 0.26, S * 0.26, S * 0.58);
          g.fillStyle = '#e8edf2'; g.fillRect(m - S * 0.06, S * 0.17, S * 0.12, S * 0.09);
          g.fillStyle = '#1a1240'; g.fillRect(m - S * 0.08, S * 0.44, S * 0.16, S * 0.05); g.fillRect(m - S * 0.025, S * 0.385, S * 0.05, S * 0.16);
          break;
        case 'trash':
          g.fillStyle = '#b8bcc6';
          g.beginPath(); g.moveTo(m - S * 0.2, S * 0.32); g.lineTo(m + S * 0.2, S * 0.32); g.lineTo(m + S * 0.15, S * 0.86); g.lineTo(m - S * 0.15, S * 0.86); g.fill();
          g.fillRect(m - S * 0.25, S * 0.22, S * 0.5, S * 0.07); g.fillRect(m - S * 0.07, S * 0.15, S * 0.14, S * 0.07);
          g.strokeStyle = '#1a1240'; g.lineWidth = S * 0.035;
          [-0.08, 0, 0.08].forEach(function (f) { g.beginPath(); g.moveTo(m + S * f, S * 0.42); g.lineTo(m + S * f, S * 0.76); g.stroke(); });
          break;
        // 3 임무 장소 이름표 4종
        case 'station':
          g.fillStyle = '#c9b79a'; g.fillRect(m - S * 0.28, S * 0.42, S * 0.56, S * 0.34);
          g.fillStyle = '#8a6d4d'; g.beginPath(); g.moveTo(m - S * 0.34, S * 0.42); g.lineTo(m, S * 0.18); g.lineTo(m + S * 0.34, S * 0.42); g.closePath(); g.fill();
          g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(m, S * 0.34, S * 0.07, 0, 7); g.fill();
          g.fillStyle = '#1a1240'; g.fillRect(m - S * 0.07, S * 0.56, S * 0.14, S * 0.2);
          break;
        case 'market':
          for (var ms = 0; ms < 5; ms++) { g.fillStyle = ms % 2 ? '#ffffff' : '#e8434a'; g.fillRect(S * 0.16 + ms * S * 0.136, S * 0.24, S * 0.136, S * 0.16); }
          g.fillStyle = '#e8d9b8'; g.fillRect(S * 0.2, S * 0.4, S * 0.6, S * 0.36);
          g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(S * 0.36, S * 0.56, S * 0.06, 0, 7); g.arc(S * 0.62, S * 0.56, S * 0.06, 0, 7); g.fill();
          break;
        case 'river':
          g.strokeStyle = '#4fb3ff'; g.lineWidth = S * 0.07;
          for (var rw = 0; rw < 2; rw++) { var ry = S * (0.6 + rw * 0.16); g.beginPath(); g.moveTo(S * 0.14, ry); g.quadraticCurveTo(S * 0.32, ry - S * 0.08, S * 0.5, ry); g.quadraticCurveTo(S * 0.68, ry + S * 0.08, S * 0.86, ry); g.stroke(); }
          g.fillStyle = '#4fae5a'; g.beginPath(); g.arc(S * 0.3, S * 0.32, S * 0.11, 0, 7); g.fill();
          g.fillStyle = '#e6dfcf'; g.fillRect(S * 0.5, S * 0.3, S * 0.36, S * 0.06);
          break;
        case 'crossing':
          g.fillStyle = '#5d616c'; g.fillRect(S * 0.12, S * 0.3, S * 0.76, S * 0.46);
          g.fillStyle = '#f4f4f4'; for (var cz = 0; cz < 4; cz++) g.fillRect(S * (0.18 + cz * 0.17), S * 0.36, S * 0.09, S * 0.34);
          g.fillStyle = '#4fdc7a'; g.beginPath(); g.arc(S * 0.82, S * 0.2, S * 0.07, 0, 7); g.fill();
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
      if (s.art.place === 'sorting') { drawSorting(c, mission, s, outcome, seed); return c; }
      if (s.art.view) { drawViewScene(c, mission, s, outcome, seed); return c; }
      if (s.art.place === 'shelter') {
        drawAnimal(c, { animal: 'dog' }, seed);
        var half = canvas(Math.round(S * 0.55)); drawAnimal(half, { animal: 'cat', noBg: true }, seed + 1);
        g.drawImage(half, S * 0.45, S * 0.45);
      } else {
        drawRoad(c, Object.assign({ car: false }, s.art, outcome === 'inconvenience' ? s.art.inconvenience : null), seed);
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
  /* ---------- 2 임무 선별장 컷: 컨베이어·분류함·압착기, 사람은 실루엣 ---------- */
  var BIN_COLORS = { can: '#d9534f', pet: '#3a8fd9', pack: '#25bdb0', paper: '#c9a227', vinyl: '#d977a8', battery: '#2fae6b', trash: '#7d8290' };

  // 판 없이 물건만(컷·컨베이어에 얹는 용도)
  function sprite(mission, id, size, variant) {
    variant = variant || 0;
    return cached('sprite|' + mission.id + '|' + id + '|' + variant + '|' + size, function () {
      var o = artOf(mission, id), c = canvas(size), seed = hash(id) + variant * 7919;
      if (o.animal) drawAnimal(c, Object.assign({}, o, { noBg: true }), seed);
      else drawObject(c, Object.assign({}, o, { noBg: true }), seed, variant);
      return c;
    });
  }
  function truthLabelOf(mission, id) {
    if (mission.cardTypes[id]) return mission.cardTypes[id].label;
    var f = (mission.fakes || []).filter(function (x) { return x.id === id; })[0];
    return f && f.truth ? mission.cardTypes[f.truth].label : 'trash';
  }
  function drawBin(g, S, mission, label, x, y, w) {
    g.fillStyle = BIN_COLORS[label] || '#888';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w * 0.92, y + w * 0.95); g.lineTo(x + w * 0.08, y + w * 0.95); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - w * 0.04, y - w * 0.08, w * 1.08, w * 0.1);
    var ic = w * 0.46;
    g.drawImage(icon(label, 64), x + (w - ic) / 2, y + w * 0.24, ic, ic);
  }
  function silhouette(g, S, x, y, k, arm) {
    g.fillStyle = '#10093a';
    g.beginPath(); g.arc(x, y, S * 0.045 * k, 0, 7); g.fill();
    g.fillRect(x - S * 0.035 * k, y + S * 0.05 * k, S * 0.07 * k, S * 0.2 * k);
    if (arm) { g.save(); g.translate(x, y + S * 0.08 * k); g.rotate(arm); g.fillRect(0, -S * 0.012 * k, S * 0.13 * k, S * 0.026 * k); g.restore(); }
  }
  function flames(g, S, x, y, r) {
    for (var i = 0; i < 7; i++) {
      var fx = x + (r.next() - 0.5) * S * 0.14, fh = S * (0.09 + r.next() * 0.12);
      g.fillStyle = i % 2 ? '#ffd24a' : '#ff6a3d';
      g.beginPath(); g.moveTo(fx - S * 0.035, y); g.quadraticCurveTo(fx - S * 0.015, y - fh * 0.6, fx, y - fh); g.quadraticCurveTo(fx + S * 0.015, y - fh * 0.6, fx + S * 0.035, y); g.fill();
    }
    g.fillStyle = '#ffd24a';
    for (var k = 0; k < 8; k++) { g.beginPath(); g.arc(x + (r.next() - 0.5) * S * 0.2, y - r.next() * S * 0.18, S * 0.008, 0, 7); g.fill(); }
  }

  function drawSorting(c, mission, s, outcome, seed) {
    var S = c.width, g = c.getContext('2d'), r = rng(seed);
    var grd = g.createLinearGradient(0, 0, 0, S * 0.62);
    grd.addColorStop(0, '#2c3150'); grd.addColorStop(1, '#4b5274');
    g.fillStyle = grd; g.fillRect(0, 0, S, S);
    for (var i = 0; i < 4; i++) { g.fillStyle = 'rgba(255,236,170,.85)'; g.fillRect(S * (0.06 + i * 0.25), S * 0.05, S * 0.14, S * 0.022); }
    g.fillStyle = '#585c6c'; g.fillRect(0, S * 0.62, S, S * 0.38);
    g.fillStyle = 'rgba(255,255,255,.06)'; for (var t = 0; t < 5; t++) g.fillRect(0, S * (0.66 + t * 0.07), S, 1);
    // 압착기(오른쪽 끝) — 입구에 노랑·검정 경고 줄무늬
    g.fillStyle = '#3c3f4a'; g.fillRect(S * 0.8, S * 0.18, S * 0.2, S * 0.44);
    for (var st = 0; st < 6; st++) { g.fillStyle = st % 2 ? '#1b1b1b' : '#f2c14e'; g.fillRect(S * 0.8, S * (0.18 + st * 0.03), S * 0.025, S * 0.03); }
    g.fillStyle = '#2a2c34'; g.fillRect(S * 0.83, S * 0.3, S * 0.14, S * 0.12);
    // 컨베이어 벨트
    var by = S * 0.4, bh = S * 0.08;
    g.fillStyle = '#7a7f8e'; g.fillRect(S * 0.06, by + bh, S * 0.02, S * 0.22); g.fillRect(S * 0.7, by + bh, S * 0.02, S * 0.22);
    g.fillStyle = '#24262f'; g.fillRect(0, by, S * 0.8, bh);
    g.strokeStyle = '#3a3d48'; g.lineWidth = 2;
    for (var x = S * 0.02; x < S * 0.8; x += S * 0.05) { g.beginPath(); g.moveTo(x, by); g.lineTo(x, by + bh); g.stroke(); }
    g.fillStyle = '#9aa0ad'; for (var rx = S * 0.04; rx < S * 0.8; rx += S * 0.09) { g.beginPath(); g.arc(rx, by + bh, S * 0.014, 0, 7); g.fill(); }

    var focus = (s.art.focus || []).slice(0, 2);
    var labels = [];
    focus.forEach(function (id) { var l = truthLabelOf(mission, id); if (labels.indexOf(l) < 0) labels.push(l); });
    if (s.art.wrongBin && labels.indexOf(s.art.wrongBin) < 0) labels.push(s.art.wrongBin); // 불편 컷에서 물건이 잘못 들어간 함(컷 문구와 맞춤)
    ['trash', 'paper', 'can'].forEach(function (l) { if (labels.length < 3 && labels.indexOf(l) < 0) labels.push(l); });
    var bw = S * 0.2, binX = [S * 0.06, S * 0.32, S * 0.58], binY = S * 0.72;
    labels.forEach(function (l, k) { drawBin(g, S, mission, l, binX[k], binY, bw); });
    var size = S * 0.27;
    function on(id, x, y, k) { var sp = sprite(mission, id, 256); g.drawImage(sp, x - size * k / 2, y - size * k / 2, size * k, size * k); }
    function atBin(id, label, k) { var bi = labels.indexOf(label); on(id, binX[bi] + bw / 2, binY - S * 0.03, k || 0.8); }

    if (outcome === 'neutral') {
      focus.forEach(function (id, k) { on(id, S * (0.2 + k * 0.3), by - size * 0.32, 1); });
    } else if (outcome === 'pass') {
      focus.forEach(function (id) { atBin(id, truthLabelOf(mission, id)); });
      badge(g, S, '#5be3a1', 'check');
    } else if (outcome === 'inconvenience') {
      var id0 = focus[0], right = truthLabelOf(mission, id0);
      var wrong = s.art.wrongBin || labels.filter(function (l) { return l !== right; })[0];
      atBin(id0, wrong);
      if (focus[1]) on(focus[1], S * 0.4, by - size * 0.32, 1);
      var wb = labels.indexOf(wrong);
      g.strokeStyle = '#ff9f5a'; g.lineWidth = S * 0.014; g.beginPath(); g.arc(binX[wb] + bw / 2, binY - S * 0.03, size * 0.48, 0, 7); g.stroke();
      silhouette(g, S, binX[wb] + bw + S * 0.06, S * 0.6, 1.1, 2.6);
      badge(g, S, '#ff9f5a', 'bar');
    } else if (outcome === 'danger') {
      if (focus[0]) on(focus[0], S * 0.3, by - size * 0.32, 1);
      var bat = mission.cardTypes.battery_aa ? 'battery_aa' : focus[1];
      on(bat, S * 0.86, S * 0.36, 0.7);
      flames(g, S, S * 0.86, S * 0.3, r);
      // 비상 정지 버튼(기둥 위 빨간 버튼) + 감독관 멈춤 손
      g.fillStyle = '#7a7f8e'; g.fillRect(S * 0.6, S * 0.26, S * 0.02, S * 0.36);
      g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(S * 0.61, S * 0.24, S * 0.045, 0, 7); g.fill();
      g.fillStyle = '#ff3b4a'; g.beginPath(); g.arc(S * 0.61, S * 0.24, S * 0.03, 0, 7); g.fill();
      silhouette(g, S, S * 0.5, S * 0.18, 1.1, -0.35);
      badge(g, S, '#ff5f6d', 'bang');
    }
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

  var api = { card: card, thumb: thumb, icon: icon, clue: clue, scene: scene, sprite: sprite, binColors: BIN_COLORS };
  root.DR = root.DR || {};
  root.DR.CardArt = api;
})(window);
