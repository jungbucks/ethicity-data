/*
 * 시작 화면 장면(DR.TitleScene) — 무슨 게임인지 한눈에: 비 오는 밤 도시를 달리며 사진(카드)을 줍는 러너.
 *   배경 4층(assets/title, Codex 그림): bg-sky 고정 · bg-far 느리게 · bg-mid 중간(데이터 선 끝이 가끔 반짝) · bg-road 빠르게, 그 위에 비.
 *   주인공: 달리기와 같은 3D 모델(js/hero-model.js 온유·다온)을 작은 캔버스에 낮은 해상도로 — 제자리 달리기, 가끔 카드가 날아와 주워진다.
 *   제목 '끊어진 도시'는 가끔 글자가 끊기는 글리치, 떠날 때(이어하기·처음부터 등) 끊긴 선이 이어지며 주인공이 달려 나간다(0.4초).
 *   AI 봇: 안내 역할(고를 수 없음) — 초상 칸을 바꿔 가며 둥실, 말풍선 몇 초마다.
 * 성능·접근성: 그리기는 한 루프에서 30fps로 제한, 3D 화소 비율 ≤ 1.25(그 위에 낮은 해상도 배율), 탭이 안 보이면 쉬고,
 *   시작 화면을 떠나면 멈추고 3D 자원을 정리한다. 움직임 줄이기면 정지 장면만. 그림을 못 불러오면 원래 그라데이션.
 *   장식(배경·캔버스·날아오는 카드)은 aria-hidden, 소리 없음.
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  var FPS = 30, STEP = 1000 / FPS, MAX_PR = 1.25, LOW_RES = 0.6, LEAVE_MS = 400;
  var SPEED = { far: 14, mid: 36, road: 150 }; // px/초(그림 높이 기준 배율 적용 전)
  var LINES = [
    '비만 오면 내가 길을 헷갈려… 도와줄래?',
    '사진은 많이보다, 목적에 맞게 모아야 해!',
    '카드에 붙은 이름표가 늘 맞는 건 아니야.',
    '준비되면 아래 버튼을 눌러 줘!'
  ];
  var ART = ['assets/title/bg-sky.webp', 'assets/title/bg-far.webp', 'assets/title/bg-mid.webp', 'assets/title/bg-road.webp'];
  var LAYERS = [['far', 720], ['mid', 720], ['road', 360]]; // 원본 높이(가로 2560)

  var S = { running: false, still: false, disposed: true, hero: null, raf: 0, last: 0, t: 0, offsets: { far: 0, mid: 0, road: 0 },
    cardsCaught: 0, draws: 0, three: null, artOk: null, mode: '3d', line: 0 };

  function reduced() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function $(id) { return document.getElementById(id); }

  /* ---------- 그림 불러오기(한 번) — 하나라도 실패하면 원래 그라데이션 ---------- */
  function loadArt(done) {
    if (S.artOk !== null) { done(S.artOk); return; }
    var left = ART.length, ok = true;
    ART.forEach(function (src) {
      var img = new Image();
      img.onload = function () { if (--left === 0) { S.artOk = ok; done(ok); } };
      img.onerror = function () { ok = false; if (--left === 0) { S.artOk = ok; done(ok); } };
      img.src = src;
    });
  }
  function setArt(ok) { var sc = $('title-scene'); if (sc) sc.classList.toggle('no-art', !ok); }

  /* ---------- 3D 주인공(작은 캔버스) ---------- */
  function build3d(heroId) {
    var canvas = $('title-runner');
    if (!canvas || !root.THREE || !DR.HeroModel) return null;
    var THREE = root.THREE, model = DR.HeroModel.build(heroId);
    if (!model) return null;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, MAX_PR) * LOW_RES);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0.4, 1.2, 6.2); camera.lookAt(0, 1.0, 0);
    model.group.rotation.y = -Math.PI / 2 + 0.45; // 오른쪽(달리는 방향)을 보며 얼굴이 살짝 보이게
    scene.add(model.group);
    var three = { THREE: THREE, renderer: renderer, scene: scene, camera: camera, model: model, w: 0, h: 0 };
    resize3d(three);
    return three;
  }
  function resize3d(t) {
    var c = t.renderer.domElement, w = c.clientWidth || 1, h = c.clientHeight || 1;
    if (w === t.w && h === t.h) return;
    t.w = w; t.h = h;
    t.renderer.setSize(w, h, false);
    t.camera.aspect = w / h; t.camera.updateProjectionMatrix();
  }
  function dispose3d() {
    var t = S.three;
    if (!t) return;
    t.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    t.renderer.dispose();
    if (t.renderer.forceContextLoss) t.renderer.forceContextLoss();
    S.three = null;
  }
  function pose(t, time) {
    var sw = Math.sin(time * 11);
    t.model.legs[0].rotation.x = -sw * 0.8; t.model.legs[1].rotation.x = sw * 0.8;
    t.model.group.position.y = Math.abs(sw) * 0.07;
    t.model.group.rotation.z = 0.04 * Math.sin(time * 11);
  }

  /* ---------- 날아오는 카드(2D, 같은 cardart 그림) ---------- */
  var CARD_SET = [['m1', 'day_deep'], ['m2', 'can_drink'], ['m3', 'station_now'], ['m1', 'night_wet'], ['m2', 'battery_aa']];
  var fly = null, nextFly = 1.2;
  function cardImg(n) {
    var c = CARD_SET[n % CARD_SET.length], m = DR.Missions[c[0]];
    try { return DR.CardArt.thumb(DR.CardArt.card(m, c[1], 0, 192), 24).toDataURL(); } catch (e) { return ''; }
  }
  function stepCard(dt) {
    var box = document.querySelector('#title-scene .tl-cards'), runner = $('title-runner');
    if (!box || !runner) return;
    if (!fly) {
      nextFly -= dt;
      if (nextFly > 0) return;
      var img = document.createElement('img');
      img.className = 'tl-card'; img.alt = ''; img.src = cardImg(S.cardsCaught);
      box.appendChild(img);
      fly = { el: img, t: 0 };
    }
    fly.t += dt;
    var stage = box.getBoundingClientRect(), r = runner.getBoundingClientRect();
    var tx = r.left - stage.left + r.width * 0.55, ty = r.top - stage.top + r.height * 0.45;
    var sx = stage.width + 40, sy = ty - r.height * 0.5;
    var k = Math.min(1, fly.t / 0.8), e = 1 - (1 - k) * (1 - k);
    var x = sx + (tx - sx) * e, y = sy + (ty - sy) * e - Math.sin(k * Math.PI) * 40;
    var s = k < 1 ? 1 : Math.max(0, 1 - (fly.t - 0.8) / 0.25);
    fly.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (-12 + 24 * k).toFixed(1) + 'deg) scale(' + s.toFixed(2) + ')';
    if (fly.t > 1.05) {
      fly.el.remove(); fly = null; S.cardsCaught++; nextFly = 2.4 + (S.cardsCaught % 3) * 0.6;
      var pop = document.createElement('b'); pop.className = 'tl-pop'; pop.textContent = '+1';
      pop.style.transform = 'translate(' + tx + 'px,' + (ty - 30) + 'px)';
      box.appendChild(pop);
      setTimeout(function () { pop.remove(); }, 600);
    }
  }

  /* ---------- 배경 흐름·비·반짝임·글리치·봇 ---------- */
  function tileWidth(layer) {
    var el = document.querySelector('#title-scene .tl-' + layer[0]);
    return el ? el.clientHeight * 2560 / layer[1] : 0;
  }
  function stepLayers(dt) {
    var sc = $('title-scene'), hk = sc ? sc.clientHeight / 976 : 1;
    LAYERS.forEach(function (L) {
      var el = document.querySelector('#title-scene .tl-' + L[0]), tw = tileWidth(L);
      if (!el || !tw) return;
      S.offsets[L[0]] = (S.offsets[L[0]] + SPEED[L[0]] * hk * dt) % tw;
      el.style.transform = 'translate3d(' + (-S.offsets[L[0]]).toFixed(1) + 'px,0,0)';
    });
    var rain = document.querySelector('#title-scene .tl-rain');
    if (rain) rain.style.transform = 'translate3d(' + (-(S.t * 60) % 96).toFixed(1) + 'px,' + ((S.t * 520) % 192).toFixed(1) + 'px,0)';
  }
  var sparkAt = 0, glitchAt = 2.5, bubbleAt = 4.5, faceAt = 0, face = 0;
  function stepFx() {
    if (S.t > sparkAt) {
      var sparks = document.querySelectorAll('#title-scene .tl-spark');
      if (sparks.length) { var sp = sparks[Math.floor(Math.random() * sparks.length)]; sp.classList.add('on'); setTimeout(function () { sp.classList.remove('on'); }, 420); }
      sparkAt = S.t + 0.6 + Math.random() * 1.2;
    }
    if (S.t > glitchAt) {
      var g = document.querySelector('#screen-title .title-glitch');
      if (g) { g.classList.add('glitching'); setTimeout(function () { g.classList.remove('glitching'); }, 260); }
      glitchAt = S.t + 3 + Math.random() * 4;
    }
    if (S.t > bubbleAt) { setLine(S.line + 1); bubbleAt = S.t + 4.5; }
    if (S.t > faceAt) {
      face = (face + 1) % 4;
      var img = document.querySelector('#title-guide .character-portrait img');
      if (img) img.style.transform = 'translateX(-' + face * 25 + '%)';
      faceAt = S.t + 1.4;
    }
    var bot = $('title-guide');
    if (bot) bot.style.setProperty('--float', (Math.sin(S.t * 2) * 6).toFixed(1) + 'px');
  }
  function setLine(n) {
    S.line = n % LINES.length;
    var b = document.querySelector('#title-guide .tl-bubble');
    if (b) b.textContent = LINES[S.line];
  }

  /* ---------- 루프(30fps) ---------- */
  function frame(now) {
    if (!S.running) return;
    S.raf = root.requestAnimationFrame(frame);
    if (document.hidden) { S.last = now; return; }
    if (now - S.last < STEP - 1) return;
    var dt = Math.min(0.1, (now - S.last) / 1000 || 0);
    S.last = now; S.t += dt; S.draws++;
    stepLayers(dt);
    stepFx();
    stepCard(dt);
    if (S.three) { resize3d(S.three); pose(S.three, S.t); S.three.renderer.render(S.three.scene, S.three.camera); }
  }

  function start() {
    var sc = $('title-scene');
    if (!sc) return;
    var heroId = DR.Save ? DR.Save.hero() : 'onyu';
    if (S.running && S.hero === heroId && !reduced()) return;
    stop();
    S.hero = heroId; S.disposed = false; S.t = 0;
    loadArt(setArt);
    setLine(0);
    S.three = build3d(heroId);
    S.mode = S.three ? '3d' : 'none';
    if (reduced()) {
      // 움직임 줄이기: 한 장면만 그리고 멈춘다
      S.still = true; S.running = false;
      if (S.three) { resize3d(S.three); pose(S.three, 0.2); S.three.renderer.render(S.three.scene, S.three.camera); }
      return;
    }
    S.still = false; S.running = true; S.last = performance.now();
    S.raf = root.requestAnimationFrame(frame);
  }
  function stop() {
    S.running = false;
    if (S.raf) root.cancelAnimationFrame(S.raf);
    S.raf = 0;
    if (fly) { fly.el.remove(); fly = null; }
    dispose3d();
    S.disposed = true;
  }
  function setHero(id) { if (S.hero !== id) { S.hero = null; start(); } }

  // 떠날 때: 끊긴 선이 이어지고 주인공이 달려 나간다(0.55초) → fn. 움직임 줄이기·테스트 빠른 모드면 바로
  function leave(fn) {
    var screen = $('screen-title');
    if (reduced() || root.__DR_FAST_TITLE || !screen || screen.hidden) { fn(); return; }
    if (screen.classList.contains('tl-leaving')) return;
    screen.classList.add('tl-leaving');
    // 전환 동안은 루프를 멈춰 타이머가 밀리지 않게(마지막 그림을 CSS로 밀어낸다)
    S.running = false; if (S.raf) root.cancelAnimationFrame(S.raf); S.raf = 0;
    setTimeout(function () { screen.classList.remove('tl-leaving'); fn(); }, LEAVE_MS);
  }

  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.running) S.last = performance.now(); });

  DR.TitleScene = {
    start: start, stop: stop, setHero: setHero, leave: leave, LEAVE_MS: LEAVE_MS,
    state: function () {
      return { running: S.running, still: S.still, disposed: S.disposed, hero: S.hero, fpsCap: FPS, mode: S.mode,
        pixelRatio: S.three ? S.three.renderer.getPixelRatio() / LOW_RES : null, offsets: { far: S.offsets.far, mid: S.offsets.mid, road: S.offsets.road },
        cardsCaught: S.cardsCaught, line: S.line, draws: S.draws };
    },
    testFallback: function () { S.artOk = false; setArt(false); }
  };
})(window);
