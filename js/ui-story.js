/*
 * 이야기 화면 — 대화창, 브리핑, 튜토리얼 결과, 마무리 안내.
 * 브리핑은 임무의 목적과 장면만 보여주고 수집 목록·필요 장 수는 말하지 않는다(기획서 §4.1).
 */
(function (root) {
  'use strict';

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  // 공통 팩: 256px 표정 4칸. 이미지 파일은 게임 안에 포함해 file://에서도 표시한다.
  function characterPortrait(id, size, expression) {
    var names = { onyu: '온유', daon: '다온', robot: 'AI 봇' }, S = size || 72;
    var frame = el('span', { class: 'portrait character-portrait', 'data-character': id, style: 'width:' + S + 'px;height:' + S + 'px' });
    var img = el('img', { src: 'assets/characters/' + id + '-portraits.png', alt: names[id], draggable: 'false' });
    img.style.transform = 'translateX(-' + ((expression || 0) * 25) + '%)';
    frame.appendChild(img);
    return frame;
  }

  // 요청된 공통 캐릭터 외의 인물은 기존 도형 초상을 유지한다.
  function portrait(who, size) {
    var hero = root.DR.Save ? root.DR.Save.hero() : 'onyu';
    if (who === 'runner') return characterPortrait(hero, size);
    if (who === 'peer') return characterPortrait(hero === 'onyu' ? 'daon' : 'onyu', size);
    if (who === 'guide' || who === 'bot') return characterPortrait('robot', size, who === 'guide' ? 3 : 0);
    var p = root.DR.Cast[who], c = document.createElement('canvas'), S = size || 72;
    c.width = c.height = S * 2; c.style.width = c.style.height = S + 'px';
    c.className = 'portrait';
    var g = c.getContext('2d'), m = S, r = S * 0.8;
    g.fillStyle = p.color; g.beginPath();
    if (p.shape === 'circle') g.arc(m, m, r, 0, 7);
    else if (p.shape === 'square') g.rect(m - r * 0.85, m - r * 0.85, r * 1.7, r * 1.7);
    else if (p.shape === 'diamond') { g.moveTo(m, m - r); g.lineTo(m + r, m); g.lineTo(m, m + r); g.lineTo(m - r, m); }
    else if (p.shape === 'hex') { for (var i = 0; i < 6; i++) { var a = Math.PI / 6 + i * Math.PI / 3; g[i ? 'lineTo' : 'moveTo'](m + Math.cos(a) * r, m + Math.sin(a) * r); } }
    else { g.rect(m - r * 0.8, m - r * 0.6, r * 1.6, r * 1.3); g.moveTo(m, m - r * 0.6); g.lineTo(m, m - r); }
    g.closePath(); g.fill();
    if (p.shape === 'bot') { g.strokeStyle = p.color; g.lineWidth = S * 0.08; g.beginPath(); g.moveTo(m, m - r * 0.6); g.lineTo(m, m - r * 0.95); g.stroke(); g.beginPath(); g.arc(m, m - r, S * 0.08, 0, 7); g.fill(); }
    g.fillStyle = '#10093a';
    if (p.shape === 'hex') { g.fillRect(m - r * 0.5, m - r * 0.12, r, r * 0.22); }
    else { g.beginPath(); g.arc(m - r * 0.32, m - r * 0.08, S * 0.09, 0, 7); g.arc(m + r * 0.32, m - r * 0.08, S * 0.09, 0, 7); g.fill(); }
    return c;
  }

  function line(l) {
    var p = root.DR.Cast[l.who];
    return el('div', { class: 'line' }, [
      portrait(l.who, 48),
      el('div', { class: 'line-body' }, [el('b', { text: p.name, style: 'color:' + p.color }), el('p', { text: l.text })])
    ]);
  }

  // 대화창: 클릭·Space·Enter로 넘기고, 건너뛰기로 끝까지
  function dialogue(lines, done) {
    var screen = document.getElementById('screen-story');
    var i = 0, finished = false;
    var box = el('div', { class: 'dialog', role: 'dialog', 'aria-live': 'polite' });
    var skip = el('button', { id: 'btn-skip', class: 'btn btn-ghost skip', type: 'button', text: '건너뛰기' });
    screen.innerHTML = '';
    screen.appendChild(skip);
    screen.appendChild(box);
    function show() {
      var l = lines[i], p = root.DR.Cast[l.who];
      box.innerHTML = '';
      box.appendChild(portrait(l.who, 72));
      box.appendChild(el('div', { class: 'dialog-body' }, [
        el('b', { class: 'dialog-name', text: p.name, style: 'color:' + p.color }),
        el('p', { class: 'dialog-text', text: l.text }),
        el('span', { class: 'dialog-hint', text: (i + 1) + ' / ' + lines.length + ' · 눌러서 넘기기' })
      ]));
    }
    function finish() {
      if (finished) return;
      finished = true;
      root.removeEventListener('keydown', onKey);
      done();
    }
    function next() { root.DR.Sfx.play('ui'); if (++i >= lines.length) finish(); else show(); }
    function onKey(e) {
      if (e.target && e.target.tagName === 'BUTTON') return;
      if (e.code === 'Space' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) next(); }
    }
    box.addEventListener('click', next);
    skip.addEventListener('click', function () { root.DR.Sfx.play('ui'); finish(); });
    root.addEventListener('keydown', onKey);
    root.DR.App.go('story');
    show();
  }

  function briefing(mission, done) {
    var screen = document.getElementById('screen-briefing');
    var A = root.DR.CardArt;
    screen.innerHTML = '';
    var scenes = el('div', { class: 'brief-scenes' });
    mission.scenes.forEach(function (s) {
      var c = A.scene(mission, s.id, 'neutral', 360);
      var img = el('img', { src: c.toDataURL(), alt: s.title });
      scenes.appendChild(el('figure', { class: 'brief-scene', 'data-emphasis': s.emphasis || 'normal' }, [img, el('figcaption', { text: s.title })]));
    });
    var run = el('button', { id: 'btn-run', class: 'btn btn-primary', type: 'button', text: '달리기 시작' });
    run.addEventListener('click', function () { root.DR.Sfx.unlock(); root.DR.Sfx.play('ui'); done(); });
    screen.appendChild(el('div', { class: 'page' }, [
      el('p', { class: 'kicker', text: '브리핑 · ' + mission.title }),
      line({ who: 'guide', text: mission.story.guideBrief }),
      el('h2', { text: '이 AI가 판단해야 할 장면' }),
      scenes,
      root.DR.UI.legend(mission),
      mission.legendNote ? el('p', { class: 'note legend-note', text: mission.legendNote }) : null,
      el('p', { class: 'note', text: '가방은 ' + mission.bag + '칸. 무엇을 담을지는 러너가 정한다.' }),
      el('div', { class: 'actions' }, [run])
    ]));
    root.DR.App.go('briefing');
  }

  // 튜토리얼 결과 한 장: 통과면 [다음], 실패면 귀여운 실패 + [다시 달리기]
  function tutorialResult(mission, result, handlers) {
    var screen = document.getElementById('screen-result');
    var A = root.DR.CardArt, pass = result.allPass;
    // 실패 대사: 가방이 비었으면 따로, "한쪽만 잔뜩"은 한쪽 0장·다른 쪽 1장 이상일 때만
    var counts = root.DR.Cards.labelCounts(mission, (root.DR.App.state && root.DR.App.state.bag) || []);
    var sides = Object.keys(mission.cardTypes).map(function (k) { return counts[k] || 0; });
    var empty = sides.every(function (n) { return n === 0; });
    var oneSide = !empty && sides.some(function (n) { return n === 0; });
    var lines = pass ? mission.story.pass : empty ? mission.story.empty : oneSide ? mission.story.fail : mission.story.failFew;
    screen.innerHTML = '';
    var btn = pass
      ? el('button', { id: 'btn-next', class: 'btn btn-primary', type: 'button', text: '다음', onclick: handlers.onNext })
      : el('button', { id: 'btn-retry', class: 'btn btn-primary', type: 'button', text: '다시 달리기', onclick: handlers.onRetry });
    var parts = [
      el('p', { class: 'kicker', text: '결과 · ' + mission.title }),
      el('img', { class: 'result-art', src: A.scene(mission, mission.scenes[0].id, pass ? 'pass' : 'neutral', 480).toDataURL(), alt: mission.scenes[0].title })
    ];
    lines.forEach(function (l) { parts.push(line(l)); });
    if (!pass && !empty) root.DR.Judge.missingLines(mission, result).forEach(function (t) { parts.push(el('p', { class: 'missing', text: t })); });
    parts.push(el('div', { class: 'actions' }, [btn]));
    screen.appendChild(el('div', { class: 'page' }, parts));
    root.DR.App.go('result');
  }

  // 프롤로그: 러너 프로필 카드 + 독백이 한 줄씩 떠오른다(이름표 없는 기울인 글씨)
  function prologue(data, done) {
    var screen = document.getElementById('screen-profile');
    var i = 0, finished = false;
    var list = el('div', { class: 'mono', role: 'log', 'aria-live': 'polite' });
    var skip = el('button', { id: 'btn-skip', class: 'btn btn-ghost skip', type: 'button', text: '건너뛰기' });
    var rows = data.profile.map(function (p) { return el('div', { class: 'profile-row' }, [el('dt', { text: p.label }), el('dd', { text: p.value })]); });
    screen.innerHTML = '';
    screen.appendChild(skip);
    screen.appendChild(el('div', { class: 'page prologue' }, [
      el('div', { class: 'profile-card' }, [
        portrait('runner', 88),
        el('div', { class: 'profile-body' }, [el('p', { class: 'kicker', text: '러너 프로필' }), el('dl', {}, rows)])
      ]),
      list,
      el('p', { class: 'dialog-hint', text: '눌러서 넘기기' })
    ]));
    function show() {
      Array.prototype.forEach.call(list.children, function (p) { p.classList.add('past'); });
      list.appendChild(el('p', { class: 'mono-line', text: data.lines[i] }));
    }
    function finish() {
      if (finished) return;
      finished = true;
      root.removeEventListener('keydown', onKey);
      screen.innerHTML = '';
      done();
    }
    function next() { root.DR.Sfx.play('ui'); if (++i >= data.lines.length) finish(); else show(); }
    function onKey(e) {
      if (e.target && e.target.tagName === 'BUTTON') return;
      if (e.code === 'Space' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) next(); }
    }
    list.addEventListener('click', next);
    skip.addEventListener('click', function () { root.DR.Sfx.play('ui'); finish(); });
    root.addEventListener('keydown', onKey);
    root.DR.App.go('profile');
    show();
  }

  // 마무리 안내(기획서 §4.7) — 대화 뒤 안내 카드
  function outro(lines, done) {
    dialogue(lines, function () {
      var screen = document.getElementById('screen-outro');
      screen.innerHTML = '';
      var again = el('button', { id: 'btn-again', class: 'btn btn-primary', type: 'button', text: '처음부터 다시', onclick: done });
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: '1 임무 완료' }),
        el('h2', { text: '도시 한 구간이 다시 이어졌다' }),
        el('p', { class: 'lead', text: '이 게임의 결과는 실제 AI가 아니라 단순화한 규칙으로 만든 것이다. 실제 AI라면 무엇이 다를지, 우리가 넣는 데이터가 어떤 판단으로 이어지는지 이야기해 보자.' }),
        el('div', { class: 'actions' }, [again])
      ]));
      root.DR.App.go('outro');
    });
  }

  root.DR = root.DR || {};
  root.DR.UI = root.DR.UI || {};
  root.DR.UI.el = el;
  root.DR.UI.portrait = portrait;
  root.DR.UI.characterPortrait = characterPortrait;
  root.DR.UI.line = line;
  root.DR.UI.dialogue = dialogue;
  root.DR.UI.briefing = briefing;
  root.DR.UI.tutorialResult = tutorialResult;
  root.DR.UI.outro = outro;
  root.DR.UI.prologue = prologue;
})(window);
