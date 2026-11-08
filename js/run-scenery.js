/* 구역별 무대 소품. 코스와 판정에 관여하지 않는다.
 * 임무의 scenery가 'sorting'이면 선별장(옆 컨베이어 벨트·분류함·조명, 구역마다 하늘색·분류함 색), 아니면 1 임무 거리(그대로).
 * 2차 실내 무대(view.world가 실내 — 2·4 임무): 하늘·안개·벽 그림·바닥은 js/run-world.js(구역 look), 여기선 옆·위 소품만.
 *   소품은 모두 벨트(레인) 바깥 x 또는 카드보다 높은 곳 — 레인 위에는 아무것도 두지 않는다. 움직임은 은은하게, ?low=1·움직임 줄이기면 멈춤.
 *   opts = { course, lanes, roadW, low, reduced }(run3d.js start). */
(function (root) {
  'use strict';
  function create(view, mission, opts) {
    opts = opts || {};
    var indoor = !!(view.world && view.world.indoor);
    if (mission && mission.scenery === 'bridge') return bridge(view, mission);
    if (mission && mission.scenery === 'sorting') return sorting(view, mission, indoor ? opts : null);
    if (mission && mission.scenery === 'city') return city(view, mission);
    if (mission && mission.scenery === 'exam') return indoor ? grading(view, mission, opts) : exam(view, mission);
    return street(view);
  }

  function box(w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: color }));
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  // 답안지 위 채점 기호(○·✕ — 글자·숫자 없음). 한 번 만들어 모든 달리기가 같이 쓴다
  var MARKS = null;
  function marks() {
    if (MARKS) return MARKS;
    MARKS = ['o', 'x'].map(function (k) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var g = c.getContext('2d'); g.strokeStyle = '#d23a3a'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath();
      if (k === 'o') g.arc(32, 32, 20, 0, Math.PI * 2); else { g.moveTo(14, 14); g.lineTo(50, 50); g.moveTo(50, 14); g.lineTo(14, 50); }
      g.stroke();
      return new THREE.CanvasTexture(c);
    });
    return MARKS;
  }

  // 4 임무 실내(2차): 채점 센터(S1~S3) → 교무실(S4). 옆 벨트에 흐르는 답안지·도장 기계팔, 구역 경계 = 스캐너 문, S4 = 교무실 문 + 책상·캐비닛·묶인 옛 답안지.
  //   천장 조명(채점 센터 조명줄·교무실 형광등)은 벽 그림에 있다 — 3D 막대는 머리 위를 지날 때 화면을 가로지르는 흰 줄로 보여 뺐다
  function grading(view, mission, opts) {
    var scene = view.scene, world = view.world, half = (opts.roadW || 10.8) / 2, moving = !(opts.low || opts.reduced);
    var course = opts.course || { zones: [], length: 0 }, zones = course.zones || [];
    var s4 = zones.filter(function (zn) { return zn.id === 'S4'; })[0], s4z = s4 ? s4.start : Infinity;
    var gRows = new THREE.Group(), oRows = new THREE.Group(), fixed = new THREE.Group(), gFrames = [], oFrames = [], sheets = [], heads = [];
    scene.add(gRows); scene.add(oRows); scene.add(fixed);
    var M = marks();
    for (var i = 0; i < 10; i++) {
      var gf = new THREE.Group(); gf.position.z = -i * 20;
      [-1, 1].forEach(function (side) {
        var bx = side * (half + 1.6);
        gf.add(box(1.6, 0.5, 20, 0x2b3650, bx, 0.25, -10));            // 옆 벨트(어두운 남색 — 흰 답안지가 묻히지 않게)
        gf.add(box(1.7, 0.06, 20, 0x8796ad, bx, 0.53, -10));            // 벨트 틀
        for (var k = 0; k < 3; k++) {
          var sh = box(1.0, 0.03, 1.3, 0xf4f3ec, bx, 0.58, -3 - k * 6.5);
          if (k) { var mk = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: M[k - 1], transparent: true })); mk.rotation.x = -Math.PI / 2; mk.position.y = 0.02; sh.add(mk); }
          gf.add(sh); sheets.push({ mesh: sh, z0: sh.position.z });
        }
        gf.add(box(0.35, 3.4, 0.35, 0xdfe4ea, side * (half + 3.4), 1.7, -10)); // 도장 기계팔: 기둥 · 팔 · 도장 머리
        gf.add(box(2.0, 0.22, 0.22, 0xc9d0da, side * (half + 2.5), 3.2, -10));
        var head = box(0.55, 0.5, 0.55, 0x5b6b85, bx, 2.4, -10); gf.add(head);
        heads.push({ mesh: head, phase: i * 0.9 + (side > 0 ? 1.4 : 0) });
      });
      gRows.add(gf); gFrames.push(gf);

      var of = new THREE.Group(); of.position.z = -i * 20;
      [-1, 1].forEach(function (side) {
        [-4, -14].forEach(function (dz) {
          of.add(box(1.4, 0.8, 2.2, 0x6e4f36, side * (half + 1.8), 0.4, dz)); // 교사 책상
          of.add(box(0.7, 0.3, 0.5, 0xe9dfc6, side * (half + 1.8), 0.95, dz + 0.4)); // 끈으로 묶은 옛 답안지
          of.add(box(0.72, 0.31, 0.06, 0x9c7a50, side * (half + 1.8), 0.95, dz + 0.4));
        });
        of.add(box(0.9, 2.0, 1.2, 0x6f9a83, side * (half + 3.4), 1.0, -9)); // 민트 캐비닛
        of.add(box(0.92, 0.04, 1.0, 0x4d7262, side * (half + 3.4), 1.3, -9));
      });
      oRows.add(of); oFrames.push(of);
    }
    // 구역 경계: 스캐너 문(채점 센터 구역 사이) · 교무실 문(S4). 기둥은 벨트 바깥, 윗보는 카드보다 훨씬 위
    zones.forEach(function (zn, k) {
      if (!k) return;
      var g = new THREE.Group(); g.position.z = -zn.start;
      if (zn.id === 'S4') {
        [-1, 1].forEach(function (side) { g.add(box(0.5, 6.4, 0.6, 0x8a6440, side * (half + 0.6), 3.2, 0)); });
        g.add(box(2 * half + 1.7, 0.6, 0.6, 0x8a6440, 0, 6.5, 0));
        var door = box(2.4, 5.6, 0.12, 0x9c7a55, half + 1.9, 2.8, 1.0); door.rotation.y = -1.1; g.add(door); // 활짝 열린 문
      } else {
        [-1, 1].forEach(function (side) {
          g.add(box(0.6, 6.6, 1.0, 0xe9edf2, side * (half + 0.6), 3.3, 0));
          g.add(box(0.08, 5.6, 0.12, 0x7fd8ff, side * (half + 0.28), 3.1, 0.45)); // 스캐너 빛(번쩍이지 않음)
        });
        g.add(box(2 * half + 2.4, 0.7, 1.0, 0xe9edf2, 0, 6.8, 0));
        g.add(box(2 * half, 0.08, 0.12, 0x7fd8ff, 0, 6.4, 0.45));
      }
      fixed.add(g);
    });
    // 교무실 바닥(S4 자리부터 끝까지 미리 깔아 둔다 — 들어서기 전에도 멀리 보이게). 벨트·바닥보다 살짝 앞에 그린다(레인 줄은 그 위)
    if (s4 && world.deckFor) {
      var len = Math.max(1, course.length - s4z + 40), t = world.deckFor('office'), op = world.palette('office');
      t.repeat.set(1, len / 4);
      var fl = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, len), new THREE.MeshBasicMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.002, -(s4z + len / 2)); fixed.add(fl);
      var gr = new THREE.Mesh(new THREE.PlaneGeometry(240, len), new THREE.MeshBasicMaterial({ color: parseInt(op.ground.slice(1), 16), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      gr.rotation.x = -Math.PI / 2; gr.position.set(0, -0.015, -(s4z + len / 2)); fixed.add(gr);
      view.officeFloor = { deck: fl, ground: gr };
    }
    var current = null;
    function update(id, z, t, reduced) {
      if (id !== current) { current = id; world.look(id); }
      var base = -Math.floor(z / 20) * 20 + 20;
      gRows.position.z = base; oRows.position.z = base;
      // 한 칸(20m)의 가운데가 S4 앞이면 채점 센터, 뒤면 교무실
      gFrames.forEach(function (f, k) { var d = -(base + f.position.z) + 10; f.visible = d < s4z; oFrames[k].visible = d >= s4z; });
      var still = !moving || reduced;
      sheets.forEach(function (s) { s.mesh.position.z = still ? s.z0 : s.z0 + ((t * 1.2) % 6.5); }); // 답안지가 옆 벨트를 따라 천천히
      heads.forEach(function (h) { var p = still ? 0 : Math.pow(Math.max(0, Math.sin(t * 2.2 + h.phase)), 6); h.mesh.position.y = 2.4 - 0.9 * p; }); // 도장 꾹(리듬 있게, 번쩍임 없음)
    }
    function state() {
      var w = world.state();
      return { zone: current, theme: 'exam', sky: w.look, room: w.room, s4: s4z, props: { minX: half + 0.8, sheets: sheets.length, heads: heads.length, gates: fixed.children.length },
        headY: heads.length ? heads[0].mesh.position.y : null, sheetZ: sheets.length ? sheets[0].mesh.position.z : null };
    }
    return { update: update, state: state };
  }

  // 4 임무 시험장: 양옆에 칠판(분필 줄 — 숫자·글자 없음)·교실 창틀, 구역마다 색만 바뀐다
  var EXAM = {
    S1: { sky: 0xc9d6dc, body: 0x6f8592, edges: [0xf4f1e6, 0xd6e8e9, 0x9fb4c8], board: 0x24513f, scale: 0.4 },
    S2: { sky: 0x8fa6bf, body: 0x4f6378, edges: [0xffd24a, 0xf4f1e6, 0x8fa8ff], board: 0x1f4a3a, scale: 0.5 },
    S3: { sky: 0xd8cfb0, body: 0x7d735c, edges: [0xff9f5a, 0xf4f1e6, 0xe8d9b8], board: 0x2b5a46, scale: 0.35 },
    S4: { sky: 0x6e6a8a, body: 0x3d3a55, edges: [0xe58bff, 0xf4f1e6, 0x7be0a0], board: 0x1a3d31, scale: 0.6 }
  };
  function exam(view, mission) {
    var scene = view.scene, rows = new THREE.Group(), boards = [];
    scene.add(rows);
    var chalk = new THREE.MeshBasicMaterial({ color: 0xe8efe6 });
    for (var i = 0; i < 10; i++) {
      var frame = new THREE.Group(); frame.position.z = -i * 20;
      [-1, 1].forEach(function (side) {
        var board = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 8), new THREE.MeshBasicMaterial({ color: 0x24513f }));
        board.position.set(side * 7.4, 3.6, -6);
        board.add(new THREE.LineSegments(new THREE.EdgesGeometry(board.geometry), new THREE.LineBasicMaterial({ color: 0x8a6d4d })));
        frame.add(board); boards.push(board);
        for (var k = 0; k < 3; k++) {
          var line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 4 + k * 1.2), chalk);
          line.position.set(side * 7.22, 4.6 - k * 0.8, -6 - k * 0.4); frame.add(line);
        }
        // 교실 창틀(빈 사각 틀)
        var win = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.1, 3, 5)), new THREE.LineBasicMaterial({ color: 0xd6e8e9 }));
        win.position.set(side * 7.6, 3.8, -15); frame.add(win);
      });
      rows.add(frame);
    }
    var current = null, sky = null;
    function update(id, z) {
      var look = EXAM[id] || EXAM.S1;
      if (id !== current) {
        current = id; sky = look.sky;
        scene.background = new THREE.Color(sky); scene.fog.color.setHex(sky);
        boards.forEach(function (b) { b.material.color.setHex(look.board); });
        view.buildings.forEach(function (b, i) {
          b.scale.y = look.scale; b.position.y = b.geometry.parameters.height * b.scale.y / 2;
          b.material.color.setHex(look.body); b.children[0].material.color.setHex(look.edges[i % look.edges.length]);
        });
      }
      rows.position.z = -Math.floor(z / 20) * 20 + 20;
    }
    return { update: update, state: function () { return { zone: current, theme: 'exam', sky: sky }; } };
  }

  function street(view) {
    var scene = view.scene, roofs = [], bridge = new THREE.Group(), puddles = new THREE.Group();
    scene.add(bridge); scene.add(puddles);
    view.buildings.forEach(function (b) {
      var p = b.geometry.parameters;
      var roof = new THREE.Mesh(new THREE.ConeGeometry(p.width * 0.8, 3, 4), new THREE.MeshBasicMaterial({ color: 0x587883, wireframe: true }));
      roof.rotation.y = Math.PI / 4; roof.position.y = p.height / 2 + 1.5; b.add(roof); roofs.push(roof);
    });
    for (var i = 0; i < 10; i++) {
      var frame = new THREE.Group(); frame.position.z = -i * 20;
      [-1, 1].forEach(function (side) {
        var pillar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 8, 2), new THREE.MeshBasicMaterial({ color: 0x334354 }));
        pillar.position.set(side * 6.5, 4, 0);
        pillar.add(new THREE.LineSegments(new THREE.EdgesGeometry(pillar.geometry), new THREE.LineBasicMaterial({ color: 0x739097 })));
        frame.add(pillar);
      });
      var deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 20), new THREE.MeshBasicMaterial({ color: 0x283443 })); deck.position.y = 8; frame.add(deck); bridge.add(frame);
      var pool = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color: 0x719cae, transparent: true, opacity: 0.4, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.scale.set(1.5, 2, 1); pool.position.set(i % 2 ? 2.7 : -2.7, 0.04, -i * 19); puddles.add(pool);
    }
    var positions = new Float32Array(180 * 6), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xb6d2e2, transparent: true, opacity: 0.5 })); rain.frustumCulled = false; scene.add(rain);
    var current = null;
    function update(id, z, t, reduced) {
      var day = id === 'S1' || id === 'S2';
      if (id !== current) {
        current = id;
        var sky = day ? (id === 'S1' ? 0xb6cfdb : 0xc9dce4) : id === 'S4' ? 0x101b28 : 0x17223f;
        scene.background = new THREE.Color(sky); scene.fog.color.setHex(sky);
        view.buildings.forEach(function (b, i) {
          b.scale.y = day ? (id === 'S1' ? 0.25 : 0.4) : 1;
          b.position.y = b.geometry.parameters.height * b.scale.y / 2;
          b.material.color.setHex(day ? 0x657f8d : 0x17223d);
          b.children[0].material.color.setHex(day ? 0xd6e8e9 : [0x69ccdc, 0x8a9cda, 0xb6a9d9][i % 3]);
          roofs[i].visible = id === 'S1';
        });
        bridge.visible = id === 'S4'; puddles.visible = !day; rain.visible = !day;
      }
      bridge.position.z = -Math.floor(z / 20) * 20 + 20;
      puddles.position.z = -Math.floor(z / 19) * 19 + 19;
      if (!day) {
        for (var j = 0; j < 180; j++) {
          var x = ((j * 73) % 220) / 10 - 11, y = 13 - ((j * 0.73 + (reduced ? 0 : t * 10)) % 13), d = (j * 17) % 95;
          positions.set([x, y, -z - d, x - 0.15, y - 0.85, -z - d + 0.1], j * 6);
        }
        geo.attributes.position.needsUpdate = true;
      }
    }
    return { update: update, state: function () { return { zone: current, theme: 'street' }; } };
  }

  // 2 임무 선별장: 구역(장면)마다 그 장면에 나오는 물건의 분류함 색으로 바뀐다
  var SORT_SKY = { S1: 0x2c2f4a, S2: 0x203a4a, S3: 0x3d3446, S4: 0x3e2430 };
  // opts가 있으면(2차 실내 무대) 하늘·안개는 run-world가, 소품은 실제 장소 색으로: 초록 옆 벨트·분류함(카드 테두리와 같은 색상, 어둡게·레인에서 멀리)·호퍼·경광등
  function sorting(view, mission, opts) {
    var scene = view.scene, binColors = (root.DR.CardArt && root.DR.CardArt.binColors) || {}, world = opts ? view.world : null;
    var line = new THREE.Group(), bins = [], lamps = [], beacons = [];
    var half = opts ? opts.roadW / 2 : 4.2, moving = !!opts && !(opts.low || opts.reduced);
    scene.add(line);
    for (var i = 0; i < 10; i++) {
      var frame = new THREE.Group(); frame.position.z = -i * 20;
      if (world) {
        var hs = i % 2 ? 1 : -1; // 머리 위 투입구(호퍼) — 분류함 위 바깥쪽, 번갈아(작게 — 벽 그림·창을 가리지 않게)
        var hop = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.25, 1.0, 4), new THREE.MeshBasicMaterial({ color: 0x8d939b }));
        hop.rotation.y = Math.PI / 4; hop.position.set(hs * (half + 3.8), 3.1, -4); frame.add(hop);
        frame.add(box(0.3, 0.6, 0.3, 0x6f757d, hs * (half + 3.8), 2.35, -4));
        if (i % 2 === 0) { // 경광등(천천히 도는 날개, 번쩍임 없음)
          var bs = -hs;
          frame.add(box(0.15, 2.6, 0.15, 0x5a5f66, bs * (half + 3.2), 1.3, -14));
          frame.add(box(0.36, 0.3, 0.36, 0xff8a1f, bs * (half + 3.2), 2.75, -14));
          var blade = box(0.7, 0.1, 0.08, 0xffc27a, bs * (half + 3.2), 2.75, -14); frame.add(blade); beacons.push(blade);
        }
      }
      [-1, 1].forEach(function (side) {
        var belt = new THREE.Mesh(new THREE.BoxGeometry(2, 0.45, 20), new THREE.MeshBasicMaterial({ color: world ? 0x2f6b3c : 0x23262f }));
        belt.position.set(side * 5.6, 1.1, 0);
        belt.add(new THREE.LineSegments(new THREE.EdgesGeometry(belt.geometry), new THREE.LineBasicMaterial({ color: 0x5a6070 })));
        frame.add(belt);
        for (var k = 0; k < 5; k++) {
          var roller = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.1, 8), new THREE.MeshBasicMaterial({ color: 0x9aa0ad }));
          roller.rotation.z = Math.PI / 2; roller.position.set(side * 5.6, 0.82, -8 + k * 4); frame.add(roller);
        }
        [-4, -14].forEach(function (bz) {
          var bin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.7), new THREE.MeshBasicMaterial({ color: 0x888888 }));
          bin.position.set(side * (world ? half + 3.8 : 7.7), 0.75, bz);
          bin.add(new THREE.LineSegments(new THREE.EdgesGeometry(bin.geometry), new THREE.LineBasicMaterial({ color: 0x10093a })));
          frame.add(bin); bins.push(bin);
        });
      });
      var lamp = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 0.7), new THREE.MeshBasicMaterial({ color: world ? 0xfff4d6 : 0xffe9a8 }));
      lamp.position.set(0, 11, -10); frame.add(lamp); lamps.push(lamp);
      lamp.visible = !world; // 실내: 천장 조명은 벽 그림에 있다(3D 조명 막대는 지나갈 때 화면을 가로지르는 흰 줄로 보여서 뺌)
      line.add(frame);
    }
    function labelOf(id) {
      if (mission.cardTypes[id]) return mission.cardTypes[id].label;
      var f = (mission.fakes || []).filter(function (x) { return x.id === id; })[0];
      return f && f.truth ? mission.cardTypes[f.truth].label : 'trash';
    }
    function zoneColors(id) {
      var sc = mission.scenes.filter(function (x) { return x.id === id; })[0], labels = [];
      ((sc && sc.art && sc.art.focus) || []).forEach(function (fid) { var l = labelOf(fid); if (labels.indexOf(l) < 0) labels.push(l); });
      if (sc && sc.art && sc.art.wrongBin && labels.indexOf(sc.art.wrongBin) < 0) labels.push(sc.art.wrongBin);
      if (!labels.length) labels.push('trash');
      return labels.map(function (l) { return binColors[l] || '#888888'; });
    }
    var current = null, sky = null, binCols = [];
    function update(id, z, t, reduced) {
      if (world) beacons.forEach(function (b) { if (moving && !reduced) b.rotation.y = t * 1.6; });
      if (id !== current) {
        current = id;
        var cols = zoneColors(id);
        binCols = world ? cols.map(function (c) { return root.DR.BridgeLook.dimBin(c); }) : cols; // 구역 신호(분류함 색)는 그대로 — 실내는 어둡게
        bins.forEach(function (b, i) { b.material.color.set(binCols[i % binCols.length]); });
        if (world) { world.look(id); sky = world.state().look; line.position.z = -Math.floor(z / 20) * 20 + 20; return; }
        sky = SORT_SKY[id] || 0x2c2f4a;
        scene.background = new THREE.Color(sky); scene.fog.color.setHex(sky);
        view.buildings.forEach(function (b, i) {
          b.scale.y = 0.6; b.position.y = b.geometry.parameters.height * b.scale.y / 2;
          b.material.color.setHex(0x2a2e44);
          b.children[0].material.color.set(cols[i % cols.length]);
        });
      }
      line.position.z = -Math.floor(z / 20) * 20 + 20;
    }
    return { update: update, state: function () { return { zone: current, theme: 'sorting', sky: sky, bins: binCols.slice(), props: { minX: half + 0.4, beacons: beacons.length }, beacon: beacons.length ? beacons[0].rotation.y : null }; } };
  }
  var CITY = {
    S1: { sky: 0xb6cfdb, body: 0x657f8d, edges: [0xd9a066, 0xf4e1c1, 0xd6e8e9], scale: 0.55 },
    S2: { sky: 0x6a4a6e, body: 0x3a2c3e, edges: [0xffcf5a, 0xe86a5a, 0xffe2a8], scale: 0.35 },
    S3: { sky: 0x9fd0e6, body: 0x5f8a8f, edges: [0x4fb3ff, 0xd6f0ff, 0x9fe8b0], scale: 0.3 },
    S4: { sky: 0x7f8ea0, body: 0x4a5566, edges: [0xb0b6c3, 0xe8d9b8, 0x9fe8ff], scale: 0.45 }
  };
  function city(view, mission) {
    var scene = view.scene, lanterns = new THREE.Group(), river = new THREE.Group();
    scene.add(lanterns); scene.add(river);
    for (var i = 0; i < 10; i++) {
      var row = new THREE.Group(); row.position.z = -i * 20;
      for (var k = 0; k < 4; k++) {
        var l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xffcf5a : 0xe86a5a }));
        l.position.set(-3 + k * 2, 6.2 + (k % 2) * 0.4, -5); row.add(l);
      }
      lanterns.add(row);
      var water = new THREE.Mesh(new THREE.PlaneGeometry(10, 20), new THREE.MeshBasicMaterial({ color: 0x3f8fc7, transparent: true, opacity: 0.85 }));
      water.rotation.x = -Math.PI / 2; water.position.set(10, 0.03, -i * 20); river.add(water);
    }
    var positions = new Float32Array(160 * 6), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc6dbe8, transparent: true, opacity: 0.55 })); rain.frustumCulled = false; scene.add(rain);
    // 빛의 다리 낮 버전(view.world, 2026-11-07): 하늘·안개·비는 다리(js/run-world.js)가 맡고, 여기선 구역 소품만 — 강물은 다리 아래로
    var onBridge = !!view.world;
    if (onBridge) river.children.forEach(function (w) { w.position.y = -6; });
    var current = null, sky = null;
    function update(id, z, t, reduced) {
      var look = CITY[id] || CITY.S1;
      if (id !== current) {
        current = id; sky = look.sky;
        if (onBridge) view.world.look(id);
        else {
          scene.background = new THREE.Color(sky); scene.fog.color.setHex(sky);
          view.buildings.forEach(function (b, i) {
            b.scale.y = look.scale; b.position.y = b.geometry.parameters.height * b.scale.y / 2;
            b.material.color.setHex(look.body); b.children[0].material.color.setHex(look.edges[i % look.edges.length]);
          });
        }
        lanterns.visible = id === 'S2'; river.visible = id === 'S3'; rain.visible = id === 'S4' && !onBridge;
      }
      lanterns.position.z = -Math.floor(z / 20) * 20 + 20;
      river.position.z = -Math.floor(z / 20) * 20 + 20;
      if (rain.visible) {
        for (var j = 0; j < 160; j++) {
          var x = ((j * 73) % 220) / 10 - 11, y = 13 - ((j * 0.73 + (reduced ? 0 : t * 10)) % 13), d = (j * 17) % 95;
          positions.set([x, y, -z - d, x - 0.15, y - 0.85, -z - d + 0.1], j * 6);
        }
        geo.attributes.position.needsUpdate = true;
      }
    }
    return { update: update, state: function () { return { zone: current, theme: 'city', sky: sky }; } };
  }
  // 빛의 다리(1 임무 등, js/run-world.js): 구역마다 하늘 색조·다리 아래 불빛 비율만 바꾼다(DR.BridgeLook). 하늘 색·안개는 다리가 맡는다
  function bridge(view) {
    var current = null;
    function update(id) { if (id !== current) { current = id; if (view.world) view.world.look(id); } }
    return { update: update, state: function () { return { zone: current, theme: 'bridge', look: view.world ? view.world.state().look : null }; } };
  }
  root.DR.RunScenery = { create: create };
})(window);
