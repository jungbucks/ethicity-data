/*
 * 일시정지·타이틀(P4).
 * 일시정지: HUD 버튼 · Esc · P, 탭이 숨겨지거나 창이 포커스를 잃으면 자동으로. 메뉴 = 계속하기 / 도움말 / 처음으로(확인 한 번).
 *          달리기 멈춤은 DR.Run.setPaused 하나로(run3d의 S.hidden은 그림만 쉬고, 다시 보여도 메뉴가 열려 있으면 멈춘 채).
 * 타이틀: 저장이 있으면 "이어하기"(기본)와 "처음부터"(확인), 튜토리얼을 끝낸 적이 있으면 "튜토리얼 건너뛰기"를 고를 수 있다.
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }

  /* ---------- 일시정지 ---------- */
  var menu = null;
  function running() { return DR.App.screen === 'run' && DR.Run.peek().running; }
  function resume() { DR.Run.setPaused(false); }

  function openPause() {
    if (menu || !running() || document.querySelector('dialog[open]')) return;
    DR.Run.setPaused(true);
    var leaving = false;
    menu = DR.UI.modal({
      title: '일시정지',
      body: [el('p', { class: 'note', text: '달리기를 잠깐 멈췄어요. Esc나 P를 누르면 이어서 달려요.' })],
      actions: [
        { text: '계속하기', primary: true },
        { text: '도움말', onClick: function () { leaving = true; menu.close(); DR.UI.help(DR.App.mission(), { onClose: reopen }); } },
        { text: '처음으로', onClick: function () { leaving = true; menu.close(); confirmQuit(); } }
      ],
      onClose: function () { menu = null; if (!leaving) resume(); }
    });
  }
  // 도움말·확인을 닫으면 일시정지 메뉴로 돌아온다(달리기는 계속 멈춘 채)
  function reopen() { if (running()) { DR.Run.setPaused(false); openPause(); } }

  function confirmQuit() {
    var chose = false;
    DR.UI.modal({
      title: '처음으로 갈까요?',
      body: [el('p', { text: '이번 달리기에서 잡은 카드는 저장되지 않아요. 마지막 저장 지점부터 이어 할 수 있어요.' })],
      actions: [
        { text: '처음으로', primary: true, onClick: function () { chose = true; DR.Run.stop(); DR.App.go('title'); } },
        { text: '취소' }
      ],
      onClose: function () { if (!chose) reopen(); }
    });
  }

  root.addEventListener('keydown', function (e) {
    if (DR.App.screen !== 'run') return;
    var p = e.code === 'KeyP' || e.key === 'p' || e.key === 'P';
    if (menu) { if (p) { e.preventDefault(); menu.close(); } return; } // Esc는 다이얼로그가 스스로 닫는다
    if (document.querySelector('dialog[open]')) return; // 도움말·확인 창이 떠 있으면 그 창의 Esc를 막지 않는다
    if (e.key === 'Escape' || p) { e.preventDefault(); openPause(); }
  }, true);
  // 자동 일시정지(탭 숨김·창 포커스 잃음). 자동 테스트는 여러 페이지를 오가며 달리기를 직접 조종하므로 끌 수 있게(__DR_NO_AUTOPAUSE)
  function autoPause() { if (!root.__DR_NO_AUTOPAUSE) openPause(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) autoPause(); });
  root.addEventListener('blur', autoPause);
  var pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) pauseBtn.addEventListener('click', function () { DR.Sfx.play('ui'); openPause(); });

  /* ---------- 타이틀 ---------- */
  // 시작 화면을 떠날 때의 짧은 전환(끊긴 선이 이어지며 주인공이 달려 나감) — 기능은 그대로, 0.55초 뒤 실행
  function leave(fn) { if (DR.TitleScene) DR.TitleScene.leave(fn); else fn(); }
  function startChoice(clearFirst) {
    // 처음부터: 저장과 함께 메모리의 임무 기록도 비운다(3 임무 정체 공개가 지운 기록을 인용하지 않게)
    function begin(fn) { return function () { DR.Sfx.unlock(); if (clearFirst) { DR.Save.clear(); DR.App.records = {}; } leave(fn); }; }
    var s = DR.Save.load();
    var acts = s && s.tutorialDone
      ? [{ text: '튜토리얼부터', primary: true, onClick: begin(DR.App.startTutorial) },
         { text: '튜토리얼 건너뛰기', onClick: begin(function () { DR.App.startMission('m1'); }) },
         { text: '취소' }]
      : [{ text: '처음부터', primary: true, onClick: begin(DR.App.startTutorial) }, { text: '취소' }];
    DR.UI.modal({
      title: clearFirst ? '처음부터 할까요?' : '어디서 시작할까요?',
      body: clearFirst ? [el('p', { text: '저장된 진행은 지워져요.' })] : [],
      actions: acts
    });
  }

  // 달릴 주인공(공통 팩 온유·다온) — 고르면 바로 저장, 다음 달리기부터 그 3D 모델
  function renderHeroPick() {
    var box = document.getElementById('hero-pick');
    if (!box || !DR.HeroModel) return;
    box.innerHTML = '';
    box.appendChild(el('span', { class: 'hero-pick-label', text: '달릴 주인공' }));
    var cur = DR.Save.hero();
    DR.HeroModel.ids.forEach(function (id) {
      var b = el('button', { class: 'hero-chip hero-' + id, type: 'button', 'aria-label': DR.HeroModel.names[id] }, [
        DR.UI.characterPortrait(id, 88), el('span', { text: DR.HeroModel.names[id] })
      ]);
      b.dataset.hero = id;
      b.setAttribute('aria-pressed', String(id === cur));
      b.addEventListener('click', function () {
        DR.Sfx.play('ui'); DR.Save.setHero(id); renderHeroPick();
        if (DR.TitleScene) DR.TitleScene.setHero(id);
        // 고른 카드는 잠깐 다른 표정(초상 2번째 칸)
        var img = box.querySelector('[data-hero="' + id + '"] .character-portrait img');
        if (img) { img.style.transform = 'translateX(-25%)'; setTimeout(function () { img.style.transform = 'translateX(-0%)'; }, 900); }
      });
      box.appendChild(b);
    });
  }

  // AI 봇: 달릴 주인공 묶음 밖의 안내 역할(고를 수 없음). 초상 칸·말풍선은 DR.TitleScene이 바꾼다
  function renderGuide() {
    var box = document.getElementById('title-guide');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'tl-bot' }, [DR.UI.characterPortrait('robot', 92)]));
    box.appendChild(el('p', { class: 'tl-bubble' }));
  }

  // 임무 카드: 썸네일 + 한 줄 미끼 + 상태(저장에서: 완료 / 진행 중 / 아직). 접근성 이름은 예전 칩 글자 그대로
  var MISSION_CARDS = [
    ['m1', '1 임무 · 침수 판별', '비 오는 밤, AI는 잠긴 길을 알아볼까?', 'assets/title/mission-m1.webp'],
    ['m2', '2 임무 · 분리배출', '캔 사이에 숨은 건전지, AI가 찾을까?', 'assets/title/mission-m2.webp'],
    ['m3', '3 임무 · 길 안내', '몇 년 전 사진으로 길을 알려 준다면?', 'assets/title/mission-m3.webp']
  ];
  function missionStatus(id) {
    var rec = DR.App && DR.App.records && DR.App.records[id], s = DR.Save.load();
    if (s && s.mission === id) return '진행 중';
    if (rec && rec.cleared) return '완료';
    return '아직';
  }
  function missionThumb(m, src) {
    if (src) return src;
    try { return DR.CardArt.scene(DR.Missions[m], 'S1', 'neutral', 320).toDataURL(); } catch (e) { return ''; } // 썸네일 그림이 없는 임무는 코드 그림
  }

  // 임무 고르기 — 팀원이 반복해서 볼 때 앞을 다시 하지 않게(spec §6). 고르면 그 임무 도입부터(저장된 진행은 브리핑에서 덮어씀)
  function renderMissionPick() {
    var box = document.getElementById('title-missions');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(el('span', { class: 'title-missions-label', text: '임무 고르기' }));
    MISSION_CARDS.forEach(function (p) {
      if (!DR.Missions[p[0]]) return;
      var status = missionStatus(p[0]);
      var b = el('button', { id: 'btn-' + p[0], class: 'mission-card', type: 'button', 'aria-label': p[1], 'aria-describedby': 'mc-' + p[0] + '-hook mc-' + p[0] + '-status', 'data-status': status }, [
        el('img', { class: 'mc-thumb', src: missionThumb(p[0], p[3]), alt: '' }),
        el('span', { class: 'mc-body' }, [
          el('b', { class: 'mc-title', text: p[1] }),
          el('span', { id: 'mc-' + p[0] + '-hook', class: 'mc-hook', text: p[2] }),
          el('span', { id: 'mc-' + p[0] + '-status', class: 'mc-status', text: status })
        ])
      ]);
      b.addEventListener('click', function () {
        DR.Sfx.unlock(); DR.Sfx.play('ui');
        var saved = DR.Save.load();
        if (!(saved && saved.mission)) { leave(function () { DR.App.startMission(p[0]); }); return; }
        // 저장된 진행이 있으면 먼저 묻는다(옆의 '처음부터'와 같은 결 — 이어 하려던 학생의 진행을 지키게)
        DR.UI.modal({
          title: p[1].split(' · ')[0] + '부터 할까요?',
          body: [el('p', { text: '저장된 진행은 지워져요. 하던 걸 이어 하려면 [이어하기]를 누르세요.' })],
          actions: [{ text: p[1].split(' · ')[0] + ' 시작', primary: true, onClick: function () { leave(function () { DR.App.startMission(p[0]); }); } }, { text: '취소' }]
        });
      });
      box.appendChild(b);
    });
  }

  // 이어하기 아래: 지금 어디까지 했는지(예: '2임무 · 검수부터')
  var SCREEN_TEXT = { briefing: '브리핑부터', inspect: '검수부터', result: '결과부터', prep: '보충 준비부터' };
  function progressText(s) {
    var m = s.mission === 'tutorial' ? '튜토리얼' : s.mission.replace(/^m(\d+)$/, '$1임무');
    return m + ' · ' + (SCREEN_TEXT[s.screen] || '이어서');
  }

  function renderTitle() {
    renderHeroPick();
    renderMissionPick();
    renderGuide();
    var progEl = document.getElementById('title-progress');
    if (progEl) progEl.hidden = true;
    var box = document.getElementById('title-actions');
    if (!box) return;
    box.innerHTML = '';
    var s = DR.Save.load();
    if (s && s.mission) {
      var cont = el('button', { id: 'btn-continue', class: 'btn btn-primary', type: 'button', text: '이어하기' });
      cont.addEventListener('click', function () { DR.Sfx.unlock(); DR.Sfx.play('ui'); leave(function () { DR.App.resume(s); }); });
      var fresh = el('button', { id: 'btn-fresh', class: 'btn', type: 'button', text: '처음부터' });
      fresh.addEventListener('click', function () { DR.Sfx.play('ui'); startChoice(true); });
      box.appendChild(cont); box.appendChild(fresh);
      var prog = document.getElementById('title-progress');
      if (prog) { prog.textContent = progressText(s); prog.hidden = false; }
    } else {
      var start = el('button', { id: 'btn-start', class: 'btn btn-primary', type: 'button', text: '시작하기' });
      start.addEventListener('click', function () {
        DR.Sfx.unlock(); DR.Sfx.play('ui');
        if (s && s.tutorialDone) startChoice(false); else leave(DR.App.startTutorial);
      });
      box.appendChild(start);
    }
    if (DR.TitleScene && DR.App.screen === 'title') DR.TitleScene.start();
  }

  DR.Shell = { openPause: openPause, renderTitle: renderTitle, isPaused: function () { return !!menu; } };
})(window);
