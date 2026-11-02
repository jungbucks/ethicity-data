/*
 * 4 임무 결과 — 채점 시연(2 임무 컨베이어·3 임무 길 안내와 같은 순간, 설계 §5.7).
 * 처음 보는 답안지가 하나씩 올라오고, 우리 AI가 번호를 읽어 ○ / ✕ / 사람 채점 도장을 찍는다.
 * 줄마다 "학생이 고른 번호 · AI가 읽은 번호". 숫자(정확도 %) 없음.
 * 어느 답안지가 틀릴지는 DR.Conveyor.sort(mission.grading, 같은 원인 규칙)가 정한다 — 같은 가방 = 늘 같은 결과.
 * 맞게 쓴 답에 ✕(위험 답안지)가 찍히면 한 번 멈추고 감독관 대사 + 책임 대사 → [계속 채점]. 정말 틀린 답의 ✕는 맞는 채점(초록).
 * 2배속·건너뛰기·움직임 줄이기. done()은 끝난 뒤 [장면별 결과 보기]에서만, 한 번만.
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  var STAMP = { o: '○', x: '✕', hold: '사람 채점' };

  function grade(mission, judged, done) {
    var screen = document.getElementById('screen-grade');
    var items = DR.Conveyor.sort(mission, judged, mission.grading);
    var byId = {};
    mission.grading.forEach(function (g) { byId[g.id] = g; });
    var notes = DR.Judge.fixedNotes(mission, (DR.App.state && DR.App.state.bag) || [], judged);
    var i = 0, timers = [], fast = false, stopped = false, finished = false, called = false, stopShown = false, shown = {};

    screen.innerHTML = '';
    var list = el('ol', { class: 'gr-list' });
    var stop = el('div', { id: 'gr-stop', class: 'cv-stop', role: 'alertdialog', 'aria-label': '채점 멈춤' });
    stop.hidden = true;
    var stage = el('div', { class: 'gd-stage' }, [list, stop]);
    var status = el('p', { class: 'cv-status', role: 'status', 'aria-live': 'polite', text: '답안지가 들어온다.' });
    var fastBtn = el('button', { id: 'btn-gr-fast', class: 'btn', type: 'button', text: '2배속', 'aria-pressed': 'false' });
    var skipBtn = el('button', { id: 'btn-gr-skip', class: 'btn', type: 'button', text: '건너뛰기' });
    var nextBtn = el('button', { id: 'btn-gr-next', class: 'btn btn-primary', type: 'button', text: '장면별 결과 보기' });
    nextBtn.hidden = true;
    var endBox = el('div', { class: 'cv-end' });
    endBox.hidden = true;
    screen.appendChild(el('div', { class: 'page' }, [
      el('p', { class: 'kicker', text: '채점 시연 · ' + mission.title }),
      DR.UI.line(mission.story.gradeIntro),
      el('p', { class: 'note', text: '처음 보는 답안지들이다. 우리가 모은 손글씨로 배운 AI가 답 칸의 번호를 읽고 채점한다.' }),
      stage, status, endBox,
      el('div', { class: 'actions' }, [fastBtn, skipBtn, nextBtn])
    ]));

    function stepMs() { return DR.config.conveyor.step * 1000 * (fast ? 0.5 : 1); }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function readText(it) {
      var g = byId[it.id];
      if (it.correct) return g.chose;
      return it.bin === 'hold' ? '못 읽음' : g.read;
    }

    // 답안지 한 장: 그림 + 학생이 고른 번호 + (채점한 뒤) AI가 읽은 번호·도장
    function makeItem(it) {
      var g = byId[it.id];
      var after = el('div', { class: 'gr-after' });
      var e = el('li', { class: 'gr-item', 'data-id': it.id, 'data-scene': it.scene, 'data-correct': String(it.correct), 'data-bin': it.bin }, [
        el('img', { class: 'gr-art', src: DR.CardArt.card(mission, g.art, g.variant, 160).toDataURL(), alt: '' }),
        el('div', { class: 'gr-body' }, [el('p', { class: 'gr-chose', text: '학생이 고른 번호: ' + g.chose + '번' }), after])
      ]);
      shown[it.id] = { el: e, after: after };
      return e;
    }
    function mark(it) {
      var s = shown[it.id] || { el: makeItem(it) };
      if (!s.el.parentNode) list.appendChild(s.el);
      var g = byId[it.id], box = shown[it.id].after;
      if (box.childNodes.length) return;
      var read = readText(it);
      box.appendChild(el('p', { class: 'gr-read', text: 'AI가 읽은 번호: ' + (read === '못 읽음' ? '못 읽음' : read) }));
      box.appendChild(el('span', { class: 'gr-stamp gr-stamp-' + it.bin, text: STAMP[it.bin] }));
      var note = null;
      if (!it.correct && it.bin === 'x') note = Number(g.read) > 5 ? '시험지에 ' + g.read + '번은 없다. 맞게 쓴 답에 ✕가 찍혔다.' : '학생은 ' + g.chose + '번을 골랐는데 ' + g.read + '번으로 채점됐다.';
      else if (!it.correct) note = '못 읽어서 선생님이 다시 채점한다.';
      else if (g.bin === 'x') note = '정말 틀린 답이다(정답 ' + g.answer + '번). 이 ✕는 맞는 채점.';
      if (note) box.appendChild(el('p', { class: 'gr-note', text: note }));
      s.el.classList.add(it.correct ? 'ok' : (it.bin === 'hold' ? 'hold' : 'bad'));
      status.textContent = it.correct ? '맞게 채점했다.' : (it.bin === 'hold' ? '사람 채점으로 넘겼다.' : '맞게 쓴 답에 ✕가 찍혔다.');
    }

    function next() {
      if (finished || stopped) return;
      if (i >= items.length) { finish(); return; }
      var it = items[i++], ms = stepMs();
      var e = makeItem(it);
      list.appendChild(e);
      if (e.scrollIntoView) e.scrollIntoView({ block: 'nearest' });
      later(function () {
        mark(it);
        later(function () {
          if (it.emergency && !stopShown) showStop(it);
          else next();
        }, Math.round(ms * 0.5));
      }, Math.round(ms * 0.5));
    }

    function noteEls(sceneId) { return (notes[sceneId] || []).map(function (t) { return el('p', { class: 'cv-note', text: t }); }); }
    function showStop(it) {
      stopShown = true; stopped = true;
      DR.Sfx.play('warn');
      stop.innerHTML = '';
      var resume = el('button', { id: 'btn-gr-resume', class: 'btn btn-primary', type: 'button', text: '계속 채점' });
      resume.addEventListener('click', function () { DR.Sfx.play('ui'); stop.hidden = true; stopped = false; next(); });
      stop.appendChild(el('div', { class: 'cv-stop-panel' }, [
        el('img', { class: 'cv-stop-art', src: DR.CardArt.scene(mission, it.scene, 'danger', 320).toDataURL(), alt: '맞게 쓴 답에 ✕, 감독관이 멈춤' }),
        el('div', { class: 'cv-stop-body' }, [
          DR.UI.line(mission.story.emergency),
          DR.UI.line({ who: 'supervisor', text: mission.story.responsibility, face: 'worried' })
        ].concat(noteEls(it.scene)).concat([el('div', { class: 'actions' }, [resume])]))
      ]));
      stop.hidden = false;
      var panel = stop.querySelector('.cv-stop-panel');
      if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest' });
    }

    function finish() {
      if (finished) return;
      finished = true; stopped = false;
      clearTimers();
      items.forEach(function (it) { if (!shown[it.id]) list.appendChild(makeItem(it)); mark(it); });
      stop.hidden = true;
      var anyWrong = items.some(function (it) { return !it.correct; });
      var emergency = items.filter(function (it) { return it.emergency; })[0];
      status.textContent = anyWrong ? '다 채점했다. 빨간 테두리는 맞게 쓴 답에 ✕, 노란 테두리는 사람 채점으로 넘긴 답안지다.' : '다 채점했다. 모두 맞게 채점했다.';
      endBox.innerHTML = '';
      if (emergency && !stopShown) {
        endBox.appendChild(DR.UI.line(mission.story.emergency));
        endBox.appendChild(DR.UI.line({ who: 'supervisor', text: mission.story.responsibility, face: 'worried' }));
        noteEls(emergency.scene).forEach(function (n) { endBox.appendChild(n); });
      }
      endBox.hidden = !endBox.childNodes.length;
      fastBtn.hidden = true; skipBtn.hidden = true;
      nextBtn.hidden = false;
    }

    fastBtn.addEventListener('click', function () { DR.Sfx.play('ui'); fast = !fast; fastBtn.setAttribute('aria-pressed', String(fast)); });
    skipBtn.addEventListener('click', function () { DR.Sfx.play('ui'); finish(); });
    nextBtn.addEventListener('click', function () { if (called) return; called = true; DR.Sfx.play('ui'); clearTimers(); done(); });

    DR.App.go('grade');
    if (reducedMotion()) finish();
    else later(next, 400);
  }

  root.DR.UI.grade = grade;
})(window);
