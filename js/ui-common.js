/*
 * 화면 여러 곳에서 같이 쓰는 것 — 한 곳에서 만들어 재사용한다.
 *   iconStrip(mission, key|icons)  카드 아이콘 줄(옆에 글자 라벨이 있으므로 스크린리더에서는 숨김)
 *   needRevealed()                 필요 장수 공개 여부(첫 결과 이후 true) — P3·P6
 *   modal({ title, body, actions }) <dialog> 하나 — Esc·닫기로 닫히고, 열면 제목에 포커스
 *   help()                         도움말(조작·장애물·카드 범례·"?" 카드·판정 방식) — P4·P5·P6
 *   undoToast(text, onUndo)        "방금 뺀 카드 되돌리기" 5초(마지막 1장만) — P3
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }
  var KNOWN = ['day', 'night', 'flood_deep', 'flood_shallow', 'wet', 'dry', 'unknown', 'dog', 'cat'];

  function iconStrip(mission, keyOrIcons, size) {
    var icons = Array.isArray(keyOrIcons) ? keyOrIcons : ((mission.cardTypes[keyOrIcons] || {}).icons || []);
    var row = el('span', { class: 'bag-icons', 'aria-hidden': 'true' });
    icons.forEach(function (n) {
      if (KNOWN.indexOf(n) >= 0) row.appendChild(el('img', { src: DR.CardArt.icon(n, 64).toDataURL(), alt: '', width: String(size || 22), height: String(size || 22) }));
    });
    return row;
  }

  function needRevealed() { return !!(DR.App && DR.App.state && DR.App.state.needRevealed); }

  // 범례 한 줄 데이터: 미션의 labelOptions(+ 시간대, "?") 기준. 튜토리얼은 동물 두 종류
  function legendItems(mission) {
    if (!mission.labelOptions || !mission.labelOptions.length) {
      return Object.keys(mission.cardTypes).map(function (k) { return { icon: mission.cardTypes[k].icons[0], text: DR.Cards.keyLabel(mission, k) }; });
    }
    var items = [{ icon: 'day', text: '낮' }, { icon: 'night', text: '밤' }];
    mission.labelOptions.forEach(function (o) { items.push({ icon: o.id, text: o.text }); });
    if ((mission.ambiguous || []).length) items.push({ icon: 'unknown', text: '판단이 필요한 카드' });
    return items;
  }
  function legend(mission) {
    var row = el('ul', { class: 'legend', 'aria-label': '카드 아이콘 뜻' });
    legendItems(mission).forEach(function (it) {
      var entry = el('li', null, [iconStrip(mission, [it.icon], 20), el('span', { text: it.text })]);
      if (DR.Cards.labelColors[it.icon]) { entry.style.borderLeft = '5px solid ' + DR.Cards.labelColors[it.icon]; entry.style.paddingLeft = '8px'; }
      row.appendChild(entry);
    });
    return row;
  }

  /* ---------- 다이얼로그 ---------- */
  // actions: [{ text, primary, onClick }] — onClick이 false를 돌려주지 않으면 닫는다
  function modal(opts) {
    var d = el('dialog', { class: 'modal', 'aria-labelledby': 'modal-title' });
    var title = el('h2', { id: 'modal-title', tabindex: '-1', text: opts.title });
    var acts = el('div', { class: 'actions' });
    function close() { if (d.open) d.close(); }
    (opts.actions || [{ text: '닫기' }]).forEach(function (a) {
      var b = el('button', { class: 'btn' + (a.primary ? ' btn-primary' : ''), type: 'button', text: a.text });
      b.addEventListener('click', function () { DR.Sfx.play('ui'); if (!a.onClick || a.onClick() !== false) close(); });
      acts.appendChild(b);
    });
    d.appendChild(el('div', { class: 'modal-body' }, [title].concat(opts.body || []).concat([acts])));
    d.addEventListener('close', function () { d.remove(); if (opts.onClose) opts.onClose(); });
    d.addEventListener('click', function (e) { if (e.target === d) close(); }); // 바깥 누르면 닫기
    document.body.appendChild(d);
    d.showModal(); // Esc = cancel → close
    title.focus();
    return { close: close, el: d };
  }

  /* ---------- 도움말 ---------- */
  function help(mission, opts) {
    mission = mission || (DR.App && DR.App.mission && DR.App.mission());
    var coarse = root.matchMedia && root.matchMedia('(pointer: coarse)').matches;
    var body = [
      el('h3', { text: '조작' }),
      el('p', { text: coarse ? '좌우로 밀어 레인 이동 · 화면을 톡 눌러 잡기 (키보드: ←/→ 레인 이동 · Space 잡기)' : '←/→ 레인 이동 · Space 잡기 (터치: 좌우로 밀기 · 톡 눌러 잡기) · Esc/P 일시정지' }),
      el('h3', { text: '장애물' }),
      el('p', { text: '불꽃: 맞으면 HP가 줄어요. 빨간 경고가 뜬 레인을 피하세요. · 노이즈 벽: 부딪히면 잠깐 느려져요.' })
    ];
    if (mission) {
      body.push(el('h3', { text: '카드 아이콘' }), legend(mission));
      if (mission.legendNote) body.push(el('p', { class: 'note', text: mission.legendNote }));
      if ((mission.ambiguous || []).length) {
        body.push(el('h3', { text: '"?" 카드' }), el('p', { text: '단서를 보고 설명표를 붙이거나, 넣지 않기로 정해요. 정하지 않으면 넣지 않아요.' }));
      }
      body.push(el('h3', { text: '판정 방식' }), el('p', { text: '브리핑 장면마다 비슷한 사진이 충분히 있어야 AI가 알아봐요.' + (needRevealed() ? ' 조합마다 ' + needOf(mission) + '장이 필요해요.' : '') }));
    }
    return modal({ title: '도움말', body: body, onClose: opts && opts.onClose });
  }
  function needOf(mission) {
    var n = 0;
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { n = Math.max(n, c.need); }); });
    return n;
  }

  /* ---------- 되돌리기 토스트 ---------- */
  var toastTimer = null;
  function undoToast(text, onUndo) {
    var old = document.getElementById('undo-toast');
    if (old) old.remove();
    clearTimeout(toastTimer);
    var b = el('button', { class: 'btn btn-small', type: 'button', text: '방금 뺀 카드 되돌리기' });
    var t = el('div', { id: 'undo-toast', class: 'toast', role: 'status' }, [el('span', { text: text }), b]);
    b.addEventListener('click', function () { DR.Sfx.play('ui'); t.remove(); clearTimeout(toastTimer); onUndo(); });
    document.body.appendChild(t);
    toastTimer = setTimeout(function () { t.remove(); }, 5000);
  }
  function clearToast() { var t = document.getElementById('undo-toast'); if (t) t.remove(); clearTimeout(toastTimer); }

  DR.UI.iconStrip = iconStrip;
  DR.UI.needRevealed = needRevealed;
  DR.UI.legend = legend;
  DR.UI.modal = modal;
  DR.UI.help = help;
  DR.UI.undoToast = undoToast;
  DR.UI.clearToast = clearToast;
})(window);
