/*
 * 달리기 배경음악(BGM) — 2026-11-02. 곡 = 사용자가 Suno로 만든 「Arcade Rush」(가사 없음), assets/bgm/arcade-rush.mp3.
 *   원본 3.9MB(186kbps 48kHz, 2:48) → 112kbps 44.1kHz 스테레오 2.3MB(2:46.8). 앞 0.12초·끝 무음 1초를 덜고 끝 0.55초 페이드.
 *   곡은 마지막 타격음으로 끝나고 처음은 조용히 쌓아 올리는 도입이라, audio.loop로 그대로 되풀이한다(끝 → 처음이 곡 다시 시작처럼 이어짐).
 * 달리기 화면(app.js go('run'))에서만 — 튜토리얼·보충 달리기 포함. 다른 화면(검수·결과·브리핑·대화·쓰러짐…)으로 가면 0.6초 줄여 멈추고,
 *   다음 달리기에서는 멈춘 자리부터 이어서 0.6초 키운다.
 * 효과음(sfx.js · HUD ♪ 버튼)과 따로: 저장 키 ethicity.data.bgm('1'/'0', 없으면 켜짐 — DR.Save.bgmOn). 켬/끔 = 일시정지 메뉴의 "배경음악".
 * 볼륨 0.14(윤리시티 시리즈 공통). 탭이 숨으면 멈춤. 브라우저는 첫 클릭·키 입력 전에는 소리를 막으므로 그때 다시 시도하고,
 *   아이폰처럼 입력 안에서 한 번 틀어야 풀리는 기기를 위해 첫 입력 때 소리 없이 한 번 틀었다 멈춘다. <audio>라 file://에서도 재생.
 */
(function (root) {
  'use strict';
  var DR = root.DR;
  var VOL = 0.14, FADE = 600, SRC = 'assets/bgm/arcade-rush.mp3';
  var on = DR.Save.bgmOn(), want = false, audio = null, fadeT = null, primed = false;

  function el() {
    if (!audio) { audio = new Audio(SRC); audio.loop = true; audio.preload = 'auto'; audio.volume = 0; }
    return audio;
  }
  function active() { return on && want && !document.hidden; }
  function fadeTo(to, ms, done) {
    clearInterval(fadeT);
    var a = audio, from = a.volume, t0 = Date.now();
    fadeT = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { clearInterval(fadeT); fadeT = null; if (done) done(); }
    }, 40);
  }
  function halt() { clearInterval(fadeT); fadeT = null; if (audio) audio.pause(); }
  // 재생이 늦게 시작돼도(play() 약속) 그 사이 달리기가 끝났거나 꺼졌으면 바로 멈춘다
  function rise() { if (!active()) { halt(); return; } fadeTo(VOL, FADE); }
  function play() {
    if (!active()) return;
    var a = el();
    if (!a.paused) { fadeTo(VOL, FADE); return; } // 줄어드는 중이었으면 다시 키운다
    a.volume = 0;
    var p;
    try { p = a.play(); } catch (e) { return; }
    if (p && p.then) p.then(rise, function () { /* 첫 입력 전에는 막힘 — 다음 입력에서 다시 */ });
    else rise();
  }
  function fadeOut() {
    if (!audio || audio.paused) { halt(); return; }
    fadeTo(0, FADE, function () { if (!active()) audio.pause(); });
  }

  // app.js go()가 화면을 바꿀 때마다 부른다
  function scene(name) { want = name === 'run'; if (want) play(); else fadeOut(); }
  function set(v) {
    on = !!v; DR.Save.setBgm(on);
    var box = document.getElementById('opt-bgm'); if (box) box.checked = on;
    if (on) play(); else halt();
  }

  // 첫 입력: 막혀 있던 재생을 다시 시도하거나(달리기 중), 소리 없이 한 번 틀었다 멈춰 둔다(아이폰 잠금 풀기)
  function onInput() {
    if (!on) return;
    if (active()) { if (!audio || audio.paused) play(); return; }
    if (primed) return;
    primed = true;
    var a = el(), p;
    a.muted = true;
    try { p = a.play(); } catch (e) { a.muted = false; return; }
    var done = function () { if (!active()) a.pause(); a.muted = false; };
    if (p && p.then) p.then(done, function () { a.muted = false; primed = false; }); else done();
  }
  ['pointerdown', 'keydown'].forEach(function (t) { document.addEventListener(t, onInput, true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) halt(); else play(); });

  DR.Bgm = {
    scene: scene, set: set, isOn: function () { return on; }, audio: function () { return audio; }, // audio = 테스트용
    state: function () { return { on: on, want: want, playing: !!(audio && !audio.paused && !audio.muted), paused: !audio || audio.paused, duration: audio ? audio.duration : 0, volume: audio ? audio.volume : 0, time: audio ? audio.currentTime : 0, loop: !!(audio && audio.loop), src: SRC }; }
  };
})(window);
