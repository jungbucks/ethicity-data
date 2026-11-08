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

  // 초상 시트(assets/characters): 256px 4칸. 이미지 파일은 게임 안에 포함해 file://에서도 표시한다.
  //   4표정(기본·기쁨·걱정·설명): onyu·daon·robot(공통 팩)·supervisor·senior·examiner
  //   2표정(1칸 기본·2칸 걱정, 3·4칸은 1칸 복사): sorter·client·collector(수거봇, cast 키 bot)·courier(택배 기사)·grader(채점 담당 선생님) — Codex 2026-11-02, README 참고
  var SHEET_NAMES = { onyu: '온유', daon: '다온', robot: 'AI 봇', supervisor: '감독관', senior: '선배', examiner: '시험관', sorter: '선별장 직원', client: '도로 관리원', collector: '수거봇', courier: '택배 기사', grader: '채점 담당 선생님' };
  var SHEETS = { supervisor: ['supervisor', 4], senior: ['senior', 4], examiner: ['examiner', 4], sorter: ['sorter', 2], client: ['client', 2], bot: ['collector', 2], courier: ['courier', 2], grader: ['grader', 2] };
  var FACE4 = { basic: 0, happy: 1, worried: 2, explain: 3 };
  // 대사 줄 표정(face) → 칸 번호. 2표정 시트는 걱정이면 2칸, 그 밖엔 1칸. 지정이 없으면 기본
  function faceIndex(faces, face) {
    if (faces === 2) return face === 'worried' ? 1 : 0;
    return FACE4[face] || 0;
  }
  function characterPortrait(id, size, expression) {
    var names = SHEET_NAMES, S = size || 72;
    var frame = el('span', { class: 'portrait character-portrait', 'data-character': id, style: 'width:' + S + 'px;height:' + S + 'px' });
    var img = el('img', { src: 'assets/characters/' + id + '-portraits.png', alt: names[id], draggable: 'false' });
    img.style.transform = 'translateX(-' + ((expression || 0) * 25) + '%)';
    frame.appendChild(img);
    return frame;
  }

  // face = 대사 줄의 표정('basic'·'happy'·'worried'·'explain'). 시트가 없는 인물은 도형 초상
  function portrait(who, size, face) {
    var hero = root.DR.Save ? root.DR.Save.hero() : 'onyu';
    if (who === 'runner') return characterPortrait(hero, size, faceIndex(4, face));
    if (who === 'peer') return characterPortrait(hero === 'onyu' ? 'daon' : 'onyu', size, faceIndex(4, face));
    if (who === 'guide') return characterPortrait('robot', size, face ? faceIndex(4, face) : 3); // 안내 AI는 기본이 '설명'
    if (SHEETS[who]) return characterPortrait(SHEETS[who][0], size, faceIndex(SHEETS[who][1], face));
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

  function speakerName(who) {
    if (who === 'runner' && root.DR.HeroModel && root.DR.Save) return root.DR.HeroModel.names[root.DR.Save.hero()] || root.DR.Cast.runner.name;
    return root.DR.Cast[who].name;
  }
  // 장면을 보여 줄 순서: 달리기 구역 순서(mission.zones)가 있으면 그것 — 브리핑·검수·결과가 달리기와 같은 순서(1 임무 S2→S4→S3→S1)
  function sceneOrder(mission) {
    if (!mission.zones) return mission.scenes.slice();
    var byId = {};
    mission.scenes.forEach(function (s) { byId[s.id] = s; });
    var out = mission.zones.map(function (z) { return byId[z.id]; }).filter(Boolean);
    mission.scenes.forEach(function (s) { if (out.indexOf(s) < 0) out.push(s); });
    return out;
  }

  function line(l) {
    var p = root.DR.Cast[l.who];
    return el('div', { class: 'line' }, [
      portrait(l.who, 48, l.face),
      el('div', { class: 'line-body' }, [el('b', { text: speakerName(l.who), style: 'color:' + p.color }), el('p', { text: l.text })])
    ]);
  }

  // 대화창: 클릭·Space·Enter로 넘기고, 건너뛰기로 끝까지
  // 대사 줄의 bg(그림 경로)가 있으면 그 줄 동안 장면 그림을 대화창 뒤에 깐다(같은 그림이 이어지면 그대로, 바뀌면 서서히).
  //   CSS .story-bg — 그림 오른쪽(인물)을 기준으로 잘라 좁은 화면에서도 인물이 보이게, 움직임 줄이기면 바로 나타남
  function dialogue(lines, done) {
    var screen = document.getElementById('screen-story');
    var i = 0, finished = false, bgSrc = null;
    var box = el('div', { class: 'dialog', role: 'dialog', 'aria-live': 'polite' });
    var skip = el('button', { id: 'btn-skip', class: 'btn btn-ghost skip', type: 'button', text: '건너뛰기' });
    var bgImg = null; // bg 줄이 처음 나올 때 만든다(그림 없는 대화엔 빈 img를 두지 않음)
    screen.innerHTML = '';
    screen.classList.remove('has-bg');
    screen.appendChild(skip);
    screen.appendChild(box);
    function setBg(src) {
      if ((src || null) === bgSrc) return;
      bgSrc = src || null;
      screen.classList.toggle('has-bg', !!bgSrc);
      if (bgImg) bgImg.classList.remove('on');
      if (!bgSrc) return;
      if (!bgImg) {
        bgImg = el('img', { class: 'story-bg', alt: '', 'aria-hidden': 'true', draggable: 'false' });
        bgImg.onload = function () { if (bgSrc) bgImg.classList.add('on'); };
        screen.insertBefore(bgImg, screen.firstChild);
      }
      // 다 읽히면 onload가 'on'(서서히 나타남). 같은 그림으로 돌아오면 onload가 다시 안 오니 다음 프레임에 직접
      if (bgImg.getAttribute('src') !== bgSrc) bgImg.src = bgSrc;
      else if (bgImg.complete) requestAnimationFrame(function () { if (bgSrc) bgImg.classList.add('on'); });
    }
    // 대사 줄의 sheet({ mission, read })가 있으면 대화창 위에 답안 한 장(4 임무 결판 — 선배의 옛 답안, 'AI가 읽은 답')
    var sheetBox = null;
    function setSheet(sh) {
      screen.classList.toggle('has-sheet', !!sh);
      if (!sh) { if (sheetBox) { sheetBox.remove(); sheetBox = null; } return; }
      var key = sh.mission + '|' + sh.read;
      if (sheetBox && sheetBox.dataset.key === key) return;
      if (sheetBox) sheetBox.remove();
      var m = root.DR.Missions[sh.mission];
      var cap = sh.read === true ? 'AI가 읽은 답: 1 · ○' : sh.read === false ? 'AI가 읽은 답: 7 — 선택지에 없는 번호 · ✕'
        : sh.read === 'hold' ? 'AI가 읽은 답: 답 없음 — 표 끝 칸을 못 찾음 · 사람 채점' : 'AI가 읽은 답: ?';
      sheetBox = el('figure', { class: 'story-sheet', 'data-read': String(sh.read) }, [
        el('img', { src: root.DR.CardArt.sheet(m, 'senior', sh.read, 360).toDataURL(), alt: '선배의 옛 답안: 크고 오른쪽으로 기운 1을 풀이 표 끝 칸에 썼다' }),
        el('figcaption', { class: 'story-sheet-read', text: cap })
      ]);
      sheetBox.dataset.key = key;
      screen.insertBefore(sheetBox, box);
    }
    function show() {
      var l = lines[i], p = root.DR.Cast[l.who];
      setBg(l.bg);
      setSheet(l.sheet);
      box.innerHTML = '';
      box.appendChild(portrait(l.who, 72, l.face));
      box.appendChild(el('div', { class: 'dialog-body' }, [
        el('b', { class: 'dialog-name', text: speakerName(l.who), style: 'color:' + p.color }),
        el('p', { class: 'dialog-text', text: l.text }),
        el('span', { class: 'dialog-hint', text: (i + 1) + ' / ' + lines.length + ' · 눌러서 넘기기' })
      ]));
    }
    function finish() {
      if (finished) return;
      finished = true;
      root.removeEventListener('keydown', onKey);
      screen.onclick = null;
      screen.classList.remove('has-bg');
      setSheet(null);
      done();
    }
    function next() { root.DR.Sfx.play('ui'); if (++i >= lines.length) finish(); else show(); }
    function onKey(e) {
      if (e.target && e.target.tagName === 'BUTTON') return;
      if (e.code === 'Space' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) next(); }
    }
    // 화면 아무 곳이나 누르면 다음(버튼은 제외) — onclick 하나로 두어 대화가 바뀌어도 쌓이지 않게
    screen.onclick = function (e) { if (finished || (e.target.closest && e.target.closest('button'))) return; next(); };
    skip.addEventListener('click', function () { root.DR.Sfx.play('ui'); finish(); });
    root.addEventListener('keydown', onKey);
    root.DR.App.go('story');
    show();
  }

  // extraLine: 이전 임무 기록에 따른 안내 AI 한 줄(기획서 §9 '대사 변화 한 줄') — 없으면 생략
  function briefing(mission, done, extraLine) {
    var screen = document.getElementById('screen-briefing');
    var A = root.DR.CardArt;
    screen.innerHTML = '';
    var scenes = el('div', { class: 'brief-scenes' });
    sceneOrder(mission).forEach(function (s) {
      var c = A.scene(mission, s.id, 'neutral', 360);
      var img = el('img', { src: c.toDataURL(), alt: s.title });
      scenes.appendChild(el('figure', { class: 'brief-scene', 'data-scene': s.id, 'data-emphasis': s.emphasis || 'normal' }, [img, el('figcaption', { text: s.title })]));
    });
    var run = el('button', { id: 'btn-run', class: 'btn btn-primary', type: 'button', text: '달리기 시작' });
    run.addEventListener('click', function () { root.DR.Sfx.unlock(); root.DR.Sfx.play('ui'); done(); });
    screen.appendChild(el('div', { class: 'page' }, [
      el('p', { class: 'kicker', text: '브리핑 · ' + mission.title }),
      line({ who: 'guide', text: mission.story.guideBrief }),
      extraLine ? line({ who: 'guide', text: extraLine }) : null,
      el('h2', { text: mission.briefTitle || '이 AI가 판단해야 할 장면' }),
      scenes,
      root.DR.UI.legend(mission),
      mission.legendNote ? el('p', { class: 'note legend-note', text: mission.legendNote }) : null,
      el('p', { class: 'note', text: '가방은 ' + mission.bag + '칸. 무엇을 담을지는 러너가 정한다.' }),
      el('div', { class: 'actions' }, [run])
    ]));
    root.DR.App.go('briefing');
  }

  // 튜토리얼 실기 미션 안내: 달리기 전에 목표·조작·주의를 한 번에. onStart = [시작], Esc·바깥 누르기는 브리핑으로 돌아간다
  function tutorialGoal(mission, onStart) {
    var A = root.DR.CardArt, coarse = root.matchMedia && root.matchMedia('(pointer: coarse)').matches;
    var needOf = function (key) { return mission.scenes[0].combos.filter(function (c) { return c.keys.indexOf(key) >= 0; })[0].need; };
    var goal = mission.runGoal.map(function (g) { return g.name + ' 사진 ' + needOf(g.key) + '장'; }).join('과 ');
    var rows = mission.runGoal.map(function (g) {
      var slots = [];
      for (var i = 0; i < needOf(g.key); i++) {
        slots.push(el('span', { class: 'goal-slot' }, [el('img', { src: A.card(mission, g.key, i % 3, 96, i * 3 + (g.key === 'cat' ? 1 : 0)).toDataURL(), alt: '' })]));
      }
      return el('div', { class: 'goal-row', 'data-goal': g.key, role: 'img', 'aria-label': g.name + ' 빈칸 ' + needOf(g.key) + '개' }, [el('b', { class: 'goal-row-name', text: g.name })].concat(slots));
    });
    var started = false;
    var m = root.DR.UI.modal({
      title: '실기 미션',
      body: [
        el('p', { class: 'goal-lead', text: goal + '을 모으세요.' }),
        el('div', { class: 'goal-slots' }, rows),
        el('dl', { class: 'goal-notes' }, [
          el('dt', { text: '조작' }), el('dd', { text: coarse ? '좌우로 밀어 레인 이동 · 화면을 톡 눌러 잡기' : '←/→ 레인 이동 · Space 잡기' }),
          el('dt', { text: '주의' }), el('dd', { text: '불꽃은 하트 -1 · 분홍 노이즈는 카드 1장 잃음' })
        ])
      ],
      actions: [{ id: 'btn-goal-start', text: '시작', primary: true, onClick: function () { started = true; } }],
      onClose: function () { if (started) onStart(); }
    });
    var btn = m.el.querySelector('#btn-goal-start');
    btn.focus();
    // 키를 꾹 누른 채 넘어오면(브리핑의 Enter) 바로 눌리지 않게, Tab은 창 안에서만 돈다(버튼 하나라 제자리)
    m.el.addEventListener('keydown', function (e) {
      if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
      if (e.key === 'Tab') { e.preventDefault(); btn.focus(); }
    });
  }

  // 튜토리얼 결과 한 장: 통과면 [다음], 실패면 귀여운 실패 + [다시 달리기]

  // 마무리 안내(기획서 §4.7) — 대화 뒤 안내 카드
  // opts: { kicker: '○○ 완료', next: 다음 임무로 가는 함수(있으면 [다음 임무로]), summary: ['이번 판 요약 줄', …] }
  function outro(lines, done, opts) {
    opts = opts || {};
    dialogue(lines, function () {
      var screen = document.getElementById('screen-outro');
      screen.innerHTML = '';
      var again = el('button', { id: 'btn-again', class: 'btn' + (opts.next ? '' : ' btn-primary'), type: 'button', text: '타이틀로', onclick: done });
      var next = opts.next ? el('button', { id: 'btn-next-mission', class: 'btn btn-primary', type: 'button', text: '다음 임무로', onclick: function () { root.DR.Sfx.play('ui'); opts.next(); } }) : null;
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: opts.kicker || '임무 완료' }),
        el('h2', { text: opts.headline || '도시 한 구간이 다시 이어졌다' }),
        opts.summary && opts.summary.length ? el('ul', { id: 'outro-summary', class: 'outro-summary', 'aria-label': '이번 판 요약' }, opts.summary.map(function (t) { return el('li', { text: t }); })) : null,
        // 4 임무: 최종 토론 질문
        opts.questions && opts.questions.length ? el('section', { id: 'outro-questions', class: 'outro-questions', 'aria-label': '토론 질문' }, [
          el('h3', { text: '이야기해 보자' }),
          el('ol', null, opts.questions.map(function (t) { return el('li', { text: t }); }))
        ]) : null,
        // '단순화한 규칙으로 만든 시뮬레이션' 안내는 바로 앞 감독관 마무리 대사(임무 story.outro)에 한 번만 — 완료 화면에서 되풀이하지 않는다(플레이테스트 12)
        el('div', { class: 'actions' }, [next, again])
      ]));
      root.DR.App.go('outro');
    });
  }

  root.DR = root.DR || {};
  root.DR.UI = root.DR.UI || {};
  root.DR.UI.el = el;
  root.DR.UI.speakerName = speakerName;
  root.DR.UI.sceneOrder = sceneOrder;
  root.DR.UI.portrait = portrait;
  root.DR.UI.characterPortrait = characterPortrait;
  root.DR.UI.line = line;
  root.DR.UI.dialogue = dialogue;
  root.DR.UI.briefing = briefing;
  root.DR.UI.tutorialGoal = tutorialGoal;
  root.DR.UI.outro = outro;
})(window);
