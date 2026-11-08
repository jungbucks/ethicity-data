/*
 * "지지직" 연출(요청서 docs/feedback/2026-11-08-glitch-effect.md) — 데이터 세계가 흔들리는 느낌만. 판정·개수·카드 배치·저장은 그대로.
 * - 대상: 흔한 카드만(가짜 fakeId·"?" ambiguousId·드문 카드·개인정보 privateId 제외). 비율 = mission.glitchRate(없으면 0).
 * - 코스를 만들 때 seed로 고른다(Stream.build 끝) — 코스 난수와 따로 돌리는 난수라 카드·벽·불꽃은 한 칸도 안 바뀐다. 표시 필드 item.glitch = 효과 하나.
 * - 효과 셋(EFFECTS): stripe 가로 줄무늬·좌우 밀림 / rgb 색 어긋남 / glyph 이름표 글자 일부가 기호로 깨졌다 돌아옴.
 * - 멀 때만: clearDist(잡기 구간 + config.glitch.clearSec) 안으로 들어오면 그 뒤로는 계속 선명(run3d가 붙잡아 둔다).
 * - 깜빡임 안전: burst는 period마다 on초만 켜진다(1초에 3번 이하). 밝기는 그대로(그림을 밀고 색을 어긋낼 뿐, 흰 번쩍 없음).
 * 그림 만들기(stripeCanvas·rgbCanvas)는 브라우저에서만 부른다(node 테스트는 순수 부분만).
 */
(function (root) {
  'use strict';

  var EFFECTS = ['stripe', 'rgb', 'glyph'];
  var SYMBOLS = '#%&*@$+=/<>'; // '?'는 쓰지 않는다("?" 카드와 헷갈리지 않게)
  var SALT = 0x5bd1e995; // 코스 난수와 다른 수열

  function rngApi() {
    if (root.DR && root.DR.Rng) return root.DR.Rng;
    return require('./rng.js');
  }

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  function eligible(mission, it) {
    if (it.kind !== 'card' || !it.key || it.fakeId || it.ambiguousId || it.privateId) return false;
    return !(mission.cardTypes[it.key] && mission.cardTypes[it.key].rare);
  }

  function mark(mission, course, seed) {
    var rate = mission.glitchRate || 0;
    if (!(rate > 0)) return course;
    var pool = course.items.filter(function (it) { return eligible(mission, it); });
    var n = Math.round(pool.length * rate);
    if (!n) return course;
    var rng = rngApi().create(((Number(seed) | 0) ^ SALT) >>> 0);
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(rng.next() * (i + 1)), t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    pool.slice(0, n).forEach(function (it) { it.glitch = EFFECTS[Math.floor(rng.next() * EFFECTS.length)]; });
    return course;
  }

  // 이 거리 안이면 선명(판정 거리와 같은 기준 — 느려져도 기준 속도보다 짧아지지 않는다)
  function clearDist(speed, cfg) { return Math.max(speed, cfg.baseSpeed) * (cfg.catchLead + cfg.glitch.clearSec); }

  // 시각 t에 효과가 켜져 있나: -1 꺼짐, 0·1 = 그림 두 장 중 하나(번갈아). 카드마다 박자를 어긋낸다
  function burst(t, uid, cfg) {
    var g = cfg.glitch, x = t + (hash(uid) % 1000) / 1000 * g.period, k = Math.floor(x / g.period);
    return x - k * g.period < g.on ? k % 2 : -1;
  }

  // 이름표 글자 일부(약 1/3, 적어도 1자)를 기호로 — 길이·띄어쓰기는 그대로
  function scramble(text, frame, uid) {
    var chars = Array.from(text), idx = [];
    chars.forEach(function (ch, i) { if (ch !== ' ') idx.push(i); });
    if (!idx.length) return text;
    var h = hash(uid + '|' + frame), n = Math.max(1, Math.round(idx.length / 3));
    for (var k = 0; k < n; k++) {
      var at = idx[(h + k * 7) % idx.length];
      chars[at] = SYMBOLS[((h >>> 3) + k) % SYMBOLS.length];
      h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    }
    var out = chars.join('');
    return out === text ? text.slice(0, -1) + SYMBOLS[0] : out;
  }

  /* ---------- 그림(브라우저) ---------- */
  function copy(src) {
    var c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    return c;
  }
  // 가로 띠 몇 개를 좌우로 민다(밀린 자리는 같은 띠로 감아 채워 밝기가 그대로) + 아주 옅은 줄무늬
  function stripeCanvas(src, frame, uid) {
    var c = copy(src), g = c.getContext('2d'), w = src.width, h = src.height, s = hash(uid + '|s' + frame);
    g.drawImage(src, 0, 0);
    for (var y = 0; y < h;) {
      var bh = Math.max(4, Math.round(h * (0.03 + (s % 7) / 100)));
      s = Math.imul(s ^ (s >>> 13), 1274126177) >>> 0;
      if (s % 2 === 0) {
        var dx = Math.round(w * (0.06 + (s % 6) / 100)) * (s & 8 ? 1 : -1); // 멀리(3D 작은 카드)서도 보이게 6~11%
        g.drawImage(src, 0, y, w, bh, dx, y, w, bh);
        g.drawImage(src, 0, y, w, bh, dx - Math.sign(dx) * w, y, w, bh);
      }
      y += bh;
    }
    g.fillStyle = 'rgba(16,9,58,.14)';
    for (var ly = frame % 2; ly < h; ly += 6) g.fillRect(0, ly, w, 2);
    return c;
  }
  // 빨강·파랑 채널만 좌우로 어긋낸다(초록은 그대로 → 평균 밝기 그대로)
  function rgbCanvas(src, frame) {
    var c = copy(src), g = c.getContext('2d'), w = src.width, h = src.height;
    g.drawImage(src, 0, 0);
    var img = g.getImageData(0, 0, w, h), from = new Uint8ClampedArray(img.data), d = img.data, dx = Math.max(2, Math.round(w * (frame ? 0.045 : 0.06)));
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4, r = (y * w + Math.min(w - 1, x + dx)) * 4, b = (y * w + Math.max(0, x - dx)) * 4;
      d[i] = from[r]; d[i + 2] = from[b + 2];
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  var api = { EFFECTS: EFFECTS, eligible: eligible, mark: mark, clearDist: clearDist, burst: burst, scramble: scramble, stripeCanvas: stripeCanvas, rgbCanvas: rgbCanvas };
  root.DR = root.DR || {};
  root.DR.Glitch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
