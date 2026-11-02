/*
 * 도시 복구 화면(설계 2026-11-01 §7) — 흑백 도시가 5칸(튜토리얼 + 1~4 임무)에 맞춰 1/5씩 색을 되찾는다.
 * 깬 직후에만 한 번: 그림 assets/city/city-{from}.webp → city-{to}.webp가 0.8초 서서히(움직임 줄이기면 바로)
 * + "도시 n/5 — {그 AI가 다시 이어졌다}" + [계속]. 숫자 %·점수 없음.
 * 그림이 아직 없거나 못 읽으면(file://이라 미리 물어볼 수 없음 → <img> 오류로 판단) 그림 자리를 숨기고
 * 코드로 그린 5칸 점과 같은 문구만 — 흐름은 절대 막지 않는다. done()은 [계속]에서 한 번만.
 * dots(n, label) = 타이틀 구석 배지와 같은 5칸 점(타이틀 배지도 이것을 쓴다).
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function src(n) { return 'assets/city/city-' + n + '.webp'; }

  function dots(n, cls) {
    var row = el('span', { class: 'city-dots' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    for (var i = 0; i < 5; i++) row.appendChild(el('i', { class: i < n ? 'on' : '' }));
    return row;
  }

  function city(opts, done) {
    var screen = document.getElementById('screen-city');
    var from = opts.from, to = opts.to, called = false;
    screen.innerHTML = '';
    screen.classList.remove('city-no-art');
    var before = el('img', { class: 'city-img city-before', src: src(from), alt: '', draggable: 'false' });
    var after = el('img', { class: 'city-img city-after', src: src(to), alt: '도시 복구 ' + to + '/5', draggable: 'false' });
    var art = el('figure', { id: 'city-art', class: 'city-art' }, [before, after]);
    // 그림 자리는 두 장이 다 읽힌 뒤에만 보인다(빈 칸이 번쩍였다 사라지지 않게). 하나라도 없으면 계속 숨김(점 5칸 + 문구만)
    art.hidden = true;
    var loaded = 0;
    function onArt() { if (++loaded === 2 && !screen.classList.contains('city-no-art')) art.hidden = false; }
    function noArt() { art.hidden = true; screen.classList.add('city-no-art'); }
    before.onload = onArt; after.onload = onArt;
    before.onerror = noArt; after.onerror = noArt;
    var row = dots(from, 'city-dots-big');
    var line = el('p', { id: 'city-line', class: 'city-line', text: '도시 ' + to + '/5 — ' + opts.line });
    var next = el('button', { id: 'btn-city-next', class: 'btn btn-primary', type: 'button', text: '계속' });
    next.addEventListener('click', function () { if (called) return; called = true; DR.Sfx.play('ui'); done(); });
    screen.appendChild(el('div', { class: 'page page-center city-page' }, [
      el('p', { class: 'kicker', text: '도시 복구' }),
      art, row, line,
      el('div', { class: 'actions' }, [next])
    ]));
    screen.setAttribute('aria-label', '도시 복구 5칸 중 ' + to + '칸');
    DR.App.go('city');
    // 앞 칸 → 다음 칸: 그림은 서서히, 점은 새 칸이 켜진다
    function light() {
      after.classList.add('on');
      Array.prototype.forEach.call(row.children, function (d, i) { if (i < to) d.classList.add('on'); });
    }
    if (reducedMotion()) light();
    else setTimeout(light, 60);
  }

  DR.UI.city = city;
  DR.UI.cityDots = dots;
})(window);
