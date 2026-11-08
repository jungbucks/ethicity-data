/*
 * 챕터 끝(설계 docs/specs/2026-11-08-data-purpose-design.md ②) — 1~4 임무를 마친 뒤 한 번에 한 단계씩:
 *   1/3 다른 용도 요청(메시지로 옴 — 새 초상 없이) → 셋 중 고르기, 피드백 한 줄, 다시 고를 수 있음(처음·마지막 선택 저장)
 *   2/3 이번 임무 개념 질문 하나(고르기, 피드백 한 줄)
 *   3/3 짧은 생각 쓰기(문장 틀, 비워도 넘어감, 입력마다 저장)
 * 자리(app.js finishMission): 1~3 임무 = 마지막 대화 뒤·도시 복구 화면 전 / 4 임무 = 재연결 5/5 뒤·의뢰인 대사 전.
 * 저장: DR.App.records[임무].chapter = { req: { first, last }, concept: { first, last }, note } → DR.Save.setRecord('처음부터'에서 지워짐).
 *   같은 임무를 다시 깨면 이전 답을 채운 채 다시 보여 준다(처음 선택은 처음 값 그대로).
 * 점수는 매기지 않는다. ⚠️ 문장(여기 TEXT·임무 파일 chapterEnd)은 교사 검수 전 초안.
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }

  var TEXT = {
    kicker: '챕터 끝',
    title: '모은 데이터, 어디에 쓸까?',
    guide: '새 메시지가 왔습니다. 우리가 모은 데이터를 다른 데 쓰자는 요청입니다.',
    from: '새 메시지',
    ask: '어떻게 답할까?',
    again: '다른 답도 골라 볼 수 있어.',
    conceptTitle: '이번 임무 다시 보기',
    noteTitle: '짧게 남기기',
    noteHelp: '문장 틀을 채워 써 보자. 비워도 괜찮아.',
    saved: '저장했어',
    next: '다음',
    done: '마치기',
    sumReq: '다른 용도 요청: ',
    sumFirst: '처음엔 ',
    sumConcept: '개념 질문: ',
    sumRight: '맞힘',
    sumAgain: '다시 생각해 보기',
    sumNote: '내 생각: ',
    sumEmpty: '비워 둠',
    sumNone: '고르지 않음'
  };

  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  // 임무 완료 요약(#outro-summary)에 붙일 줄
  function summary(mission, data) {
    var ce = mission.chapterEnd;
    if (!ce) return [];
    var last = find(ce.choices, data.req.last), first = find(ce.choices, data.req.first);
    var req = last ? last.short + (first && first !== last ? ' (' + TEXT.sumFirst + first.short + ')' : '') : TEXT.sumNone;
    var c = find(ce.concept.choices, data.concept.last);
    return [
      TEXT.sumReq + req,
      TEXT.sumConcept + (c ? (c.correct ? TEXT.sumRight : TEXT.sumAgain) : TEXT.sumNone),
      TEXT.sumNote + (data.note && data.note.trim() ? data.note.trim() : TEXT.sumEmpty)
    ];
  }

  function chapter(mission, opts, done) {
    var ce = mission.chapterEnd, id = mission.id;
    var data = DR.Save.chapterOf(DR.App.records, id);
    var screen = document.getElementById('screen-chapter');

    function save() {
      var rec = DR.App.records[id] || {};
      rec.chapter = { req: { first: data.req.first, last: data.req.last }, concept: { first: data.concept.first, last: data.concept.last }, note: data.note };
      DR.App.records[id] = rec;
      DR.Save.setRecord(id, rec);
    }
    function pick(slot, cid) {
      if (!data[slot].first) data[slot].first = cid;
      data[slot].last = cid;
      save();
    }

    function head(step, title) {
      return [
        el('p', { class: 'kicker', text: TEXT.kicker + ' · ' + mission.title }),
        el('p', { class: 'ch-step', text: step + '/3' }),
        el('h2', { text: title })
      ];
    }
    function choiceList(list, cls, slot, onPick) {
      var group = el('div', { class: 'ch-choices', role: 'group' });
      list.forEach(function (c, i) {
        var b = el('button', { class: 'btn ch-btn ' + cls, type: 'button', 'data-choice': c.id, 'aria-pressed': data[slot].last === c.id ? 'true' : 'false' }, [
          el('span', { class: 'ch-mark', 'aria-hidden': 'true', text: String.fromCharCode(65 + i) }), el('span', { text: c.text })
        ]);
        b.addEventListener('click', function () { DR.Sfx.play('ui'); pick(slot, c.id); onPick(c.id); });
        group.appendChild(b);
      });
      return group;
    }
    function nextBtn(id2, text, enabled, onClick) {
      var b = el('button', { id: id2, class: 'btn btn-primary', type: 'button', text: text });
      b.disabled = !enabled;
      b.addEventListener('click', function () { DR.Sfx.play('ui'); onClick(); });
      return b;
    }

    // 같은 단계에서 다시 고르면 그 자리 그대로(스크롤·포커스 유지 — 좁은 화면에서 위로 튀지 않게)
    function show(step, focusChoice) {
      var keep = screen.getAttribute('data-step') === String(step) ? screen.scrollTop : 0;
      screen.innerHTML = '';
      screen.setAttribute('data-step', String(step));
      var parts;
      if (step === 1) {
        var chosen = find(ce.choices, data.req.last);
        parts = head(1, TEXT.title).concat([
          DR.UI.line({ who: 'guide', text: TEXT.guide, face: 'explain' }),
          el('div', { class: 'ch-message', role: 'article', 'aria-label': TEXT.from + ': ' + ce.from }, [
            el('p', { class: 'ch-from' }, [el('span', { class: 'ch-dot', 'aria-hidden': 'true' }), el('span', { text: TEXT.from + ' · ' }), el('b', { text: ce.from })]),
            el('p', { class: 'ch-body', text: ce.message })
          ]),
          el('h3', { class: 'ch-ask', text: TEXT.ask }),
          choiceList(ce.choices, 'ch-choice', 'req', function (cid) { show(1, cid); }),
          el('p', { id: 'ch-feedback', class: 'ch-feedback' + (chosen && chosen.best ? ' is-best' : ''), role: 'status', text: chosen ? chosen.feedback : '' }),
          chosen ? el('p', { class: 'note ch-again', text: TEXT.again }) : null,
          el('div', { class: 'actions' }, [nextBtn('btn-ch-next', TEXT.next, !!chosen, function () { show(2); })])
        ]);
      } else if (step === 2) {
        var q = ce.concept, got = find(q.choices, data.concept.last);
        parts = head(2, TEXT.conceptTitle).concat([
          el('p', { class: 'lead ch-question', text: q.question }),
          choiceList(q.choices, 'ch-concept', 'concept', function (cid) { show(2, cid); }),
          el('p', { id: 'ch-concept-feedback', class: 'ch-feedback' + (got && got.correct ? ' is-best' : ''), role: 'status', text: got ? got.feedback : '' }),
          el('div', { class: 'actions' }, [nextBtn('btn-ch-next', TEXT.next, !!got, function () { show(3); })])
        ]);
      } else {
        var area = el('textarea', { id: 'ch-note', class: 'ch-note', rows: '4', maxlength: '300', 'aria-describedby': 'ch-frame ch-note-help' });
        area.value = data.note || '';
        var status = el('p', { id: 'ch-saved', class: 'note ch-saved', role: 'status', text: '' });
        area.addEventListener('input', function () { data.note = area.value; save(); status.textContent = TEXT.saved; });
        parts = head(3, TEXT.noteTitle).concat([
          el('label', { for: 'ch-note', id: 'ch-frame', class: 'ch-frame', text: ce.frame }),
          el('p', { id: 'ch-note-help', class: 'note', text: TEXT.noteHelp }),
          area, status,
          el('div', { class: 'actions' }, [nextBtn('btn-ch-done', TEXT.done, true, function () { screen.innerHTML = ''; done(); })])
        ]);
      }
      screen.appendChild(el('div', { class: 'page ch-page' }, parts));
      screen.scrollTop = keep;
      if (focusChoice) { var fb = screen.querySelector('[data-choice="' + focusChoice + '"]'); if (fb) fb.focus(); }
    }

    DR.App.go('chapter');
    screen.removeAttribute('data-step');
    show(1);
  }

  root.DR.UI.chapter = chapter;
  root.DR.UI.chapterSummary = summary;
  root.DR.UI.chapterText = TEXT;
})(window);
