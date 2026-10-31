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
  function startChoice(clearFirst) {
    function begin(fn) { return function () { DR.Sfx.unlock(); if (clearFirst) DR.Save.clear(); fn(); }; }
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
      b.addEventListener('click', function () { DR.Sfx.play('ui'); DR.Save.setHero(id); renderHeroPick(); });
      box.appendChild(b);
    });
    box.appendChild(el('div', { class: 'hero-companion' }, [DR.UI.characterPortrait('robot', 88), el('span', { text: 'AI 봇' })]));
  }

  function renderTitle() {
    renderHeroPick();
    var box = document.getElementById('title-actions');
    if (!box) return;
    box.innerHTML = '';
    var s = DR.Save.load();
    if (s && s.mission) {
      var cont = el('button', { id: 'btn-continue', class: 'btn btn-primary', type: 'button', text: '이어하기' });
      cont.addEventListener('click', function () { DR.Sfx.unlock(); DR.Sfx.play('ui'); DR.App.resume(s); });
      var fresh = el('button', { id: 'btn-fresh', class: 'btn', type: 'button', text: '처음부터' });
      fresh.addEventListener('click', function () { DR.Sfx.play('ui'); startChoice(true); });
      box.appendChild(cont); box.appendChild(fresh);
    } else {
      var start = el('button', { id: 'btn-start', class: 'btn btn-primary', type: 'button', text: '시작하기' });
      start.addEventListener('click', function () {
        DR.Sfx.unlock(); DR.Sfx.play('ui');
        if (s && s.tutorialDone) startChoice(false); else DR.App.startTutorial();
      });
      box.appendChild(start);
    }
  }

  DR.Shell = { openPause: openPause, renderTitle: renderTitle, isPaused: function () { return !!menu; } };
})(window);
