/*
 * 3D 3레인 달리기(spec §4) — 러너 뒤에서 따라가는 카메라, 자동 전진.
 * 판정(잡기·벽)은 코스 z 좌표로 계산하고, 화면은 그 상태를 그린다. three.js 세계에서 앞쪽은 -z.
 * 테스트·조정용: step(dt)·peek()·setPaused()·finishNow()·course()·isTaken().
 */
(function (root) {
  'use strict';

  var VIEW_AHEAD = 150, VIEW_BEHIND = 12, ROAD_LEN = 220, LINE_GAP = 4;
  var S = null; // 현재 달리기 상태(한 번에 하나)

  function cfg() { return root.DR.config; }
  function laneX(l) { return (l - 1) * cfg().laneWidth; }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ---------- 텍스처 ---------- */
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    S.disposables.push(t);
    return t;
  }

  function cardTexture(mission, item) {
    var C = root.DR.Cards, id = C.artId(item);
    var variant = parseInt(item.uid.slice(1), 10) % 3;
    var k = id + '|' + variant;
    if (S.cardTex[k]) return S.cardTex[k];
    var A = root.DR.CardArt;
    var icons = C.iconsOf(mission, item);
    var t = canvasTex(400, 540, function (g, w, h) {
      g.fillStyle = '#f4f1ff'; roundRect(g, 0, 0, w, h, 18); g.fill();
      g.drawImage(A.card(mission, id, variant, 384), 16, 16, 368, 368);
      var size = 60, gap = 8, x0 = (w - (icons.length * size + (icons.length - 1) * gap)) / 2;
      icons.forEach(function (n, i) { g.drawImage(A.icon(n, 64), x0 + i * (size + gap), 400, size, size); });
      g.fillStyle = '#162535'; g.font = 'bold 22px "Malgun Gothic", sans-serif'; g.textAlign = 'center';
      g.fillText(item.ambiguousId ? '판단 필요' : C.cardLabel(mission, item), w / 2, 508, w - 24);
    });
    S.cardTex[k] = t;
    return t;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  /* ---------- 장면 만들기 ---------- */
  function buildScene() {
    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x2a1a6e, 50, VIEW_AHEAD);
    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a1a6e, 1.1));
    var sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(3, 8, 4); scene.add(sun);

    var W = cfg().laneWidth * 3 + 1.2;
    // 땅: 어두운 판 + 넓은 격자
    var groundTex = canvasTex(64, 64, function (g, w, h) {
      g.fillStyle = '#140d36'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(180,107,255,.35)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
    });
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(30, ROAD_LEN / 8);
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(240, ROAD_LEN), new THREE.MeshBasicMaterial({ map: groundTex }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02;
    scene.add(ground);
    // 도로: 남보라 + 분홍 가로줄(LINE_GAP마다)
    var roadTex = canvasTex(32, 32, function (g, w, h) {
      g.fillStyle = '#1f1652'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#637c91'; g.fillRect(0, 0, w, 2);
    });
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, ROAD_LEN / LINE_GAP);
    var road = new THREE.Mesh(new THREE.PlaneGeometry(W, ROAD_LEN), new THREE.MeshBasicMaterial({ map: roadTex }));
    road.rotation.x = -Math.PI / 2;
    scene.add(road);
    // 레인 구분선(시안)
    var lines = new THREE.Group();
    [-1.5, -0.5, 0.5, 1.5].forEach(function (f) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(f === -1.5 || f === 1.5 ? 0.16 : 0.08, ROAD_LEN), new THREE.MeshBasicMaterial({ color: 0x7ff9ff }));
      m.rotation.x = -Math.PI / 2; m.position.set(f * cfg().laneWidth, 0.01, 0);
      lines.add(m);
    });
    scene.add(lines);

    // 옆 빌딩(재사용 — 뒤로 지나가면 앞으로 옮긴다)
    var buildings = [], span = 26 * 12;
    var edgeCols = [0x7ff9ff, 0x81a6ce, 0xb4a1df];
    for (var side = -1; side <= 1; side += 2) {
      for (var i = 0; i < 26; i++) {
        var h = 4 + Math.random() * 16, w = 3 + Math.random() * 4;
        var geo = new THREE.BoxGeometry(w, h, 8);
        var box = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1c1446 }));
        var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeCols[i % 3] }));
        box.add(edges);
        box.position.set(side * (W / 2 + 4 + Math.random() * 7 + w / 2), h / 2, -i * 12);
        scene.add(box); buildings.push(box);
      }
    }

    // 러너 — 고른 주인공(공통 팩 온유·다온, js/hero-model.js)의 3D 모델. 모델 데이터가 없으면 아래 도형 러너
    var runner = new THREE.Group();
    var hero = DR.HeroModel && DR.HeroModel.build(S.heroId);
    if (hero) {
      runner.add(hero.group);
      scene.add(runner);
      // 팔은 몸통에 붙어 있어 흔들지 않는다(빈 축) — animate가 같은 이름으로 다룬다
      var still = function () { return new THREE.Group(); };
      return finishScene({ la: still(), ra: still(), ll: hero.legs[0], rl: hero.legs[1] });
    }
    var suit = new THREE.MeshLambertMaterial({ color: 0xffd24a }), skin = new THREE.MeshLambertMaterial({ color: 0xffe3b0 }), dark = new THREE.MeshLambertMaterial({ color: 0x3b2f7a });
    var body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.6, 4, 10), suit); body.position.y = 1.15; runner.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), skin); head.position.y = 1.85; runner.add(head);
    var visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.1), new THREE.MeshBasicMaterial({ color: 0x7ff9ff })); visor.position.set(0, 1.88, -0.24); runner.add(visor);
    var bag = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.22), dark); bag.position.set(0, 1.2, 0.36); runner.add(bag);
    function limb(x, y, len, mat) {
      var pivot = new THREE.Group(); pivot.position.set(x, y, 0);
      var m = new THREE.Mesh(new THREE.BoxGeometry(0.15, len, 0.15), mat); m.position.y = -len / 2; pivot.add(m);
      runner.add(pivot); return pivot;
    }
    scene.add(runner);
    return finishScene({ la: limb(-0.42, 1.45, 0.55, suit), ra: limb(0.42, 1.45, 0.55, suit), ll: limb(-0.17, 0.75, 0.72, dark), rl: limb(0.17, 0.75, 0.72, dark) });

    // 나머지 장면(속도선·벽 텍스처)은 어느 러너든 같다
    function finishScene(limbs) {
    // 속도선
    var N = 40, pos = new Float32Array(N * 6);
    var speedGeo = new THREE.BufferGeometry(); speedGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var speedLines = new THREE.LineSegments(speedGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    speedLines.frustumCulled = false;
    var seeds = [];
    for (var s = 0; s < N; s++) seeds.push({ x: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 7), y: 0.5 + Math.random() * 5, d: Math.random() * 60 });
    scene.add(speedLines);

    // 벽 텍스처(지직거리는 분홍)
    var wallTex = canvasTex(64, 24, function (g, w, h) {
      for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) { g.fillStyle = Math.random() < 0.3 ? '#ffffff' : (Math.random() < 0.5 ? '#ff5fb0' : '#c2307f'); g.fillRect(x, y, 2, 2); }
    });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.magFilter = THREE.NearestFilter;

    return { scene: scene, ground: ground, groundTex: groundTex, road: road, lines: lines, buildings: buildings, span: span, runner: runner, limbs: limbs, hero: !!hero,
      speedLines: speedLines, speedPos: pos, speedSeeds: seeds, wallTex: wallTex };
    }
  }

  /* ---------- 물체(카드·벽) ---------- */
  function makeItemMesh(item) {
    var g = new THREE.Group();
    if (item.kind === 'card') {
      var frame = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.1), new THREE.MeshBasicMaterial({ color: 0x3b2f7a, transparent: true, opacity: 0.9 }));
      var face = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 2.86), new THREE.MeshBasicMaterial({ map: cardTexture(S.mission, item), transparent: true }));
      face.position.z = 0.01;
      g.add(frame); g.add(face);
      g.userData = { frame: frame, face: face };
      g.position.set(laneX(item.lane), 1.45, -item.z);
    } else if (item.kind === 'fire') {
      var flameTex = canvasTex(128, 192, function (g) {
        g.fillStyle = '#ff6832'; g.beginPath(); g.moveTo(64, 4); g.bezierCurveTo(100, 50, 60, 62, 105, 91); g.bezierCurveTo(150, 150, 95, 190, 64, 188); g.bezierCurveTo(4, 190, 0, 133, 30, 83); g.quadraticCurveTo(22, 135, 52, 107); g.quadraticCurveTo(82, 70, 64, 4); g.fill();
        g.fillStyle = '#ffe595'; g.beginPath(); g.moveTo(70, 85); g.bezierCurveTo(98, 145, 88, 180, 60, 181); g.bezierCurveTo(28, 178, 34, 140, 70, 85); g.fill();
      });
      var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthTest: false }));
      glow.scale.set(1.8, 2.7, 1); g.add(glow);
      var stripes = canvasTex(128, 128, function (g) {
        g.fillStyle = '#b51d32'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#ffb4a6'; g.lineWidth = 18;
        for (var x = -128; x < 256; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 128, 128); g.stroke(); }
      });
      stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping; stripes.repeat.set(1, 5);
      var mark = new THREE.Mesh(new THREE.PlaneGeometry(cfg().laneWidth * 0.92, 28), new THREE.MeshBasicMaterial({ map: stripes, transparent: true, opacity: 0, depthWrite: false }));
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(laneX(item.lane), 0.03, -item.z);
      S.view.scene.add(mark);
      g.userData = { glow: glow, mark: mark };
      g.position.set(laneX(item.lane), 1.1, -item.z);
    } else {
      var wall = new THREE.Mesh(new THREE.BoxGeometry(cfg().laneWidth * 0.98, 0.45, 0.35), new THREE.MeshBasicMaterial({ map: S.view.wallTex, transparent: true, opacity: 0.55, depthWrite: false }));
      g.add(wall);
      g.position.set(laneX(item.lane), 0.28, -item.z);
    }
    S.view.scene.add(g);
    return g;
  }

  function removeMesh(uid) {
    var m = S.meshes[uid];
    if (!m) return;
    if (m.userData.mark) { S.view.scene.remove(m.userData.mark); m.userData.mark.geometry.dispose(); m.userData.mark.material.dispose(); }
    S.view.scene.remove(m);
    m.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    delete S.meshes[uid];
  }

  /* ---------- 상태 ---------- */
  function currentSpeed() {
    var c = cfg(), progress = Math.min(1, S.z / S.course.length);
    return c.baseSpeed * (1 + c.speedRamp * progress) * (S.t < S.slowedUntil ? c.wallSlow.factor : 1);
  }

  function bagCount() { return S.startBag + S.grabbed.length; }

  function updateHud() {
    var el = document.querySelector('#hud-bag b');
    if (el) el.textContent = bagCount() + '/' + S.bagMax;
    var box = document.getElementById('hud-bag');
    if (box) { box.classList.toggle('full', bagCount() >= S.bagMax); if (S.t > (S.emptyUntil || 0)) box.classList.remove('empty-grab'); }
    var hpBox = document.getElementById('hud-hp');
    if (hpBox) {
      if (hpBox.children.length !== cfg().hp) {
        hpBox.innerHTML = '';
        for (var h = 0; h < cfg().hp; h++) { var sp = document.createElement('span'); sp.className = 'heart'; hpBox.appendChild(sp); }
      }
      Array.prototype.forEach.call(hpBox.children, function (el, k) { el.classList.toggle('on', k < S.hp); });
      hpBox.setAttribute('aria-label', 'HP ' + S.hp + '/' + cfg().hp);
    }
    var p = document.querySelector('#hud-progress i');
    if (p) p.style.width = Math.min(100, (S.z / S.course.length) * 100) + '%';
  }

  function bump() {
    var box = document.getElementById('hud-bag');
    if (!box) return;
    box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump');
  }

  function take(item, perfect) {
    S.emptyUntil = 0; document.getElementById('hud-bag').classList.remove('empty-grab');
    S.feedback.take(item, S.t);
    S.taken.add(item.uid);
    var g = { uid: item.uid };
    if (item.key) g.key = item.key;
    else if (item.fakeId) g.fakeId = item.fakeId;
    else g.ambiguousId = item.ambiguousId;
    S.grabbed.push(g);
    if (perfect) { S.perfects++; burst(item); root.DR.Sfx.play('perfect'); } else root.DR.Sfx.play('grab');
    var m = S.meshes[item.uid];
    if (m) removeMesh(item.uid);
    bump(); updateHud();
  }

  function burst(item) {
    var n = 24, pos = new Float32Array(n * 3), vel = [];
    for (var i = 0; i < n; i++) { vel.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 3)); }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd24a, size: 0.18, transparent: true }));
    pts.position.set(laneX(item.lane), 1.6, -item.z);
    S.view.scene.add(pts);
    S.bursts.push({ pts: pts, vel: vel, t: 0 });
  }

  // 불꽃(방해 세력): 감속·흔들림·HP-1, 잠깐 무적. HP 0이면 연결이 끊긴다.
  function hitFire(f) {
    S.hitFires.add(f.uid);
    if (S.t < S.invulnUntil) return;
    S.hp--;
    S.feedback.damage(S.t);
    S.slowedUntil = S.t + cfg().wallSlow.seconds;
    S.shakeUntil = S.t + 0.45;
    S.invulnUntil = S.t + cfg().fire.invuln;
    root.DR.Sfx.play('burn');
    updateHud();
    if (S.hp <= 0) { S.knockedOut = true; end(); }
  }

  function hitWall(w) {
    S.hitWalls.add(w.uid);
    S.hits++;
    S.slowedUntil = S.t + cfg().wallSlow.seconds;
    S.shakeUntil = S.t + 0.3;
    root.DR.Sfx.play('hit');
  }

  /* ---------- 진행 ---------- */
  function step(dt) {
    if (!S || !S.running) return;
    dt = Math.min(dt, cfg().maxDt);
    if (!(dt > 0)) return;
    S.t += dt;
    var speed = currentSpeed();
    var prevZ = S.z;
    S.z += speed * dt;
    var items = S.course.items;
    for (var i = 0; i < items.length; i++) {
      var w = items[i];
      if (w.kind === 'wall' && w.lane === S.lane && w.z > prevZ && w.z <= S.z && !S.hitWalls.has(w.uid)) hitWall(w);
      else if (w.kind === 'fire' && w.lane === S.lane && w.z > prevZ && w.z <= S.z && !S.hitFires.has(w.uid)) hitFire(w);
    }
    if (!S.running) return;
    // 경고: 다음 불꽃이 경고 거리 안에 들어오면(레인 무관) 띠·경고음, 첫 불꽃엔 안내 한 줄
    var warnDist = Math.max(speed, cfg().baseSpeed) * cfg().fire.warn, warn = null;
    for (var j = 0; j < items.length; j++) {
      var f = items[j], fd = f.z - S.z;
      if (f.kind === 'fire' && fd > 0 && fd <= warnDist) { warn = f.uid; break; }
    }
    if (warn && warn !== S.warning) {
      root.DR.Sfx.play('warn');
      if (!S.fireHintShown) { S.fireHintShown = true; showHint('불꽃! 레인을 바꿔 피하기', 2); }
    }
    S.warning = warn;
    if (!S.rareHintShown && items.some(function (it) {
      return it.kind === 'card' && !it.fakeId && (it.ambiguousId || (S.mission.cardTypes[it.key] || {}).rare) && it.z - S.z > 0 && it.z - S.z < 42;
    })) { S.rareHintShown = true; showHint('귀한 데이터: 노이즈를 지나야 잡을 수 있음', 3); }
    // 첫 가짜 카드가 판정 구간 가까이 오면 한 번만 안내(맞다/틀리다는 알리지 않는다, spec §3.4)
    if (!S.fakeHintShown) {
      var fakeDist = Math.max(speed, cfg().baseSpeed) * cfg().catchLead * 2;
      for (var q = 0; q < items.length; q++) {
        var fc = items[q], qd = fc.z - S.z;
        if (fc.kind === 'card' && fc.fakeId && qd > 0 && qd <= fakeDist) { S.fakeHintShown = true; showHint('그림이랑 이름표가 맞는지 봐!', 2.5); break; }
      }
    }
    var r = S.grabber.update({ now: S.t, items: items, runnerZ: S.z, speed: speed, lane: S.lane, bagCount: bagCount(), bagMax: S.bagMax, taken: S.taken });
    if (r && r.item) take(r.item, r.perfect);
    else if (r && r.full) root.DR.Sfx.play('full');
    if (S.hintAt && S.t > S.hintUntil) hideHint();
    animate(dt, speed);
    updateHud();
    if (S.z >= S.course.length) end();
  }

  function animate(dt, speed) {
    var v = S.view, c = cfg(), rm = reducedMotion();
    // 레인 보간(0.12초) + 기울기
    var tx = laneX(S.lane);
    var k = Math.min(1, dt / 0.12 * 2.2);
    S.x += (tx - S.x) * k;
    v.runner.position.set(S.x, 0, -S.z);
    v.runner.rotation.z = -(tx - S.x) * 0.18;
    var sw = Math.sin(S.t * speed * 0.75);
    v.limbs.la.rotation.x = sw * 0.9; v.limbs.ra.rotation.x = -sw * 0.9;
    v.limbs.ll.rotation.x = -sw * 0.8; v.limbs.rl.rotation.x = sw * 0.8;
    S.legSwing = v.limbs.ll.rotation.x;
    v.runner.position.y = Math.abs(sw) * 0.08;
    v.runner.visible = !(S.t < S.invulnUntil && Math.floor(S.t * 12) % 2);
    // 카메라(관성 추종 + 충돌 흔들림)
    var portrait = S.aspect < 1;
    S.camX += (S.x * 0.75 - S.camX) * Math.min(1, dt * 6);
    var shake = (!rm && S.t < S.shakeUntil) ? 0.18 : 0;
    S.camera.position.set(S.camX + (Math.random() - 0.5) * shake, (portrait ? 4.6 : 3.7) + (Math.random() - 0.5) * shake, -S.z + (portrait ? 7.6 : 6.4));
    S.camera.lookAt(S.camX * 0.5, 1.1, -S.z - 16);
    if (S.scenery) {
      var zone = S.course.zones.filter(function (zone) { return S.z >= zone.start; }).pop();
      S.scenery.update(zone.id, S.z, S.t, rm);
    }
    // 땅·도로는 줄 간격에 맞춰 따라온다(줄이 세계에 고정돼 보이게)
    var snap = Math.floor(S.z / LINE_GAP) * LINE_GAP;
    var mid = -(snap + ROAD_LEN / 2 - VIEW_BEHIND);
    v.road.position.z = mid; v.lines.position.z = mid;
    v.ground.position.z = -(Math.floor(S.z / 8) * 8 + ROAD_LEN / 2 - VIEW_BEHIND);
    v.buildings.forEach(function (b) { if (b.position.z > -S.z + 15) b.position.z -= v.span; });
    // 속도선
    v.speedLines.visible = !rm;
    if (!rm) {
      var p = v.speedPos;
      v.speedSeeds.forEach(function (sd, i) {
        sd.d -= speed * dt * 1.6;
        if (sd.d < -6) sd.d = 50 + Math.random() * 20;
        var z = -S.z - sd.d, len = 1.2 + speed * 0.12;
        p.set([S.camX + sd.x, sd.y, z, S.camX + sd.x, sd.y, z - len], i * 6);
      });
      v.speedLines.geometry.attributes.position.needsUpdate = true;
      v.speedLines.material.opacity = 0.15 + 0.4 * Math.min(1, S.z / S.course.length);
    }
    v.wallTex.offset.set(Math.random(), Math.random());
    // 물체 생성·정리·하이라이트
    var full = bagCount() >= S.bagMax;
    var items = S.course.items;
    for (var i = 0; i < items.length; i++) {
      var it = items[i], d = it.z - S.z;
      if (d > VIEW_AHEAD) break;
      var m = S.meshes[it.uid];
      if (d < -VIEW_BEHIND) { if (m && !isFlying(it.uid)) removeMesh(it.uid); continue; }
      if (!m && !S.taken.has(it.uid)) m = S.meshes[it.uid] = makeItemMesh(it);
      if (!m || S.taken.has(it.uid)) continue;
      // 러너를 지나친 것은 카메라 앞을 가리지 않게 숨긴다(카드는 늦게 잡기 여유가 끝날 때까지 보인다)
      m.visible = d > (it.kind === 'card' ? -c.baseSpeed * c.catchLate : -0.8);
      if (it.kind === 'fire') {
        var lead = Math.max(0, d) / Math.max(speed, 1);
        m.position.z = -(it.z + c.fire.speed * lead);
        var flicker = rm ? 1 : 1 + 0.08 * Math.sin(S.t * 12);
        m.userData.glow.scale.set(1.8 * flicker, 2.7 * flicker, 1);
        var warnOn = d > 0 && d <= Math.max(speed, c.baseSpeed) * c.fire.warn;
        m.userData.mark.position.z = -S.z - 12;
        m.userData.mark.material.opacity = warnOn ? (rm ? 0.8 : 0.65 + 0.2 * Math.sin(S.t * 12)) : 0;
        m.userData.mark.visible = m.visible;
        continue;
      }
      if (it.kind !== 'card') continue;
      var active = root.DR.Catch.phase(it, S.z, speed, c) === 'active';
      var mine = active && it.lane === S.lane;
      m.visible = m.visible && d > 34;
      m.userData.frame.material.color.set(root.DR.Cards.runColor(S.mission, it));
      m.userData.face.material.color.setHex(full && active ? 0x888899 : 0xffffff);
      var sc = mine && !full ? 1.12 + 0.04 * Math.sin(S.t * 18) : 1;
      m.scale.set(sc, sc, sc);
      m.position.y = 1.45 + Math.sin(S.t * 3 + i) * 0.06;
    }
    S.camera.updateMatrixWorld();
    S.feedback.update({ course: S.course, taken: S.taken, z: S.z, speed: speed, lane: S.lane, full: full, camera: S.camera, t: S.t });
    // 잡은 카드가 가방 쪽(화면 왼쪽 위)으로 날아간다
    S.flying = S.flying.filter(function (f) {
      f.t += dt;
      var a = Math.min(1, f.t / 0.3);
      var target = new THREE.Vector3(S.camera.position.x - 2.2, S.camera.position.y + 1.6, S.camera.position.z - 4);
      f.mesh.position.lerpVectors(f.from, target, a * a);
      var s = 1 - a * 0.75; f.mesh.scale.set(s, s, s);
      if (a >= 1) { removeMesh(f.uid); return false; }
      return true;
    });
    S.bursts = S.bursts.filter(function (b) {
      b.t += dt;
      var arr = b.pts.geometry.attributes.position.array;
      b.vel.forEach(function (vv, j) { arr[j * 3] = vv.x * b.t; arr[j * 3 + 1] = vv.y * b.t - 4 * b.t * b.t; arr[j * 3 + 2] = vv.z * b.t; });
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 1 - b.t / 0.5);
      if (b.t > 0.5) { S.view.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); return false; }
      return true;
    });
  }

  function isFlying(uid) { return S.flying.some(function (f) { return f.uid === uid; }); }

  function render() { if (S && S.renderer) S.renderer.render(S.view.scene, S.camera); }

  function frame(ts) {
    if (!S) return;
    S.raf = root.requestAnimationFrame(frame);
    var dt = S.last == null ? 0 : (ts - S.last) / 1000;
    S.last = ts;
    if (!S.paused && !S.hidden) step(dt);
    render();
  }

  function resize() {
    if (!S) return;
    var w = S.container.clientWidth || 1, h = S.container.clientHeight || 1;
    S.renderer.setSize(w, h);
    S.aspect = w / h;
    S.camera.aspect = S.aspect;
    S.camera.fov = S.aspect < 1 ? 74 : 56;
    S.camera.updateProjectionMatrix();
    render();
  }

  function showHint(text, seconds) {
    var el = document.getElementById('run-hint');
    if (!el) return;
    var coarse = root.matchMedia && root.matchMedia('(pointer: coarse)').matches;
    el.textContent = text || (coarse ? '좌우로 밀어 레인 이동 · 화면을 톡 눌러 잡기' : '←/→ 레인 이동 · Space 잡기');
    el.hidden = false;
    S.hintAt = true;
    S.hintUntil = S.t + (seconds || 3);
  }
  function hideHint() {
    var el = document.getElementById('run-hint');
    if (el) el.hidden = true;
    if (S) S.hintAt = false;
  }

  function syncMute() {
    var b = document.getElementById('btn-mute');
    if (!b) return;
    b.setAttribute('aria-pressed', root.DR.Sfx.muted ? 'true' : 'false');
    b.setAttribute('aria-label', root.DR.Sfx.muted ? '소리 켜기' : '소리 끄기');
  }

  function end() {
    if (!S || !S.running) return;
    S.running = false;
    hideHint();
    var res = { grabbed: S.grabbed.slice(), hits: S.hits, perfects: S.perfects, knockedOut: !!S.knockedOut };
    if (S.onEnd) S.onEnd(res);
  }

  /* ---------- 공개 API ---------- */
  function start(container, opts) {
    if (S) stop();
    S = {
      container: container, mission: opts.mission, course: opts.course, onEnd: opts.onEnd,
      startBag: (opts.bag || []).length, bagMax: opts.bagMax,
      t: 0, z: 0, lane: 1, x: 0, camX: 0, slowedUntil: 0, shakeUntil: 0,
      taken: new Set(), hitWalls: new Set(), hitFires: new Set(), grabbed: [], hits: 0, perfects: 0,
      hp: cfg().hp, invulnUntil: 0, warning: null, fireHintShown: false, fakeHintShown: false, knockedOut: false, hintUntil: 3,
      meshes: {}, flying: [], bursts: [], cardTex: {}, disposables: [],
      running: true, paused: false, hidden: false, last: null, aspect: 1, hintAt: false
    };
    S.grabber = root.DR.Catch.grabber(cfg());
    S.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    S.renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    container.appendChild(S.renderer.domElement);
    S.camera = new THREE.PerspectiveCamera(56, 1, 0.1, 400);
    S.heroId = DR.Save ? DR.Save.hero() : 'onyu';
    S.view = buildScene();
    if (S.course.zones) S.scenery = root.DR.RunScenery.create(S.view);
    S.feedback = root.DR.RunFeedback.create(container, S.mission, S.course);
    // 조작을 막는 건 일시정지 메뉴·도움말 같은 열린 다이얼로그다. S.paused(setPaused)는 시계만 멈춘다 —
    // 테스트가 시계를 멈춘 채 step()으로 한 칸씩 굴리며 키를 누르기 때문(메뉴는 언제나 다이얼로그로 뜬다).
    function inputBlocked() { return !S || !S.running || !!document.querySelector('dialog[open]'); }
    S.unbind = root.DR.Input.bind(container, {
      lane: function (dir) {
        if (inputBlocked()) return;
        var nl = Math.max(0, Math.min(2, S.lane + dir));
        if (nl !== S.lane) { S.lane = nl; root.DR.Sfx.play('lane'); hideHint(); }
      },
      grab: function () { if (!inputBlocked()) { root.DR.Sfx.unlock(); S.grabber.press(S.t);
        var available = S.course.items.some(function (it) { return it.kind === 'card' && it.lane === S.lane && !S.taken.has(it.uid) && root.DR.Catch.phase(it, S.z, currentSpeed(), cfg()) === 'active'; });
        if (!available) { S.emptyUntil = S.t + 0.22; var bag = document.getElementById('hud-bag'); bag.classList.remove('empty-grab'); void bag.offsetWidth; bag.classList.add('empty-grab'); } } }
    }, cfg());
    S.onVis = function () { S.hidden = document.hidden; S.last = null; };
    document.addEventListener('visibilitychange', S.onVis);
    S.ro = new ResizeObserver(resize);
    S.ro.observe(container);
    var mute = document.getElementById('btn-mute');
    S.onMute = function () { root.DR.Sfx.setMuted(!root.DR.Sfx.muted); syncMute(); };
    if (mute) mute.addEventListener('click', S.onMute);
    syncMute();
    resize();
    showHint();
    updateHud();
    animate(0.001, cfg().baseSpeed);
    S.raf = root.requestAnimationFrame(frame);
  }

  function stop() {
    if (!S) return;
    root.cancelAnimationFrame(S.raf);
    if (S.unbind) S.unbind();
    document.removeEventListener('visibilitychange', S.onVis);
    if (S.ro) S.ro.disconnect();
    var mute = document.getElementById('btn-mute');
    if (mute) mute.removeEventListener('click', S.onMute);
    S.view.scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    S.disposables.forEach(function (t) { t.dispose(); });
    S.feedback.destroy();
    S.renderer.dispose();
    if (S.renderer.domElement.parentNode) S.renderer.domElement.parentNode.removeChild(S.renderer.domElement);
    hideHint();
    S = null;
  }

  var Run = {
    start: start,
    stop: stop,
    step: step,
    finishNow: end,
    setPaused: function (p) { if (S) { S.paused = !!p; S.last = null; } },
    course: function () { return S ? S.course : null; },
    isTaken: function (uid) { return !!(S && S.taken.has(uid)); },
    // 테스트용: 코스의 카드를 잡은 것으로 처리
    debugSetHp: function (n) { if (S) { S.hp = n; updateHud(); } },
    debugTake: function (uid) {
      if (!S || S.taken.has(uid)) return false;
      var it = S.course.items.filter(function (i) { return i.uid === uid; })[0];
      if (!it || it.kind !== 'card') return false;
      take(it, false);
      return true;
    },
    peek: function () {
      if (!S) return { running: false };
      return { t: S.t, runnerZ: S.z, speed: currentSpeed(), lane: S.lane, bagCount: bagCount(), bagMax: S.bagMax, running: S.running, hero: S.view && S.view.hero ? S.heroId : null, legSwing: S.legSwing, slowedUntil: S.slowedUntil, paused: S.paused, hp: S.hp, invulnUntil: S.invulnUntil, warning: S.warning, fakeHintShown: S.fakeHintShown };
    }
  };

  root.DR = root.DR || {};
  root.DR.Run = Run;
})(window);
