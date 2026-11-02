/*
 * 2 임무 결과 — 컨베이어 "실제 분류"(spec §5.5, code.org AI for Oceans의 그 순간).
 * 처음 보는 물건(임무 데이터, 지금 14개)이 하나씩 벨트에 올라오고, 우리 AI의 집게가 분류함 7개 중 하나에 넣는다. 맞으면 초록, 틀리면 빨강 테두리.
 * 어느 함으로 갈지는 DR.Conveyor.sort(규칙 기반, 같은 가방 = 늘 같은 결과)가 정한다. 숫자(맞힌 개수·%)는 보여 주지 않는다.
 * 위험물(건전지)이 틀린 함으로 가면 진행을 멈추고 비상 정지 창(감독관 대사 + 책임 대사) → [계속 돌리기]. 한 번만 멈춘다.
 * 이름표를 맞게 고쳤는데 개수가 모자라 실패한 장면이면 정지 창·끝 화면에 그 원인 줄(DR.Judge.fixedNotes).
 * [2배속]·[건너뛰기]. prefers-reduced-motion이면 움직이지 않고 다 분류된 함을 바로 보여 준다.
 * done()은 끝난 뒤 [결과 보기]에서만, 한 번만 부른다.
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }
  function reducedMotion() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function nameOf(mission, art) {
    if (mission.cardTypes[art]) return mission.cardTypes[art].name;
    var f = (mission.fakes || []).filter(function (x) { return x.id === art; })[0];
    return f ? f.name : art;
  }
  function binText(mission, id) { return DR.Cards.labelText(mission, id); }
  // '비상 정지! {bin} 함에 …' — 건전지가 실제로 들어간 함 이름으로
  function emergencyLine(mission, it) { return { who: mission.story.emergency.who, text: mission.story.emergency.text.replace('{bin}', binText(mission, it.bin)), face: mission.story.emergency.face }; }

  function conveyor(mission, judged, done) {
    var screen = document.getElementById('screen-conveyor');
    var items = DR.Conveyor.sort(mission, judged);
    var notes = DR.Judge.fixedNotes(mission, (DR.App.state && DR.App.state.bag) || [], judged);
    function noteEls(sceneId) { return (notes[sceneId] || []).map(function (t) { return el('p', { class: 'cv-note', text: t }); }); }
    var A = DR.CardArt, colors = A.binColors || {};
    var i = 0, timers = [], fast = false, stopped = false, finished = false, called = false, stopShown = false;
    var placed = {};

    screen.innerHTML = '';
    var claw = el('div', { class: 'cv-claw', 'aria-hidden': 'true' }, [el('i'), el('b'), el('b')]);
    var belt = el('div', { class: 'cv-belt' });
    var bins = el('div', { class: 'cv-bins' });
    mission.labels.forEach(function (l) {
      var bin = el('div', { class: 'cv-bin', 'data-bin': l.id, style: '--bin:' + (colors[l.id] || '#888') }, [
        el('div', { class: 'cv-bin-head' }, [DR.UI.iconStrip(mission, [l.id], 18), el('span', { text: l.text })]),
        el('div', { class: 'cv-bin-items' })
      ]);
      bins.appendChild(bin);
    });
    var status = el('p', { class: 'cv-status', role: 'status', 'aria-live': 'polite', text: '컨베이어가 돌아간다.' });
    var stop = el('div', { id: 'cv-stop', class: 'cv-stop', role: 'alertdialog', 'aria-label': '비상 정지' });
    stop.hidden = true;
    var stage = el('div', { class: 'cv-stage' }, [el('div', { class: 'cv-line' }, [claw, belt]), bins, stop]);
    var fastBtn = el('button', { id: 'btn-cv-fast', class: 'btn', type: 'button', text: '2배속', 'aria-pressed': 'false' });
    var skipBtn = el('button', { id: 'btn-cv-skip', class: 'btn', type: 'button', text: '건너뛰기' });
    var nextBtn = el('button', { id: 'btn-cv-next', class: 'btn btn-primary', type: 'button', text: '장면별 결과 보기' });
    nextBtn.hidden = true;
    var endBox = el('div', { class: 'cv-end' });
    endBox.hidden = true;
    screen.appendChild(el('div', { class: 'page page-wide' }, [
      el('p', { class: 'kicker', text: '실제 분류 · ' + mission.title }),
      DR.UI.line(mission.story.conveyorIntro),
      el('p', { class: 'note', text: '처음 보는 물건이 지나간다. 우리가 모은 데이터로 배운 AI가 분류함을 고른다.' }),
      stage, status, endBox,
      el('div', { class: 'actions' }, [fastBtn, skipBtn, nextBtn])
    ]));

    function stepMs() { return DR.config.conveyor.step * 1000 * (fast ? 0.5 : 1); }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function binItems(id) { return bins.querySelector('.cv-bin[data-bin="' + id + '"] .cv-bin-items'); }

    function makeItem(it) {
      var name = nameOf(mission, it.art);
      var e = el('div', { class: 'cv-item', 'data-id': it.id, 'data-bin': it.bin, 'data-correct': String(it.correct) }, [
        el('img', { src: A.card(mission, it.art, it.variant, 160).toDataURL(), alt: name + ' → ' + binText(mission, it.bin) + ' 함' })
      ]);
      placed[it.id] = e;
      return e;
    }
    function mark(e, it) { e.classList.add(it.correct ? 'ok' : 'bad'); }
    function say(it) { status.textContent = nameOf(mission, it.art) + ' → ' + binText(mission, it.bin) + ' 함'; }

    // FLIP: 벨트 위 자리에서 함 안 자리로 날아간다
    function flyTo(e, it, ms) {
      var a = e.getBoundingClientRect();
      binItems(it.bin).appendChild(e);
      var b = e.getBoundingClientRect();
      e.style.animation = 'none';
      e.style.transition = 'none';
      e.style.transform = 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top) + 'px) scale(' + (b.width ? a.width / b.width : 1) + ')';
      void e.offsetWidth;
      e.style.transition = 'transform ' + ms + 'ms ease-in-out';
      e.style.transform = '';
    }

    function next() {
      if (finished || stopped) return;
      if (i >= items.length) { finish(); return; }
      var it = items[i++], e = makeItem(it), ms = stepMs();
      e.style.setProperty('--cv-in', Math.round(ms * 0.4) + 'ms');
      belt.appendChild(e);
      belt.classList.add('run');
      later(function () {
        claw.classList.add('grab');
        flyTo(e, it, Math.round(ms * 0.45));
        mark(e, it); say(it);
        later(function () {
          claw.classList.remove('grab');
          if (it.emergency && !stopShown) showStop(it);
          else next();
        }, Math.round(ms * 0.6));
      }, Math.round(ms * 0.4));
    }

    function showStop(it) {
      stopShown = true; stopped = true;
      belt.classList.remove('run');
      DR.Sfx.play('burn');
      stop.innerHTML = '';
      var resume = el('button', { id: 'btn-cv-resume', class: 'btn btn-primary', type: 'button', text: '계속 돌리기' });
      resume.addEventListener('click', function () { DR.Sfx.play('ui'); stop.hidden = true; stopped = false; next(); });
      stop.appendChild(el('div', { class: 'cv-stop-panel' }, [
        el('img', { class: 'cv-stop-art', src: A.scene(mission, it.scene, 'danger', 320).toDataURL(), alt: '압착기 불꽃, 비상 정지' }),
        el('div', { class: 'cv-stop-body' }, [
          DR.UI.line(emergencyLine(mission, it)),
          DR.UI.line({ who: 'supervisor', text: mission.story.responsibility, face: 'worried' })
        ].concat(noteEls(it.scene)).concat([el('div', { class: 'actions' }, [resume])]))
      ]));
      stop.hidden = false;
    }

    // 남은 물건을 바로 제자리에(애니메이션 없이)
    function placeAll() {
      items.forEach(function (it) {
        var e = placed[it.id] || makeItem(it);
        binItems(it.bin).appendChild(e);
        e.style.animation = 'none'; e.style.transition = 'none'; e.style.transform = '';
        mark(e, it);
      });
    }

    function finish() {
      if (finished) return;
      finished = true; stopped = false;
      clearTimers();
      placeAll();
      stop.hidden = true;
      belt.classList.remove('run');
      claw.classList.remove('grab');
      var anyWrong = items.some(function (it) { return !it.correct; });
      var emergency = items.filter(function (it) { return it.emergency; })[0];
      status.textContent = anyWrong ? '다 분류했다. 빨간 테두리는 우리 AI가 다른 함에 넣은 물건이다.' : '다 분류했다. 모두 제자리에 들어갔다.';
      endBox.innerHTML = '';
      if (emergency && !stopShown) {
        // 건너뛰기·움직임 줄이기로 정지 창을 못 봤어도 그 순간은 남긴다
        endBox.appendChild(DR.UI.line(emergencyLine(mission, emergency)));
        endBox.appendChild(DR.UI.line({ who: 'supervisor', text: mission.story.responsibility, face: 'worried' }));
        noteEls(emergency.scene).forEach(function (n) { endBox.appendChild(n); });
      } else if (emergency) {
        endBox.appendChild(DR.UI.line({ who: 'supervisor', text: mission.story.responsibility, face: 'worried' }));
      }
      endBox.hidden = !endBox.childNodes.length;
      fastBtn.hidden = true; skipBtn.hidden = true;
      nextBtn.hidden = false;
    }

    fastBtn.addEventListener('click', function () {
      DR.Sfx.play('ui');
      fast = !fast;
      fastBtn.setAttribute('aria-pressed', String(fast));
    });
    skipBtn.addEventListener('click', function () { DR.Sfx.play('ui'); finish(); });
    nextBtn.addEventListener('click', function () {
      if (called) return;
      called = true;
      DR.Sfx.play('ui');
      clearTimers();
      done();
    });

    DR.App.go('conveyor');
    if (reducedMotion()) finish();
    else later(next, 400);
  }

  root.DR.UI.conveyor = conveyor;
})(window);
