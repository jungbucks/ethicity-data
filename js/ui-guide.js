/*
 * 3 임무 결과 — 길 안내 시연(2 임무 컨베이어와 같은 순간, 설계 §4.7).
 * 시민 질문이 하나씩 올라오고, 우리 AI가 답한다. 맞게 안내하면 초록, 잘못 안내하면 빨강 + 그 까닭 한 줄(원인을 단정하지 않는다).
 * 어느 답이 틀릴지는 DR.Conveyor.sort(mission.guide 질문, 같은 원인 규칙)가 정한다 — 같은 가방 = 늘 같은 결과, 숫자 없음.
 * 위험(hazard)인 질문이 틀리면 한 번 멈추고 감독관 대사 + 책임 대사 → [계속 돌리기]. 2배속·건너뛰기·움직임 줄이기.
 * done()은 끝난 뒤 [장면별 결과 보기]에서만, 한 번만.
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function guide(mission, judged, done) {
    var screen = document.getElementById('screen-guide');
    var items = DR.Conveyor.sort(mission, judged, mission.guide);
    var byId = {};
    mission.guide.forEach(function (g) { byId[g.id] = g; });
    var notes = DR.Judge.fixedNotes(mission, (DR.App.state && DR.App.state.bag) || [], judged);
    var i = 0, timers = [], fast = false, stopped = false, finished = false, called = false, stopShown = false, shown = {};

    screen.innerHTML = '';
    var list = el('ol', { class: 'gd-list' });
    var stop = el('div', { id: 'gd-stop', class: 'cv-stop', role: 'alertdialog', 'aria-label': '안내 멈춤' });
    stop.hidden = true;
    var stage = el('div', { class: 'gd-stage' }, [list, stop]);
    var status = el('p', { class: 'cv-status', role: 'status', 'aria-live': 'polite', text: '시민들이 길을 묻는다.' });
    var fastBtn = el('button', { id: 'btn-gd-fast', class: 'btn', type: 'button', text: '2배속', 'aria-pressed': 'false' });
    var skipBtn = el('button', { id: 'btn-gd-skip', class: 'btn', type: 'button', text: '건너뛰기' });
    var nextBtn = el('button', { id: 'btn-gd-next', class: 'btn btn-primary', type: 'button', text: '장면별 결과 보기' });
    nextBtn.hidden = true;
    var endBox = el('div', { class: 'cv-end' });
    endBox.hidden = true;
    screen.appendChild(el('div', { class: 'page' }, [
      el('p', { class: 'kicker', text: '길 안내 시연 · ' + mission.title }),
      DR.UI.line(mission.story.guideIntro),
      el('p', { class: 'note', text: '처음 듣는 질문들이다. 우리가 모은 사진으로 배운 AI가 지금의 거리를 기준으로 답한다.' }),
      stage, status, endBox,
      el('div', { class: 'actions' }, [fastBtn, skipBtn, nextBtn])
    ]));

    function stepMs() { return DR.config.conveyor.step * 1000 * (fast ? 0.5 : 1); }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function outcomeOf(it) { return it.correct ? 'pass' : (it.emergency ? 'danger' : 'inconvenience'); }

    // 질문 카드: 그림(그 장면 결과 컷) + 시민 질문 + (답한 뒤) AI 답·지금과 다른 점
    function makeItem(it) {
      var g = byId[it.id];
      var answer = el('div', { class: 'gd-answer' });
      var e = el('li', { class: 'gd-item', 'data-id': it.id, 'data-scene': it.scene, 'data-correct': String(it.correct) }, [
        el('img', { class: 'gd-art', src: DR.CardArt.scene(mission, it.scene, outcomeOf(it), 200).toDataURL(), alt: '' }),
        el('div', { class: 'gd-body' }, [el('p', { class: 'gd-q', text: '시민: ' + g.q }), answer])
      ]);
      shown[it.id] = { el: e, answer: answer };
      return e;
    }
    function answer(it) {
      var s = shown[it.id] || { el: makeItem(it), answer: null };
      if (!s.el.parentNode) list.appendChild(s.el);
      var g = byId[it.id], box = shown[it.id].answer;
      if (box.childNodes.length) return;
      box.appendChild(el('p', { class: 'gd-a', text: 'AI: ' + (it.correct ? g.right : g.wrong) }));
      if (!it.correct && g.note) box.appendChild(el('p', { class: 'gd-note', text: g.note }));
      s.el.classList.add(it.correct ? 'ok' : 'bad');
      status.textContent = it.correct ? '맞게 안내했다.' : '잘못 안내했다.';
    }

    function next() {
      if (finished || stopped) return;
      if (i >= items.length) { finish(); return; }
      var it = items[i++], ms = stepMs();
      var e = makeItem(it);
      list.appendChild(e);
      if (e.scrollIntoView) e.scrollIntoView({ block: 'nearest' }); // 새 질문이 화면 밖에 생기지 않게
      later(function () {
        answer(it);
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
      var resume = el('button', { id: 'btn-gd-resume', class: 'btn btn-primary', type: 'button', text: '계속 돌리기' });
      resume.addEventListener('click', function () { DR.Sfx.play('ui'); stop.hidden = true; stopped = false; next(); });
      stop.appendChild(el('div', { class: 'cv-stop-panel' }, [
        el('img', { class: 'cv-stop-art', src: DR.CardArt.scene(mission, it.scene, 'danger', 320).toDataURL(), alt: '없는 육교로 안내, 감독관이 멈춤' }),
        el('div', { class: 'cv-stop-body' }, [
          DR.UI.line(mission.story.emergency),
          DR.UI.line({ who: 'supervisor', text: mission.story.responsibility })
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
      items.forEach(function (it) { if (!shown[it.id]) list.appendChild(makeItem(it)); answer(it); });
      stop.hidden = true;
      var anyWrong = items.some(function (it) { return !it.correct; });
      var emergency = items.filter(function (it) { return it.emergency; })[0];
      status.textContent = anyWrong ? '다 물어봤다. 빨간 테두리는 우리 AI가 잘못 안내한 질문이다.' : '다 물어봤다. 모두 지금의 거리로 안내했다.';
      endBox.innerHTML = '';
      if (emergency && !stopShown) {
        endBox.appendChild(DR.UI.line(mission.story.emergency));
        endBox.appendChild(DR.UI.line({ who: 'supervisor', text: mission.story.responsibility }));
        noteEls(emergency.scene).forEach(function (n) { endBox.appendChild(n); });
      }
      endBox.hidden = !endBox.childNodes.length;
      fastBtn.hidden = true; skipBtn.hidden = true;
      nextBtn.hidden = false;
    }

    fastBtn.addEventListener('click', function () { DR.Sfx.play('ui'); fast = !fast; fastBtn.setAttribute('aria-pressed', String(fast)); });
    skipBtn.addEventListener('click', function () { DR.Sfx.play('ui'); finish(); });
    nextBtn.addEventListener('click', function () { if (called) return; called = true; DR.Sfx.play('ui'); clearTimers(); done(); });

    DR.App.go('guide');
    if (reducedMotion()) finish();
    else later(next, 400);
  }

  root.DR.UI.guide = guide;
})(window);
