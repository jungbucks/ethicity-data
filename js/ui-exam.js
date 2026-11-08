/*
 * 오프닝(세계관 도입)과 첫 시험의 검수·시연 — docs/specs/2026-11-05-opening-tutorial-draft.md
 * 오프닝: 그림이 없거나 못 읽어도 대사와 다음 버튼으로 진행한다. 글자·버튼은 그림이 아니라 화면 요소.
 * 검수: 사진은 바뀌지 않고 이름표만 바뀐다. 잘못된 카드에 경고를 붙이거나 오답 수를 먼저 알리지 않는다.
 * 시연: 잘못된 쌍이 있으면 그것부터(최대 2쌍), 바르게 고친 쌍은 같은 사진으로 다시 보여 준다.
 *       바르게 낸 사람에게 억지 오답을 보여 주지 않는다.
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }
  function num(card) { return parseInt(String(card.id).replace(/\D/g, ''), 10) || 0; }
  function photo(m, card, size) { var n = num(card); return DR.CardArt.card(m, DR.Cards.artId(card), n % 3, size, n).toDataURL(); }
  function nameOf(m, key) { return m.runGoal.filter(function (g) { return g.key === key; })[0].name; }

  /* ---------- 오프닝 ---------- */
  function say(l) {
    return el('p', { class: 'opening-line' }, [l.who ? el('b', { text: l.who + ' ' }) : null, el('span', { text: l.text })]);
  }
  function opening(data, done) {
    var screen = document.getElementById('screen-profile');
    var hero = DR.Save.hero(), heroName = (DR.HeroModel && DR.HeroModel.names[hero]) || '온유';
    var i = 0, finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      screen.innerHTML = '';
      done();
    }
    function show() {
      var b = data.beats[i], parts = [];
      screen.innerHTML = '';
      var skip = el('button', { id: 'btn-skip', class: 'btn btn-ghost skip', type: 'button', text: '건너뛰기' });
      skip.addEventListener('click', function () { DR.Sfx.play('ui'); finish(); });
      screen.appendChild(skip);
      var art = el('div', { class: 'opening-art' });
      if (b.img) {
        var img = el('img', { src: b.img.replace('{hero}', hero), alt: b.alt || '' });
        img.addEventListener('error', function () { art.classList.add('is-missing'); img.remove(); });
        art.appendChild(img);
      } else art.classList.add('is-missing');
      if (b.overlay) art.appendChild(el('span', { class: 'opening-overlay', text: b.overlay }));
      parts.push(art);
      if (b.split) {
        parts.push(el('div', { class: 'opening-split' }, [
          el('figure', { class: 'split-card' }, [el('img', { src: b.split.photo, alt: b.split.photoAlt }), el('figcaption', { text: '사진' })]),
          el('figure', { class: 'split-card split-tag' }, [el('b', { text: b.split.label }), el('figcaption', { text: '이름표' })])
        ]));
      }
      if (b.info) parts.push(el('p', { class: 'opening-info', text: b.info.replace('{hero}', heroName) }));
      if (b.lead) parts.push(el('p', { class: 'opening-lead', text: b.lead }));
      (b.lines || []).forEach(function (l) { parts.push(say(l.who === 'runner' ? { who: heroName, text: l.text } : l)); });
      if (b.note) parts.push(el('p', { class: 'opening-note', text: b.note }));
      var next = el('button', { id: 'btn-opening-next', class: 'btn btn-primary', type: 'button', text: b.action });
      next.addEventListener('click', function () { DR.Sfx.play('ui'); if (++i >= data.beats.length) finish(); else show(); });
      parts.push(el('div', { class: 'actions' }, [next]));
      screen.appendChild(el('div', { class: 'page opening', 'data-beat': b.id, 'aria-live': 'polite' }, parts));
      if (i > 0) next.focus(); // 같은 화면 안의 다음 장면만(화면 전환 때는 자동 포커스 금지 — Space 연타로 건너뛰지 않게)
    }
    show();
    DR.App.go('profile');
  }

  /* ---------- 검수 ---------- */
  function setLabel(m, card, key) {
    if (DR.Cards.originalLabel(m, card) === key) delete card.label; else card.label = key;
  }
  // 카드 크게 보기: 큰 사진 · 지금 이름표 · 이름표 고르기 + '그대로 두기'(Esc 말고도 닫을 수 있게, 플레이테스트 6). 첫 카드에서만 시험관 안내
  function openCard(m, card, first, after) {
    var now = DR.Cards.currentLabel(m, card), body = [];
    if (first) body.push(el('p', { id: 'exam-first-hint', class: 'exam-say' }, [el('b', { text: '시험관 ' }), el('span', { text: m.story.inspectHint })]));
    body.push(el('img', { class: 'exam-big', src: photo(m, card, 384), alt: '카드 사진' }));
    body.push(el('p', { id: 'exam-now', text: '지금 이름표: ' + nameOf(m, now) }));
    DR.UI.modal({
      title: '사진과 이름표 확인',
      body: body,
      actions: m.runGoal.map(function (g) {
        return { id: 'btn-label-' + g.key, text: g.name, primary: g.key === now, onClick: function () { setLabel(m, card, g.key); } };
      }).concat([{ id: 'btn-label-keep', text: '그대로 두기' }]),
      onClose: after
    });
  }
  function cell(m, card, onOpen) {
    var b = el('button', { class: 'exam-card', type: 'button', 'data-id': card.id, 'aria-label': '사진 보고 이름표 고치기, 지금 이름표 ' + DR.Cards.cardLabel(m, card) }, [
      el('img', { src: photo(m, card, 192), alt: '' }),
      el('span', { class: 'exam-tag', text: DR.Cards.cardLabel(m, card) }),
      card.label !== undefined ? el('span', { class: 'bag-fixed', text: '고침' }) : null
    ]);
    b.addEventListener('click', function () { DR.Sfx.play('ui'); onOpen(card); });
    return b;
  }
  // opts: { drill: 시험관의 연습 카드(가방 칸·개·고양이 수 밖, 이름표 점검엔 든다 — 플레이테스트 3a) · lost: 이번 달리기에서 노이즈로 잃은 장 수 }
  function examInspect(m, bag, opts, done) {
    var screen = document.getElementById('screen-inspect'), opened = false;
    function open(card) {
      var first = !opened; opened = true;
      openCard(m, card, first, function () {
        render();
        var again = screen.querySelector('.exam-card[data-id="' + card.id + '"]');
        if (again) again.focus();
      });
    }
    function render() {
      var grid = el('div', { id: 'exam-grid', class: 'exam-grid' });
      bag.forEach(function (card) { grid.appendChild(cell(m, card, open)); });
      var submit = el('button', { id: 'btn-submit', class: 'btn btn-primary', type: 'button', text: '이 자료로 시험하기' });
      submit.addEventListener('click', function () { DR.Sfx.play('ui'); done(); });
      screen.innerHTML = '';
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: '검수 · ' + m.title }),
        el('h2', { text: '가져온 사진 확인 (' + bag.length + '/' + m.bag + '칸)' }),
        el('p', { text: bag.length ? '이름표가 틀린 카드가 있을 수 있어. 카드를 눌러 사진과 이름표를 비교하고, 틀렸으면 고쳐 봐.' : '가방이 비었어.' }),
        opts.lost ? el('p', { id: 'inspect-lost', class: 'lost-line', text: '이번 달리기에서 노이즈로 잃은 카드 ' + opts.lost + '장' }) : null,
        grid,
        opts.drill ? el('section', { id: 'exam-drill', class: 'exam-drill', 'aria-labelledby': 'exam-drill-h' }, [
          el('h3', { id: 'exam-drill-h', text: '시험관의 연습 카드' }),
          el('p', { text: '이 카드도 AI가 배우는 자료야. 이름표가 맞는지 보고, 틀렸으면 고쳐 봐.' }),
          cell(m, opts.drill, open)
        ]) : null,
        el('div', { class: 'actions' }, [submit])
      ]));
    }
    render();
    DR.App.go('inspect');
  }

  /* ---------- 시연 ---------- */
  function pair(m, card, kind) {
    var label = nameOf(m, DR.Cards.currentLabel(m, card));
    return el('figure', { class: 'exam-pair ' + kind, 'data-id': card.id, 'data-kind': kind }, [
      el('img', { src: photo(m, card, 192), alt: '카드 사진' }),
      el('figcaption', null, [
        el('p', { class: 'exam-ai', text: 'AI: ' + label + '입니다.' }),
        el('p', { text: (kind === 'fixed' ? '이제 ‘' : '이 사진에 ‘') + label + '’라는 이름표를 주었어요.' })
      ])
    ]);
  }
  function shortLine(m, r) {
    return r.short.map(function (s) { return nameOf(m, s.key) + ' 사진 ' + s.n + '장'; }).join(', ') + '이 더 필요해.';
  }
  // st: App.state(bag·drill·shownWrong). h: { onFix, onRetry, onNext }
  function examDemo(m, r, st, h) {
    var screen = document.getElementById('screen-result'), kids = [];
    var C = DR.Cards, seen = st.shownWrong || [];
    var drillWrong = !!st.drill && C.isMislabeled(m, st.drill);
    var wrong = r.wrong.slice(0, 2), shown = wrong.slice();
    if (!wrong.length && drillWrong) shown = [st.drill];
    var fixed = st.bag.concat(st.drill ? [st.drill] : []).filter(function (c) { return seen.indexOf(c.id) >= 0 && !C.isMislabeled(m, c); }).slice(0, 2);
    kids.push(el('p', { class: 'kicker', text: '시험 · ' + m.title }));
    kids.push(el('h2', { text: '이 자료로 가르치면' }));
    var pairs = el('div', { id: 'exam-pairs', class: 'exam-pairs' });
    shown.forEach(function (c) { pairs.appendChild(pair(m, c, 'wrong')); });
    fixed.forEach(function (c) { pairs.appendChild(pair(m, c, 'fixed')); });
    var good = !shown.length && !fixed.length ? st.bag.filter(function (c) { return !C.isMislabeled(m, c); }).slice(0, 2) : [];
    good.forEach(function (c) { pairs.appendChild(pair(m, c, 'good')); });
    if (pairs.childNodes.length) kids.push(pairs);

    var check = el('ul', { id: 'exam-check', class: 'exam-check' });
    m.runGoal.forEach(function (g) {
      check.appendChild(el('li', { 'data-goal': g.key, text: g.name + ' 사진 ' + r.have[g.key] + ' / ' + r.need[g.key] + '장' }));
    });
    // 연습 카드도 AI가 배우는 자료라 이름표 점검에 넣는다(안 고치면 넘어갈 수 없으니 점검표도 그만큼 틀렸다고 말한다)
    var total = st.bag.length + (st.drill ? 1 : 0), right = total - r.wrong.length - (drillWrong ? 1 : 0);
    check.appendChild(el('li', { 'data-goal': 'labels', text: '이름표가 맞는 카드 ' + right + ' / ' + total + '장' }));
    kids.push(el('section', { id: 'exam-points', 'aria-labelledby': 'exam-points-h' }, [el('h3', { id: 'exam-points-h', text: '시험용 자료 점검' }), check]));

    function examiner(text) { kids.push(el('p', { class: 'exam-say' }, [el('b', { text: '시험관 ' }), el('span', { text: text })])); }
    var actions = [];
    function button(id, text, fn, primary) {
      var b = el('button', { id: id, class: 'btn' + (primary ? ' btn-primary' : ''), type: 'button', text: text });
      b.addEventListener('click', function () { DR.Sfx.play('ui'); fn(); });
      actions.push(b);
    }
    if (shown.length) {
      var c0 = shown[0], truth = nameOf(m, C.truthKey(m, c0)), given = nameOf(m, C.currentLabel(m, c0));
      examiner(m.story.wrongLine.replace('{truth}', truth).replace('{given}', given));
    }
    if (r.short.length) {
      examiner(r.empty ? m.story.emptyLine : shortLine(m, r));
      button('btn-retry', '다시 수집', h.onRetry, true);
      if (r.wrong.length || st.bag.length) kids.push(el('p', { id: 'exam-retry-note', class: 'dialog-hint', text: '다시 수집하면 가방을 비우고 처음부터 달려요.' }));
      if (shown.length) button('btn-fix', '이름표 고치기', h.onFix);
    } else if (shown.length) {
      button('btn-fix', '이름표 고치기', h.onFix, true);
    } else {
      examiner(fixed.length ? m.story.fixedLine : m.story.goodLine);
      button('btn-next', '다음', h.onNext, true);
    }
    kids.push(el('div', { class: 'actions' }, actions));
    kids.push(el('p', { id: 'exam-note', class: 'dialog-hint', text: m.story.simNote }));
    st.shownWrong = seen.concat(shown.map(function (c) { return c.id; }).filter(function (id) { return seen.indexOf(id) < 0; }));
    screen.innerHTML = '';
    screen.appendChild(el('div', { class: 'page' }, kids));
    DR.App.go('result');
  }

  root.DR = root.DR || {};
  root.DR.UI = root.DR.UI || {};
  root.DR.UI.opening = opening;
  root.DR.UI.examInspect = examInspect;
  root.DR.UI.examDemo = examDemo;
})(window);
