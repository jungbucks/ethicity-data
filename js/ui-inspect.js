/*
 * 검수(기획서 §4.3) · 감독관 질문(§4.4) · 보충 준비(§4.6).
 * 카드마다 글자 라벨("밤 · 정상(젖음)")을 붙이고, 장면별로 조합마다 "현재 n장"을 보여 준다.
 * 라벨과 개수는 언제나 "카드에 붙은 설명표" 기준(가짜의 정체·"?" 정답 여부는 드러내지 않음).
 * 필요 장수(need)는 첫 결과 이후에만 "n / 2장"으로 공개 — 첫 판은 스스로 균형을 고민하게.
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }

  function variantOf(card) { return parseInt(String(card.id).replace(/\D/g, ''), 10) % 3 || 0; }
  function cardId(card) { return DR.Cards.artId(card); }
  function ambDef(mission, id) { return mission.ambiguous.filter(function (a) { return a.id === id; })[0]; }
  function labelText(mission, id) { var o = mission.labelOptions.filter(function (x) { return x.id === id; })[0]; return o ? o.text : ''; }
  function cardLabel(mission, card) { return DR.Cards.cardLabel(mission, card); }

  // 플레이어가 붙인 대로의 key("?" 카드: 맞으면 truthKey, 틀리면 같은 시간대·같은 설명표의 일반 key)
  function effectiveKey(mission, card) {
    if (card.key) return card.key;
    if (!card.assigned) return null;
    var q = ambDef(mission, card.ambiguousId);
    if (card.assigned === q.correctLabel) return q.truthKey;
    var keys = Object.keys(mission.cardTypes);
    for (var i = 0; i < keys.length; i++) {
      var ic = mission.cardTypes[keys[i]].icons;
      if (ic[0] === q.icons[0] && ic[1] === card.assigned && !mission.cardTypes[keys[i]].rare) return keys[i];
    }
    return null;
  }

  function thumbUrl(mission, card) {
    var A = DR.CardArt;
    return A.thumb(A.card(mission, cardId(card), variantOf(card), 192), 24).toDataURL();
  }

  // 장면별 모아 보기의 그림: 붙은 설명표(“?”는 붙인 설명표의 보통 종류)를 쓰는 장면에 놓는다
  function inScene(mission, card, keys) { var k = DR.Cards.displayKey(mission, card); return !!(k && keys[k]); }

  // 조합 한 줄: 아이콘 + 라벨 + 현재 n장(공개 뒤 "n / 2장")
  function comboCount(mission, counts, c) { return c.keys.reduce(function (n, k) { return n + (counts[k] || 0); }, 0); }
  function countText(have, need) { return DR.UI.needRevealed() ? have + ' / ' + need + '장' : '현재 ' + have + '장'; }
  function comboRow(mission, counts, c) {
    var have = comboCount(mission, counts, c), label = DR.Cards.keyLabel(mission, c.keys[0]);
    var short = DR.UI.needRevealed() && have < c.need;
    return el('li', { class: 'combo' + (short ? ' short' : ''), 'data-combo': c.id }, [
      DR.UI.iconStrip(mission, c.keys[0], 20), el('span', { class: 'combo-label', text: label }), el('b', { class: 'combo-count', text: countText(have, c.need) })
    ]);
  }

  // 가방 격자 — opts: { onOpen(card), onRemove(card), newIds }
  function bagGrid(mission, bag, gridId, opts) {
    var grid = el('div', { id: gridId, class: 'bag-grid' });
    bag.forEach(function (card) {
      var amb = !!card.ambiguousId, label = cardLabel(mission, card);
      var state = amb && card.assigned === undefined ? '아직 안 정함' : '';
      var isNew = opts.newIds && opts.newIds.indexOf(card.id) >= 0;
      var open = el('button', { class: 'bag-open', type: 'button', 'aria-label': (amb ? '"?" 카드 열기: ' : '크게 보기: ') + label + (isNew ? ' (새로 담음)' : '') }, [
        el('img', { src: thumbUrl(mission, card), alt: '' }),
        DR.UI.iconStrip(mission, DR.Cards.iconsOf(mission, card)),
        el('span', { class: 'bag-label', text: label }),
        state ? el('span', { class: 'bag-state', text: state }) : null,
        isNew ? el('span', { class: 'badge-new', 'aria-hidden': 'true', text: 'NEW' }) : null
      ]);
      if (opts.onOpen) open.addEventListener('click', function () { opts.onOpen(card); });
      var rm = el('button', { class: 'btn-remove', type: 'button', text: '빼기', 'aria-label': '빼기: ' + label });
      rm.addEventListener('click', function () { DR.Sfx.play('ui'); opts.onRemove(card); });
      grid.appendChild(el('div', { class: 'bag-card' + (amb ? ' ambiguous' : '') + (amb && card.assigned === undefined ? ' undecided' : '') + (isNew ? ' is-new' : ''), 'data-id': card.id, 'data-key': card.key || card.ambiguousId || card.fakeId }, [open, rm]));
    });
    return grid;
  }

  // 빼기 + 되돌리기(마지막 1장만, 5초)
  function removeWithUndo(mission, bag, card, rerender) {
    var at = bag.indexOf(card);
    if (at < 0) return;
    bag.splice(at, 1);
    rerender();
    DR.UI.undoToast('뺐어요: ' + cardLabel(mission, card), function () {
      bag.splice(Math.min(at, bag.length), 0, card);
      rerender();
    });
  }

  /* ---------- 검수 ---------- */
  // opts.newIds = 이번 보충 달리기에서 새로 담은 카드 id(NEW 표시)
  function inspect(mission, bag, done, opts) {
    opts = opts || {};
    var screen = document.getElementById('screen-inspect');
    var zoomed = null, zoomCleanup = null;

    function render() {
      var undecided = bag.filter(function (c) { return c.ambiguousId && c.assigned === undefined; }).length;
      var counts = DR.Cards.labelCounts(mission, bag);
      screen.innerHTML = '';
      var notice = el('p', { id: 'inspect-undecided', class: 'notice', text: '아직 정하지 않은 "?" 카드 ' + undecided + '장 — 정하지 않으면 넣지 않아요.' });
      notice.hidden = undecided === 0;
      var scenes = el('div', { id: 'inspect-scenes' });
      mission.scenes.forEach(function (s) {
        var keys = {};
        s.combos.forEach(function (c) { c.keys.forEach(function (k) { keys[k] = true; }); });
        var row = el('div', { class: 'scene-thumbs' });
        bag.forEach(function (card) {
          if (inScene(mission, card, keys)) row.appendChild(el('img', { src: thumbUrl(mission, card), alt: '' }));
        });
        if (!row.childNodes.length) row.appendChild(el('span', { class: 'empty', text: '이 장면에 해당하는 카드가 보이지 않는다' }));
        var combos = el('ul', { class: 'combo-list' });
        s.combos.forEach(function (c) { combos.appendChild(comboRow(mission, counts, c)); });
        scenes.appendChild(el('section', { class: 'scene-sum', 'data-scene': s.id }, [el('h3', { text: s.title }), combos, row]));
      });
      var submit = el('button', { id: 'btn-submit', class: 'btn btn-primary', type: 'button', text: '감독관에게 제출' });
      submit.addEventListener('click', function () { DR.Sfx.play('ui'); DR.UI.clearToast(); done(bag); });
      var helpBtn = el('button', { id: 'btn-help-inspect', class: 'btn btn-ghost btn-help', type: 'button', text: '?', 'aria-label': '도움말' });
      helpBtn.addEventListener('click', function () { DR.Sfx.play('ui'); DR.UI.help(mission); });
      screen.appendChild(helpBtn);
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: '검수 · ' + mission.title }),
        el('h2', { text: '가방 확인 (' + bag.length + '/' + mission.bag + '칸)' }),
        el('p', { class: 'note', text: '카드를 누르면 크게 볼 수 있다. "?" 카드는 단서를 보고 설명표를 붙이거나, 넣지 않기로 정한다.' }),
        notice,
        bagGrid(mission, bag, 'inspect-grid', {
          onOpen: openZoom, newIds: opts.newIds,
          onRemove: function (card) { removeWithUndo(mission, bag, card, render); }
        }),
        el('h2', { text: '장면별로 모아 보기' }),
        scenes,
        el('div', { class: 'actions' }, [submit])
      ]));
      if (zoomed) openZoom(zoomed);
    }

    function openZoom(card) {
      if (zoomCleanup) zoomCleanup();
      zoomed = card;
      var A = DR.CardArt, amb = !!card.ambiguousId, label = cardLabel(mission, card);
      var big = A.card(mission, cardId(card), variantOf(card), 320);
      var inner = [
        el('img', { class: 'zoom-art', src: big.toDataURL(), alt: '카드 원본: ' + label }),
        el('p', { class: 'zoom-label' }, [DR.UI.iconStrip(mission, DR.Cards.iconsOf(mission, card)), el('span', { text: label })])
      ];
      if (amb) {
        var q = ambDef(mission, card.ambiguousId);
        var clues = el('div', { class: 'clues' });
        q.clues.forEach(function (cl, i) {
          clues.appendChild(el('figure', { class: 'clue' }, [el('img', { src: A.clue(mission, q.id, i, 256).toDataURL(), alt: cl.text }), el('figcaption', { text: cl.text })]));
        });
        var labels = el('div', { class: 'labels', role: 'group', 'aria-label': '설명표 붙이기' });
        mission.labelOptions.concat([{ id: 'none', text: '넣지 않기' }]).forEach(function (o) {
          var val = o.id === 'none' ? null : o.id;
          var b = el('button', { class: 'btn btn-label', type: 'button', 'data-label': o.id, text: o.text, 'aria-pressed': card.assigned === val ? 'true' : 'false' });
          b.addEventListener('click', function () { DR.Sfx.play('ui'); card.assigned = val; render(); });
          labels.appendChild(b);
        });
        inner.push(el('h3', { text: '추가 단서' }), clues, el('h3', { text: '설명표' }), labels);
      }
      var close = el('button', { class: 'btn btn-ghost', type: 'button', text: '닫기' });
      var panel = el('div', { class: 'zoom-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': '카드 크게 보기: ' + label }, inner.concat([el('div', { class: 'actions' }, [close])]));
      var overlay = el('div', { id: 'inspect-zoom', class: 'zoom' }, [panel]);
      // 다시 그릴 때 keydown 리스너가 쌓이지 않게 정리 함수를 하나만 둔다
      function cleanup() { overlay.remove(); root.removeEventListener('keydown', onKey); zoomCleanup = null; }
      function shut() { zoomed = null; cleanup(); }
      function onKey(e) { if (e.key === 'Escape') shut(); }
      close.addEventListener('click', shut);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) shut(); });
      root.addEventListener('keydown', onKey);
      zoomCleanup = cleanup;
      screen.appendChild(overlay);
      close.focus();
    }

    DR.App.go('inspect');
    render();
  }

  /* ---------- 감독관 ---------- */
  function supervisor(question, back, submit) {
    var screen = document.getElementById('screen-supervisor');
    screen.innerHTML = '';
    var b = el('button', { id: 'btn-back', class: 'btn', type: 'button', text: '검수로 돌아가기' });
    var c = el('button', { id: 'btn-confirm', class: 'btn btn-primary', type: 'button', text: '제출' });
    b.addEventListener('click', function () { DR.Sfx.play('ui'); back(); });
    c.addEventListener('click', function () { DR.Sfx.play('ui'); submit(); });
    screen.appendChild(el('div', { class: 'page page-center' }, [
      el('p', { class: 'kicker', text: '승인 전' }),
      DR.UI.line({ who: 'supervisor', text: question }),
      el('div', { class: 'actions' }, [b, c])
    ]));
    DR.App.go('supervisor');
  }

  /* ---------- 보충 준비 ---------- */
  // 정리한 뒤 모자란 조합이 없으면(가짜만 빼면 되는 경우) 달리지 않고 다시 제출 — done(bag, { resubmit: true }), spec §3.5
  function supplementPrep(mission, result, bag, done) {
    var screen = document.getElementById('screen-prep');
    var need = Math.min(DR.config.supplementFreeSlots, mission.bag);
    var comboById = {};
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { comboById[c.id] = c; }); });
    // 종류(key)마다 필요한 최대 장수 — 여유 계산용
    var needByKey = {};
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { c.keys.forEach(function (k) { needByKey[k] = Math.max(needByKey[k] || 0, c.need); }); }); });

    function removeOneOf(key) {
      for (var i = bag.length - 1; i >= 0; i--) if (DR.Cards.displayKey(mission, bag[i]) === key) { removeWithUndo(mission, bag, bag[i], render); return; }
    }

    function render() {
      var resubmit = Object.keys(DR.Judge.shortfall(mission, bag, DR.config)).length === 0;
      var free = mission.bag - bag.length, lack = resubmit ? 0 : Math.max(0, need - free);
      var counts = DR.Cards.labelCounts(mission, bag);
      screen.innerHTML = '';

      // 놓친 장면 + 그 장면에서 모자란 카드 종류(아이콘 + 라벨 + 부족 n장)
      var failed = el('ul', { id: 'prep-failed', class: 'failed' });
      result.scenes.forEach(function (s) {
        if (s.pass) return;
        var sc = mission.scenes.filter(function (x) { return x.id === s.id; })[0];
        var shorts = el('ul', { class: 'combo-list' });
        s.missing.forEach(function (id) {
          var c = comboById[id], have = comboCount(mission, counts, c);
          shorts.appendChild(el('li', { class: 'combo short', 'data-combo': id }, [
            DR.UI.iconStrip(mission, c.keys[0], 20), el('span', { class: 'combo-label', text: DR.Cards.keyLabel(mission, c.keys[0]) }),
            el('b', { class: 'combo-count', text: have < c.need ? '부족 ' + (c.need - have) + '장' : '설명표를 다시 살펴봐요' })
          ]));
        });
        failed.appendChild(el('li', null, [el('span', { text: sc.title }), s.missing.length ? shorts : null]));
      });

      // 종류별 요약: 개수 · 여유 n장 · 1장 빼기
      var summary = el('ul', { id: 'prep-summary', class: 'kind-list' });
      Object.keys(counts).forEach(function (k) {
        var extra = counts[k] - (needByKey[k] || 0);
        var minus = el('button', { class: 'btn btn-small', type: 'button', text: '1장 빼기', 'aria-label': DR.Cards.keyLabel(mission, k) + ' 1장 빼기' });
        minus.addEventListener('click', function () { DR.Sfx.play('ui'); removeOneOf(k); });
        summary.appendChild(el('li', { class: 'kind', 'data-key': k }, [
          DR.UI.iconStrip(mission, k, 20), el('span', { class: 'combo-label', text: DR.Cards.keyLabel(mission, k) }),
          el('b', { class: 'combo-count', text: counts[k] + '장' + (extra > 0 ? ' · 여유 ' + extra + '장' : '') }), minus
        ]));
      });

      var go = el('button', { id: 'btn-supplement', class: 'btn btn-primary', type: 'button', text: resubmit ? '다시 제출' : '보충 달리기 출발' });
      go.disabled = lack > 0;
      go.addEventListener('click', function () { DR.Sfx.unlock(); DR.Sfx.play('ui'); DR.UI.clearToast(); done(bag, { resubmit: resubmit }); });
      var note = resubmit ? '모자란 카드는 없다. 가방을 정리했으면 다시 제출하자.'
        : '이번엔 그 장면에 필요한 카드가 더 자주 나온다. 가방 칸은 그대로라서, 출발하려면 ' + need + '칸 이상 비어 있어야 한다.';
      var helpBtn = el('button', { id: 'btn-help-prep', class: 'btn btn-ghost btn-help', type: 'button', text: '?', 'aria-label': '도움말' });
      helpBtn.addEventListener('click', function () { DR.Sfx.play('ui'); DR.UI.help(mission); });
      screen.appendChild(helpBtn);
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: '보충 달리기 준비' }),
        el('h2', { text: '놓친 장면' }),
        failed,
        el('p', { class: 'note', text: note }),
        resubmit ? null : el('p', { id: 'prep-need', class: 'notice', text: lack > 0 ? lack + '칸 더 비워야 해요.' : '출발할 수 있어요.' }),
        el('h3', { text: '가방 속 종류별 개수' }),
        summary,
        bagGrid(mission, bag, 'prep-grid', { onRemove: function (card) { removeWithUndo(mission, bag, card, render); } }),
        el('div', { class: 'actions' }, [go])
      ]));
    }
    DR.App.go('prep');
    render();
  }

  root.DR.UI.inspect = inspect;
  root.DR.UI.supervisor = supervisor;
  root.DR.UI.supplementPrep = supplementPrep;
  root.DR.UI.effectiveKey = effectiveKey;
  root.DR.UI.comboCount = comboCount;
})(window);
