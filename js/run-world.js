/*
 * 달리기 무대 「도시 위를 잇는 빛의 다리」(설계 docs/specs/2026-11-07-run-bridge-world-design.md).
 * 하늘·지평선 도시 = #run-stage 안 캔버스 뒤의 CSS 층(.rw-layer) — file://로 더블클릭해 열어도 그림을 WebGL 텍스처로
 * 올리지 않으므로 브라우저 보안에 막히지 않는다(시작 화면과 같은 방식).
 * 다리 상판·레인·가장자리 빛·다리 아래 불빛·스파크 = three.js. 색·구역 모습 = DR.BridgeLook.
 * 코스·판정과 관계없다(겉모습만). 쓰는 곳: run3d.js(start·animate·stop·peek), run-scenery.js(구역 look).
 */
(function (root) {
  'use strict';
  var ART = { night: ['assets/title/bg-sky.webp', 'assets/title/bg-far.webp', 'assets/title/bg-mid.webp'],
    day: ['assets/title/bg-sky-day.webp', 'assets/title/bg-far-day.webp', 'assets/title/bg-mid-day.webp'] };
  var TILE = 2560 / 720;   // far·mid 그림 한 장의 가로/세로
  var N_LIGHTS = 500, N_LIGHTS_LOW = 200, LIGHT_SPAN = 160, N_SPARKS = 6;

  function hex(h) { return parseInt(h.slice(1), 16); }

  function create(view, stage, opts) {
    var THREE = root.THREE, BL = root.DR.BridgeLook, time = opts.time === 'day' ? 'day' : 'night';
    var P = BL.PALETTE[time], moving = !(opts.low || opts.reduced);
    var scene = view.scene, made = [], cur = null, horizon = null, rainOn = false;

    /* ---------- CSS 층(캔버스 뒤) ---------- */
    stage.classList.add('rw-on', 'rw-' + time);
    var canvas = stage.querySelector('canvas'), layers = {};
    ['sky', 'far', 'mid', 'tint', 'rain'].forEach(function (k, i) {
      var el = document.createElement('div');
      el.className = 'rw-layer rw-' + k; el.setAttribute('aria-hidden', 'true');
      if (i < 3) {
        el.style.backgroundImage = 'url("' + ART[time][i] + '")';
        var probe = new Image();
        probe.onerror = function () { el.hidden = true; }; // 그림을 못 읽으면 그 층만 숨김 → #run-stage 바탕이 단색 하늘
        probe.src = ART[time][i];
      }
      stage.insertBefore(el, canvas);
      layers[k] = el;
    });
    if (!moving) stage.classList.add('rw-still');

    /* ---------- 3D: 기본 바닥·격자·상자 빌딩을 숨기고 다리로 ---------- */
    scene.background = null;
    scene.fog.color.setHex(hex(P.fog));
    view.ground.visible = false;
    view.buildings.forEach(function (b) { b.visible = false; });
    var W = opts.laneWidth * 3 + 1.2;
    function deckTex(wet) {
      var c = document.createElement('canvas'); c.width = 128; c.height = 64;
      var g = c.getContext('2d');
      g.fillStyle = P.deck; g.fillRect(0, 0, 128, 64);
      g.fillStyle = P.seam; g.fillRect(0, 0, 128, 1); // 철판 이음매(줄 간격마다 하나, 아주 흐리게)
      if (wet) { // 젖은 네온 반사: 레인 바깥 여백(가장자리 안쪽)에만, 흐리게 — 카드·벽이 서는 레인 위에는 없다
        var margin = Math.max(2, Math.floor(128 * 0.6 / W) - 1);
        g.globalAlpha = P.reflectOpacity;
        g.fillStyle = P.reflect[0]; g.fillRect(1, 0, margin, 64);
        g.fillStyle = P.reflect[1]; g.fillRect(127 - margin, 0, margin, 64);
        g.globalAlpha = 1;
      }
      var t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.copy(view.road.material.map.repeat);
      made.push(t);
      return t;
    }
    var tex = {};
    function setDeck(wet) {
      var k = wet ? 'wet' : 'dry';
      if (!tex[k]) tex[k] = deckTex(wet);
      view.road.material.map = tex[k]; view.road.material.needsUpdate = true;
    }
    // 레인 줄: 안쪽 2개 가늘고 흐리게, 바깥 2개 = 다리 가장자리(가장 밝은 빛)
    view.lines.children.forEach(function (m, i) {
      var edge = i === 0 || i === 3;
      m.material.transparent = true;
      m.material.color.setHex(hex(edge ? P.edge : P.lane));
      m.material.opacity = edge ? P.edgeOpacity : P.laneOpacity;
      m.scale.x = edge ? 1.4 : 0.6;
    });
    // 상판 옆면(두께) + 옆면 아래 빛 선
    [-1, 1].forEach(function (side) {
      var len = opts.roadLen;
      var wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, len), new THREE.MeshBasicMaterial({ color: hex(P.side) }));
      wall.position.set(side * W / 2, -0.36, 0); view.lines.add(wall); made.push(wall.geometry, wall.material);
      var glow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), new THREE.MeshBasicMaterial({ color: hex(P.edge), transparent: true, opacity: P.edgeOpacity * 0.6 }));
      glow.position.set(side * (W / 2 + 0.07), -0.7, 0); view.lines.add(glow); made.push(glow.geometry, glow.material);
    });

    // 노이즈 벽: 팔레트의 벽 색·불투명도(낮 바닥 위에서도 보이게 — 밤은 원래 그대로)
    view.wallOpacity = P.wall.opacity;
    if (time === 'day' && view.wallTex && view.wallTex.image) {
      var wg = view.wallTex.image.getContext('2d'), ww = view.wallTex.image.width, wh = view.wallTex.image.height;
      for (var wy = 0; wy < wh; wy += 2) for (var wx = 0; wx < ww; wx += 2) { var r = Math.random(); wg.fillStyle = r < 0.3 ? P.wall.noise[0] : r < 0.65 ? P.wall.noise[1] : P.wall.noise[2]; wg.fillRect(wx, wy, 2, 2); }
      view.wallTex.needsUpdate = true;
    }
    // 다리 아래 도시 불빛(작고 어둡게 — 카드 높이·레인 위로 오지 않는다)
    var n = opts.low ? N_LIGHTS_LOW : N_LIGHTS, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    var seed = 1;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < n; i++) {
      var side = rnd() < 0.5 ? -1 : 1;
      pos[i * 3] = side * (W / 2 + 3 + rnd() * 60);
      pos[i * 3 + 1] = -3 - rnd() * 11;
      pos[i * 3 + 2] = -rnd() * LIGHT_SPAN;
    }
    var lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var lmat = new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: P.lightOpacity, depthWrite: false });
    var lights = new THREE.Points(lgeo, lmat); lights.frustumCulled = false; scene.add(lights);
    made.push(lgeo, lmat);
    function paintLights(mix) {
      var cs = P.lights.map(function (h) { return new THREE.Color(hex(h)); }), a = mix[0], b = mix[0] + mix[1];
      for (var j = 0; j < n; j++) {
        var f = (j * 0.618034) % 1, c = f < a ? cs[0] : f < b ? cs[1] : cs[2];
        col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
      }
      lgeo.attributes.color.needsUpdate = true;
    }

    // 끊어진 케이블 스파크(다리 바깥 양옆, 가끔 깜빡) — 움직임 줄이기·저사양에선 없음
    var sparks = [];
    if (moving) {
      var smat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9 }), sgeo = new THREE.SphereGeometry(0.09, 6, 4);
      made.push(smat, sgeo);
      for (var s = 0; s < N_SPARKS; s++) {
        var sp = new THREE.Mesh(sgeo, smat);
        sp.position.set((s % 2 ? 1 : -1) * (W / 2 + 1.5 + rnd() * 3), 0.6 + rnd() * 2.2, -20 - s * 22);
        sp.visible = false; scene.add(sp); sparks.push(sp);
      }
    }

    /* ---------- 공개 ---------- */
    var far = 0, mid = 0, lastZ = 0;
    function look(zoneId) {
      var L = BL.look(opts.missionId, zoneId);
      if (cur && cur.id === L.id) return;
      cur = L;
      layers.tint.style.backgroundColor = L.tint || 'transparent';
      rainOn = !!L.rain && moving;
      layers.rain.hidden = !rainOn;
      setDeck(!!L.wet);
      paintLights(L.lightMix);
    }
    function update(z, t) {
      var dz = z - lastZ; lastZ = z;
      for (var j = 0; j < n; j++) if (pos[j * 3 + 2] > -z + 10) pos[j * 3 + 2] -= LIGHT_SPAN;
      lgeo.attributes.position.needsUpdate = true;
      if (!moving) return;
      far += dz * 1.2; mid += dz * 3;
      [[layers.far, far], [layers.mid, mid]].forEach(function (p) {
        var tw = (p[0].clientHeight || 1) * TILE;
        p[0].style.transform = 'translateX(' + (-(p[1] % tw)).toFixed(1) + 'px)';
      });
      sparks.forEach(function (sp, k) {
        if (sp.position.z > -z + 6) sp.position.z -= 130;
        sp.visible = Math.sin(t * 7 + k * 2.3) > 0.82;
      });
    }
    function setHorizon(px) {
      if (horizon !== null && Math.abs(px - horizon) < 0.5) return;
      horizon = px;
      stage.style.setProperty('--rw-horizon', px.toFixed(1) + 'px');
    }
    function state() {
      return { time: time, look: cur ? cur.id : null, rain: rainOn, moving: moving, wallOpacity: view.wallOpacity,
        layers: stage.querySelectorAll('.rw-layer').length };
    }
    function dispose() {
      Object.keys(layers).forEach(function (k) { if (layers[k].parentNode) layers[k].parentNode.removeChild(layers[k]); });
      stage.classList.remove('rw-on', 'rw-night', 'rw-day', 'rw-still');
      stage.style.removeProperty('--rw-horizon');
      made.forEach(function (o) { if (o.dispose) o.dispose(); });
      made = [];
    }
    return { look: look, update: update, setHorizon: setHorizon, state: state, dispose: dispose };
  }

  root.DR = root.DR || {};
  // 브리핑 때 그 임무의 다리 그림을 미리 받아 둔다(한 번만, 기다리지 않음 — app.js go)
  var preloaded = {};
  function preload(mission) {
    if (!mission || !mission.world) return;
    var t = mission.worldTime === 'day' ? 'day' : 'night';
    if (preloaded[t]) return;
    preloaded[t] = true;
    ART[t].forEach(function (src) { new Image().src = src; });
  }
  root.DR.RunWorld = { create: create, preload: preload };
})(window);
