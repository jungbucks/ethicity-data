/* 구역별 무대 소품. 코스와 판정에 관여하지 않는다.
 * 임무의 scenery가 'sorting'이면 선별장(옆 컨베이어 벨트·분류함·조명, 구역마다 하늘색·분류함 색), 아니면 1 임무 거리(그대로). */
(function (root) {
  'use strict';
  function create(view, mission) {
    if (mission && mission.scenery === 'sorting') return sorting(view, mission);
    if (mission && mission.scenery === 'city') return city(view, mission);
    if (mission && mission.scenery === 'exam') return exam(view, mission);
    return street(view);
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
  function sorting(view, mission) {
    var scene = view.scene, binColors = (root.DR.CardArt && root.DR.CardArt.binColors) || {};
    var line = new THREE.Group(), bins = [], lamps = [];
    scene.add(line);
    for (var i = 0; i < 10; i++) {
      var frame = new THREE.Group(); frame.position.z = -i * 20;
      [-1, 1].forEach(function (side) {
        var belt = new THREE.Mesh(new THREE.BoxGeometry(2, 0.45, 20), new THREE.MeshBasicMaterial({ color: 0x23262f }));
        belt.position.set(side * 5.6, 1.1, 0);
        belt.add(new THREE.LineSegments(new THREE.EdgesGeometry(belt.geometry), new THREE.LineBasicMaterial({ color: 0x5a6070 })));
        frame.add(belt);
        for (var k = 0; k < 5; k++) {
          var roller = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.1, 8), new THREE.MeshBasicMaterial({ color: 0x9aa0ad }));
          roller.rotation.z = Math.PI / 2; roller.position.set(side * 5.6, 0.82, -8 + k * 4); frame.add(roller);
        }
        [-4, -14].forEach(function (bz) {
          var bin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.7), new THREE.MeshBasicMaterial({ color: 0x888888 }));
          bin.position.set(side * 7.7, 0.75, bz);
          bin.add(new THREE.LineSegments(new THREE.EdgesGeometry(bin.geometry), new THREE.LineBasicMaterial({ color: 0x10093a })));
          frame.add(bin); bins.push(bin);
        });
      });
      var lamp = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 0.7), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      lamp.position.set(0, 11, -10); frame.add(lamp); lamps.push(lamp);
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
    var current = null, sky = null;
    function update(id, z) {
      if (id !== current) {
        current = id;
        sky = SORT_SKY[id] || 0x2c2f4a;
        scene.background = new THREE.Color(sky); scene.fog.color.setHex(sky);
        var cols = zoneColors(id);
        bins.forEach(function (b, i) { b.material.color.set(cols[i % cols.length]); });
        view.buildings.forEach(function (b, i) {
          b.scale.y = 0.6; b.position.y = b.geometry.parameters.height * b.scale.y / 2;
          b.material.color.setHex(0x2a2e44);
          b.children[0].material.color.set(cols[i % cols.length]);
        });
      }
      line.position.z = -Math.floor(z / 20) * 20 + 20;
    }
    return { update: update, state: function () { return { zone: current, theme: 'sorting', sky: sky }; } };
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
    var current = null, sky = null;
    function update(id, z, t, reduced) {
      var look = CITY[id] || CITY.S1;
      if (id !== current) {
        current = id; sky = look.sky;
        scene.background = new THREE.Color(sky); scene.fog.color.setHex(sky);
        view.buildings.forEach(function (b, i) {
          b.scale.y = look.scale; b.position.y = b.geometry.parameters.height * b.scale.y / 2;
          b.material.color.setHex(look.body); b.children[0].material.color.setHex(look.edges[i % look.edges.length]);
        });
        lanterns.visible = id === 'S2'; river.visible = id === 'S3'; rain.visible = id === 'S4';
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
  root.DR.RunScenery = { create: create };
})(window);
