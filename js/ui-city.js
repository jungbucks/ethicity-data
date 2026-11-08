/*
 * 도시 복구 화면(설계 2026-11-01 §7, 그림·연출 = 교사 피드백 2026-11-08 feedback2) — 흑백 도시가 5칸(튜토리얼 + 1~4 임무)에 맞춰 1/5씩 색을 되찾는다.
 * 그림 assets/city/city-N.webp(1600×600, 구역 5개 × 20%, 왼쪽 N칸만 색). 깬 직후에만 한 번 "이어지는" 연출(시간 = config.city):
 *   wait(그림 두 장 읽기) → line(케이블 빛이 from 구역 끝 → to 구역 중심으로 늘어남) → reveal(city-to 겹이 새 구역 칸만 아래→위로 열림)
 *   → flash(새 구역 반짝, 마지막 칸은 케이블 전체·도시 전체) → text("도시 n/5 — …" 페이드) → ready([계속], 문구 뒤 button초).
 *   단계는 .city-page[data-phase]에 적고 CSS가 그린다. 자리 계산(좁은 화면 object-position·케이블·열리는 칸) = DR.CityLook.
 * 연출 도중 Space·Enter·클릭 = 바로 끝 상태(ready). 건너뛰기 입력은 [계속]을 누르지 않는다 — 버튼은 ready 전엔 visibility:hidden이라
 *   눌리지 않고, 키는 문서에서 받으며 버튼에 포커스를 주지 않는다. 움직임 줄이기 = 처음부터 끝 상태.
 * 그림이 없거나 못 읽으면(file://이라 미리 물어볼 수 없음 → <img> 오류) 그림 자리를 숨기고 코드로 그린 5칸 점 + 문구 + [계속] — 흐름은 절대 막지 않는다.
 * done()은 [계속]에서 한 번만. dots(n, label) = 타이틀 구석 배지와 같은 5칸 점(타이틀 배지도 이것을 쓴다).
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function src(n) { return city.path + n + '.webp'; }

  function dots(n, cls) {
    var row = el('span', { class: 'city-dots' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    for (var i = 0; i < 5; i++) row.appendChild(el('i', { class: i < n ? 'on' : '' }));
    return row;
  }

  var stopPrev = null; // 앞 화면의 타이머·키 듣기(다시 열면 정리)

  function city(opts, done) {
    if (stopPrev) stopPrev();
    var screen = document.getElementById('screen-city');
    var T = DR.config.city, from = opts.from, to = opts.to, called = false;
    var timers = [], ended = false;
    screen.innerHTML = '';
    screen.classList.remove('city-no-art', 'city-has-art');
    var before = el('img', { class: 'city-img city-before', src: src(from), alt: '', draggable: 'false' });
    var after = el('img', { class: 'city-img city-after', src: src(to), alt: '도시 복구 ' + to + '/5', draggable: 'false' });
    var cable = el('span', { class: 'city-cable', 'aria-hidden': 'true' });
    var art = el('figure', { id: 'city-art', class: 'city-art' + (to >= DR.CityLook.ZONES ? ' city-final' : '') }, [before, after, cable]);
    var vars = DR.CityLook.css(from, to);
    for (var k in vars) art.style.setProperty(k, vars[k]);
    art.style.setProperty('--city-cable-y', T.cableY);
    // 그림 자리는 두 장이 다 읽힌 뒤에만 보인다(빈 칸이 번쩍였다 사라지지 않게). 하나라도 없으면 계속 숨김(점 5칸 + 문구만)
    art.hidden = true;
    var row = dots(from, 'city-dots-big');
    var line = el('p', { id: 'city-line', class: 'city-line', text: '도시 ' + to + '/5 — ' + opts.line });
    var next = el('button', { id: 'btn-city-next', class: 'btn btn-primary', type: 'button', text: '계속' });
    next.addEventListener('click', function () { if (called || page.dataset.phase !== 'ready') return; called = true; stop(); DR.Sfx.play('ui'); done(); });
    var page = el('div', { class: 'page page-center city-page' }, [
      el('p', { class: 'kicker', text: '도시 복구' }),
      art, row, line,
      el('div', { class: 'actions city-actions' }, [next])
    ]);
    page.dataset.phase = 'wait';
    ['line', 'reveal', 'flash', 'text'].forEach(function (n) { page.style.setProperty('--city-t-' + n, T[n]); });
    screen.appendChild(page);
    screen.setAttribute('aria-label', '도시 복구 5칸 중 ' + to + '칸');

    function later(fn, s) { timers.push(setTimeout(fn, s * 1000)); }
    function set(p) { if (!ended) page.dataset.phase = p; }
    function stop() {
      timers.forEach(clearTimeout); timers = [];
      root.removeEventListener('keydown', onKey, true);
      screen.removeEventListener('click', onClick);
      if (stopPrev === stop) stopPrev = null;
    }
    // 끝 상태: city-to 전체·문구·[계속]. instant = 남은 움직임 없이 바로(건너뛰기·움직임 줄이기·그림 없음)
    function finish(instant) {
      if (ended) return;
      if (instant) page.classList.add('city-instant');
      page.dataset.phase = 'ready'; ended = true;
      stop();
    }
    function onKey(e) {
      if (ended || DR.App.screen !== 'city') return;
      // 누르고 있는 키의 되풀이(앞 대화를 Space로 넘기다 그대로 누른 채)는 건너뛰기로 치지 않는다
      if ((e.code === 'Space' || e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); e.stopPropagation(); finish(true); }
    }
    function onClick() { if (!ended) finish(true); }
    function play() {
      if (ended) return;
      set('line');
      later(function () { set('reveal'); }, T.line);
      later(function () { set('flash'); }, T.line + T.reveal);
      later(function () { set('text'); }, T.line + T.reveal + T.flash);
      later(function () { finish(false); }, T.line + T.reveal + T.flash + T.button);
    }

    var loaded = 0;
    function current() { return screen.firstChild === page; } // 다시 열린 화면이면 옛 그림의 늦은 load·error는 무시
    function onArt() {
      if (!current() || ++loaded !== 2 || screen.classList.contains('city-no-art')) return;
      art.hidden = false; screen.classList.add('city-has-art');
      play();
    }
    function noArt() { if (!current()) return; art.hidden = true; screen.classList.remove('city-has-art'); screen.classList.add('city-no-art'); finish(true); }
    before.onload = onArt; after.onload = onArt;
    before.onerror = noArt; after.onerror = noArt;

    stopPrev = stop;
    root.addEventListener('keydown', onKey, true);
    screen.addEventListener('click', onClick);
    DR.App.go('city');
    // 점 5칸(그림이 없을 때 보이는 대체 화면): 앞 칸 → 새 칸이 켜진다
    function light() { Array.prototype.forEach.call(row.children, function (d, i) { if (i < to) d.classList.add('on'); }); }
    if (reducedMotion()) { light(); finish(true); }
    else {
      setTimeout(light, 60);
      // 그림이 오래 안 오면 연출 없이 끝 상태(흐름을 막지 않게) — 늦게 와도 그림만 보인다
      later(function () { if (page.dataset.phase === 'wait') finish(true); }, T.wait);
    }
  }
  city.path = 'assets/city/city-'; // 그림 경로 앞부분(테스트가 없는 이름으로 바꿔 대체 화면을 본다)

  DR.UI.city = city;
  DR.UI.cityDots = dots;
})(window);
