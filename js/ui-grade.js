/*
 * 4 임무 결과 — 채점 시연(2 임무 컨베이어·3 임무 길 안내와 같은 순간, 설계 §5.7).
 * 처음 보는 답안지가 하나씩 올라오고, 우리 AI가 손글씨 낱말을 읽어 ○ / ✕ / 사람 채점 도장을 찍는다(낱말판 2026-11-08).
 * 줄마다 "학생이 쓴 답 · AI가 읽은 낱말"(보기 밖 낱말이면 그렇다고). 숫자(정확도 %) 없음.
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
  function wordOf(mission, id) { return DR.Cards.labelShort(mission, id); }
  // 답안지에 실제로 쓴 글(다른 표기면 ''AI' (= 인공지능)' — 같은 낱말로 보는 표기는 교사 검수 대기)
  function wrote(mission, g) {
    var t = mission.cardTypes[g.art], w = t && t.art && t.art.word, l = wordOf(mission, g.chose);
    return w && w !== l ? "'" + w + "' (= " + l + ')' : l;
  }
  function inList(mission, id) { return (mission.labels || []).some(function (l) { return l.id === id; }); }

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
      el('p', { class: 'note', text: '처음 보는 답안지들이다. 우리가 모은 손글씨로 배운 AI가 빈칸에 적힌 낱말을 읽고 채점한다.' }),
      stage, status, endBox,
      el('div', { class: 'actions' }, [fastBtn, skipBtn, nextBtn])
    ]));

    function stepMs() { return DR.config.conveyor.step * 1000 * (fast ? 0.5 : 1); }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function readText(it) {
      var g = byId[it.id];
      if (it.correct) return wordOf(mission, g.chose);
      return it.bin === 'hold' ? '못 읽음' : wordOf(mission, g.read);
    }

    // 답안지 한 장: 그림 + 학생이 고른 번호 + (채점한 뒤) AI가 읽은 번호·도장
    function makeItem(it) {
      var g = byId[it.id];
      var after = el('div', { class: 'gr-after' });
      var e = el('li', { class: 'gr-item', 'data-id': it.id, 'data-scene': it.scene, 'data-correct': String(it.correct), 'data-bin': it.bin }, [
        el('img', { class: 'gr-art', src: DR.CardArt.card(mission, g.art, g.variant, 160).toDataURL(), alt: '' }),
        el('div', { class: 'gr-body' }, [el('p', { class: 'gr-chose', text: '학생이 쓴 답: ' + wrote(mission, g) }), after])
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
      box.appendChild(el('p', { class: 'gr-read', text: 'AI가 읽은 낱말: ' + read }));
      box.appendChild(el('span', { class: 'gr-stamp gr-stamp-' + it.bin, text: STAMP[it.bin] }));
      var note = null;
      var said = wordOf(mission, g.chose), heard = g.read ? wordOf(mission, g.read) : '';
      if (!it.correct && it.bin === 'x') note = !inList(mission, g.read) ? DR.Josa.attach("'" + heard + "'", '는') + ' 보기에 없는 낱말이다. 맞게 쓴 답에 ✕가 찍혔다.'
        : '학생은 ' + said + DR.Josa.josa(said, '이라고', '라고') + ' 맞게 썼는데 ' + DR.Josa.attach(heard, '으로') + ' 읽어 ✕가 찍혔다.';
      else if (!it.correct) note = '못 읽어서 선생님이 다시 채점한다.';
      else if (g.bin === 'x') note = '정말 틀린 답이다(정답 ' + wordOf(mission, g.answer) + '). 이 ✕는 맞는 채점.';
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
      status.textContent = anyWrong ? '다 채점했다. 빨간 테두리는 맞게 쓴 답에 ✕가 찍힌 답안지, 노란 테두리는 사람 채점으로 넘긴 답안지다.' : '다 채점했다. 모두 맞게 채점했다.';
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

  // 임무 완료 화면 — 같은 답안지 전후 비교(교사 피드백 2026-11-09, DR.GradeCompare.rows). data가 null(옛 저장)이면 null
  //   넓은 화면 = 표 4칸(답안 사진 · 처음 판정 · 내가 바꾼 자료 · 마지막 판정), 좁은 화면(≤520px) = 답안지마다 카드(CSS)
  //   마지막 칸 이름은 '개선 후'가 아니라 '마지막 판정' — 고치다가 맞던 답안지가 새로 틀릴 수도 있다(kind 'worse', 리뷰 2026-11-10 ④)
  function verdictCls(v) { return v.bin === 'hold' ? 'hold' : v.correct ? 'ok' : 'bad'; }
  function gradeCompare(mission, data) {
    if (!data) return null;
    var head = el('h3', { text: '같은 답안지, 고치기 전과 뒤' });
    if (!data.rows.length) {
      return el('section', { id: 'outro-compare', class: 'outro-compare', 'aria-label': '같은 답안지, 고치기 전과 뒤' }, [head,
        el('p', { class: 'cmp-none', text: '처음 제출 때부터 채점 시연 답안지를 모두 맞게 채점했다. 바꿀 자료가 없었다.' })]);
    }
    var cols = ['답안 사진', '처음 판정', '내가 바꾼 자료', '마지막 판정'];
    var tbody = el('tbody');
    data.rows.forEach(function (r) {
      var photo = el('td', { class: 'cmp-photo', 'data-label': cols[0] }, [
        el('img', { src: DR.CardArt.card(mission, r.art, r.variant, 160).toDataURL(), alt: '답안지: ' + r.wrote }),
        el('div', null, [
          el('span', { class: 'cmp-wrote', text: '학생이 쓴 답: ' + r.wrote }),
          r.kind === 'control' ? el('span', { class: 'cmp-tag', text: '비교용 · 처음부터 맞음' })
            : r.kind === 'worse' ? el('span', { class: 'cmp-tag cmp-tag-worse', text: '새로 틀림 · 처음엔 맞았음' }) : null
        ])
      ]);
      tbody.appendChild(el('tr', { 'data-id': r.id, 'data-kind': r.kind }, [
        photo,
        el('td', { class: 'cmp-v cmp-' + verdictCls(r.before), 'data-label': cols[1], text: r.before.text }),
        el('td', { class: 'cmp-change', 'data-label': cols[2] }, [el('ul', null, r.changes.map(function (t) { return el('li', { text: t }); }))]),
        el('td', { class: 'cmp-v cmp-' + verdictCls(r.after), 'data-label': cols[3], text: r.after.text })
      ]));
    });
    var table = el('table', { class: 'cmp-table' }, [
      el('thead', null, [el('tr', null, cols.map(function (c) { return el('th', { scope: 'col', text: c }); }))]),
      tbody
    ]);
    var worse = data.rows.some(function (r) { return r.kind === 'worse'; });
    var changed = worse || data.rows.some(function (r) { return r.kind === 'changed'; });
    return el('section', { id: 'outro-compare', class: 'outro-compare', 'aria-label': '같은 답안지, 고치기 전과 뒤' }, [
      head,
      el('p', { class: 'note', text: '채점 시연에 나온 답안지 그대로다. 처음 제출과 마지막 제출을 나란히 놓았다.' }),
      table,
      worse ? el('p', { id: 'cmp-worse-note', class: 'note', text: '자료를 고치는 동안 필요한 자료가 빠지면, 맞던 답안지도 새로 틀린다.' }) : null,
      el('p', { class: 'cmp-human', text: (changed ? '같은 답안지인데 결과가 바뀌었다. ' : '') + '어떤 자료를 고칠지는 AI가 아니라 사람이 정했다.' })
    ]);
  }

  root.DR.UI.grade = grade;
  root.DR.UI.gradeCompare = gradeCompare;
})(window);
