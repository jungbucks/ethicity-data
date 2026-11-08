/*
 * 효과음 — 소리 파일 없이 Web Audio로 합성(file:// 오프라인). 첫 사용자 입력 뒤 AudioContext를 만든다.
 * 켬/끔은 ethicity.data.sound(DR.Save, 시리즈 규칙). 저장소가 막혀도 동작.
 */
(function (root) {
  'use strict';

  var ctx = null;
  var muted = !root.DR.Save.soundOn();

  function audio() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(a, freq, to, dur, type, vol, delay) {
    var t0 = a.currentTime + (delay || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(a, dur, vol) {
    var n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  }

  var SOUNDS = {
    grab: function (a) { tone(a, 660, 990, 0.09, 'triangle', 0.18); },
    perfect: function (a) { tone(a, 880, 0, 0.08, 'triangle', 0.16); tone(a, 1320, 0, 0.14, 'triangle', 0.14, 0.06); tone(a, 1760, 0, 0.12, 'sine', 0.08, 0.12); },
    hit: function (a) { noise(a, 0.18, 0.35); tone(a, 140, 70, 0.18, 'square', 0.08); },
    drop: function (a) { tone(a, 620, 180, 0.32, 'sawtooth', 0.12); tone(a, 310, 110, 0.32, 'triangle', 0.1, 0.04); },
    lane: function (a) { tone(a, 320, 260, 0.04, 'square', 0.04); },
    warn: function (a) { tone(a, 1180, 0, 0.07, 'square', 0.07); tone(a, 1180, 0, 0.07, 'square', 0.07, 0.12); },
    burn: function (a) { noise(a, 0.3, 0.45); tone(a, 220, 60, 0.3, 'sawtooth', 0.1); },
    full: function (a) { tone(a, 200, 160, 0.14, 'square', 0.1); },
    ui: function (a) { tone(a, 520, 0, 0.06, 'triangle', 0.1); },
    // 컨베이어: 집게가 물건을 함으로 옮길 때 짧은 '톡'
    sort: function (a) { tone(a, 380, 620, 0.07, 'triangle', 0.12); tone(a, 760, 0, 0.05, 'sine', 0.06, 0.05); }
  };

  function play(name) {
    if (root.__DR_SFX_LOG) root.__DR_SFX_LOG.push(name); // 테스트용 기록(테스트가 켤 때만)
    if (muted || !SOUNDS[name]) return;
    var a = audio();
    if (!a) return;
    if (a.state === 'suspended') a.resume();
    try { SOUNDS[name](a); } catch (e) { /* 소리 실패는 게임을 막지 않는다 */ }
  }

  var Sfx = {
    play: play,
    get muted() { return muted; },
    setMuted: function (m) {
      muted = !!m;
      root.DR.Save.setSound(!muted);
    },
    unlock: function () { var a = audio(); if (a && a.state === 'suspended') a.resume(); }
  };

  root.DR = root.DR || {};
  root.DR.Sfx = Sfx;
})(window);
