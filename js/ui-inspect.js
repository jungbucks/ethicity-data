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
  function changeLogOf(mission, label) { return (mission.changeLog || []).filter(function (c) { return c.label === label; })[0] || null; }
  // 3 임무 '도시 변경 기록' 판(검수 위에 늘 보임) — 장소마다 한 줄
  function changeLogBoard(mission) {
    if (!mission.changeLog) return null;
    var ul = el('ul', { class: 'change-log-list' });
    mission.changeLog.forEach(function (c) {
      ul.appendChild(el('li', null, [DR.UI.iconStrip(mission, [c.label], 20), el('b', { text: DR.Cards.labelText(mission, c.label) }), el('span', { text: (c.when ? c.when + ' · ' : '') + c.text })]));
    });
    return el('section', { id: 'change-log', class: 'change-log', 'aria-label': '도시 변경 기록' }, [el('h3', { text: '도시 변경 기록' }), ul]);
  }

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
    // 같은 종류를 다른 장면도 쓰면 '(두 장면 공통)' — 한 카드가 두 장면에 함께 세어진다는 뜻
    var shared = mission.scenes.filter(function (s) { return s.combos.some(function (o) { return o.keys.some(function (k) { return c.keys.indexOf(k) >= 0; }); }); }).length > 1;
    return el('li', { class: 'combo' + (short ? ' short' : ''), 'data-combo': c.id }, [
      DR.UI.iconStrip(mission, c.keys[0], 20), el('span', { class: 'combo-label', text: label }), shared ? el('span', { class: 'combo-shared', text: '(두 장면 공통)' }) : null, el('b', { class: 'combo-count', text: countText(have, c.need) })
    ]);
  }

  // 가방 격자 — opts: { onOpen(card), onRemove(card), newIds }
  function bagGrid(mission, bag, gridId, opts) {
    var grid = el('div', { id: gridId, class: 'bag-grid' });
    bag.forEach(function (card) {
      var amb = !!card.ambiguousId, label = cardLabel(mission, card);
      var state = amb && card.assigned === undefined ? '아직 안 정함' : '';
      var isNew = opts.newIds && opts.newIds.indexOf(card.id) >= 0;
      var fixed = !amb && card.label !== undefined; // 2 임무: 플레이어가 이름표를 고친 카드(맞았는지는 표시하지 않음)
      var open = el('button', { class: 'bag-open', type: 'button', 'aria-label': (amb ? '"?" 카드 열기: ' : '크게 보기: ') + label + (isNew ? ' (새로 담음)' : '') }, [
        el('img', { src: thumbUrl(mission, card), alt: '' }),
        DR.UI.iconStrip(mission, DR.Cards.iconsOf(mission, card)),
        el('span', { class: 'bag-label', text: label }),
        state ? el('span', { class: 'bag-state', text: state }) : null,
        isNew ? el('span', { class: 'badge-new', 'aria-hidden': 'true', text: 'NEW' }) : null,
        fixed ? el('span', { class: 'bag-fixed', text: '고침' }) : null
      ]);
      if (opts.onOpen) open.addEventListener('click', function () { opts.onOpen(card); });
      // 4 임무 동기 카드(마지막 보충): 빼기 버튼 대신 "동기와 함께 넣음"(누를 수 없음)
      var rm = card.fixed
        ? el('span', { class: 'bag-peer-fixed', text: '동기와 함께 넣음' })
        : el('button', { class: 'btn-remove', type: 'button', text: '빼기', 'aria-label': '빼기: ' + label });
      if (!card.fixed) rm.addEventListener('click', function () { DR.Sfx.play('ui'); opts.onRemove(card); });
      var cell = el('div', { class: 'bag-card' + (amb ? ' ambiguous' : '') + (amb && card.assigned === undefined ? ' undecided' : '') + (isNew ? ' is-new' : '') + (fixed ? ' fixed' : '') + (card.fixed ? ' peer-fixed' : ''), 'data-id': card.id, 'data-key': card.key || card.ambiguousId || card.fakeId }, [open, rm]);
      if (card.peer) cell.setAttribute('data-peer', card.fixed ? 'fixed' : 'joined');
      grid.appendChild(cell);
    });
    return grid;
  }

  // 빼기 + 되돌리기(마지막 1장만, 5초)
  function removeWithUndo(mission, bag, card, rerender) {
    var at = bag.indexOf(card);
    if (at < 0 || card.fixed) return; // 동기와 함께 넣은 카드는 빼지 않는다
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
    var zoom = zoomer(mission, screen, 'inspect-zoom', function () { render(); });

    function render() {
      var undecided = bag.filter(function (c) { return c.ambiguousId && c.assigned === undefined; }).length;
      var counts = DR.Cards.labelCounts(mission, bag);
      screen.innerHTML = '';
      var notice = el('p', { id: 'inspect-undecided', class: 'notice', text: '아직 정하지 않은 "?" 카드 ' + undecided + '장 — 정하지 않으면 넣지 않아요.' });
      notice.hidden = undecided === 0;
      var scenes = el('div', { id: 'inspect-scenes' });
      DR.UI.sceneOrder(mission).forEach(function (s) {
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
      submit.addEventListener('click', function () { DR.Sfx.play('ui'); DR.UI.clearToast(); zoom.close(); done(bag); });
      var helpBtn = el('button', { id: 'btn-help-inspect', class: 'btn btn-ghost btn-help', type: 'button', text: '?', 'aria-label': '도움말' });
      helpBtn.addEventListener('click', function () { DR.Sfx.play('ui'); DR.UI.help(mission); });
      screen.appendChild(helpBtn);
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: '검수 · ' + mission.title }),
        el('h2', { text: '가방 확인 (' + bag.length + '/' + mission.bag + '칸)' }),
        changeLogBoard(mission),
        el('p', { class: 'note', text: mission.inspectNote ? mission.inspectNote : mission.changeLog ? '카드를 누르면 크게 볼 수 있다. 언제 찍은 사진인지 도시 변경 기록과 맞춰 보고, 지금의 거리가 아닌 사진은 뺀다.' : mission.labels ? '카드를 누르면 크게 볼 수 있다. 그림과 이름표가 안 맞으면 이름표를 고치거나 뺀다.' : '카드를 누르면 크게 볼 수 있다. "?" 카드는 단서를 보고 설명표를 붙이거나, 넣지 않기로 정한다.' }),
        notice,
        bagGrid(mission, bag, 'inspect-grid', {
          onOpen: zoom.open, newIds: opts.newIds,
          onRemove: function (card) { removeWithUndo(mission, bag, card, render); }
        }),
        el('h2', { text: '장면별로 모아 보기' }),
        scenes,
        el('div', { class: 'actions' }, [submit])
      ]));
      zoom.reopen();
    }

    DR.App.go('inspect');
    render();
  }

  /* ---------- 카드 크게 보기(검수·보충 준비 공용) ----------
   * "?" 카드: 단서 + 설명표 붙이기(1 임무). 2 임무(mission.labels): 모든 카드에 이름표 7종 버튼 — 가짜만 버튼이 있으면 그 자체가 정답 단서라서.
   * 이름표를 원래 것으로 되돌리면 card.label을 지운다("고침" 표시도 사라진다). 고친 이름표가 맞는지는 어디에도 표시하지 않는다.
   * rerender()가 화면을 다시 그리면 reopen()으로 같은 카드 창을 다시 연다. keydown 정리 함수는 하나만(다시 그릴 때 쌓이지 않게). */
  function zoomer(mission, host, zoomId, rerender) {
    var zoomed = null, zoomCleanup = null;

    function open(card) {
      if (zoomCleanup) zoomCleanup();
      zoomed = card;
      var A = DR.CardArt, amb = !!card.ambiguousId, label = cardLabel(mission, card), digit = mission.labelStyle === 'digit';
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
        var labels = el('div', { class: 'labels' + (digit ? ' digit' : ''), role: 'group', 'aria-label': '설명표 붙이기' });
        // 4 임무(숫자 버튼): 번호 다섯 개가 한 줄, "넣지 않기"는 둘째 줄(누르기 실수 방지)
        var noneRow = digit ? el('div', { class: 'labels label-none' }) : labels;
        mission.labelOptions.concat([{ id: 'none', text: '넣지 않기' }]).forEach(function (o) {
          var val = o.id === 'none' ? null : o.id;
          var b = digit && o.id !== 'none'
            ? el('button', { class: 'btn btn-label btn-digit', type: 'button', 'data-label': o.id, text: o.id, 'aria-label': o.text, 'aria-pressed': card.assigned === val ? 'true' : 'false' })
            : el('button', { class: 'btn btn-label', type: 'button', 'data-label': o.id, text: o.text, 'aria-pressed': card.assigned === val ? 'true' : 'false' });
          b.addEventListener('click', function () { DR.Sfx.play('ui'); card.assigned = val; rerender(); });
          (o.id === 'none' ? noneRow : labels).appendChild(b);
        });
        inner.push(el('h3', { text: '추가 단서' }), clues, el('h3', { text: digit ? '번호 붙이기' : '설명표' }), labels);
        if (noneRow !== labels) inner.push(noneRow);
      }
      if (!amb && mission.changeLog) {
        var date = DR.Cards.dateOf(mission, card, variantOf(card)), cl = changeLogOf(mission, DR.Cards.currentLabel(mission, card));
        if (date) inner.push(el('p', { class: 'zoom-date', text: '촬영: ' + date }));
        if (cl) inner.push(el('p', { class: 'zoom-log', text: '도시 변경 기록 · ' + DR.Cards.labelText(mission, cl.label) + ': ' + (cl.when ? cl.when + ' ' : '') + cl.text }));
      }
      if (card.fixed) inner.push(el('p', { class: 'note zoom-peer', text: '동기와 함께 넣은 카드다. 이번엔 빼거나 번호를 고치지 않는다.' }));
      else if (!amb && mission.labels && mission.relabel !== false) {
        var cur = DR.Cards.currentLabel(mission, card), orig = DR.Cards.originalLabel(mission, card);
        var relabel = el('div', { class: 'labels relabel' + (digit ? ' digit' : ''), role: 'group', 'aria-label': '이름표 고치기' });
        mission.labels.forEach(function (l) {
          // 4 임무(labelStyle 'digit'): 동그라미 숫자 하나만(아이콘·글자를 따로 두지 않음) — 375px 폰에서 다섯 개 한 줄
          var b = digit
            ? el('button', { class: 'btn btn-label btn-digit', type: 'button', 'data-relabel': l.id, 'aria-label': l.text, 'aria-pressed': cur === l.id ? 'true' : 'false', text: l.id })
            : el('button', { class: 'btn btn-label', type: 'button', 'data-relabel': l.id, 'aria-pressed': cur === l.id ? 'true' : 'false' },
              [DR.UI.iconStrip(mission, [l.id], 18), el('span', { text: l.text })]);
          b.addEventListener('click', function () {
            DR.Sfx.play('ui');
            if (l.id === orig) delete card.label; else card.label = l.id;
            rerender();
          });
          relabel.appendChild(b);
        });
        inner.push(el('h3', { text: '이름표' }),
          el('p', { class: 'note', text: mission.relabelNote || '그림과 맞지 않으면 맞는 이름표로 고친다. 맞는 이름표가 없으면 빼자.' }), relabel);
      }
      var close = el('button', { class: 'btn btn-ghost', type: 'button', text: '닫기' });
      var panel = el('div', { class: 'zoom-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': '카드 크게 보기: ' + label }, inner.concat([el('div', { class: 'actions' }, [close])]));
      var overlay = el('div', { id: zoomId, class: 'zoom' }, [panel]);
      function cleanup() { overlay.remove(); root.removeEventListener('keydown', onKey); zoomCleanup = null; }
      function shut() { zoomed = null; cleanup(); }
      function onKey(e) { if (e.key === 'Escape') shut(); }
      close.addEventListener('click', shut);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) shut(); });
      root.addEventListener('keydown', onKey);
      zoomCleanup = cleanup;
      host.appendChild(overlay);
      close.focus();
    }
    function reopen() { if (zoomed && document.contains(host)) open(zoomed); }
    function shutAll() { zoomed = null; if (zoomCleanup) zoomCleanup(); }
    return { open: open, reopen: reopen, close: shutAll };
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
      DR.UI.line({ who: 'supervisor', text: question, face: 'explain' }),
      el('div', { class: 'actions' }, [b, c])
    ]));
    DR.App.go('supervisor');
  }

  /* ---------- 보충 준비 ---------- */
  // 정리한 뒤 모자란 조합이 없으면(가짜만 빼면 되는 경우) 달리지 않고 다시 제출 — done(bag, { resubmit: true }), spec §3.5
  // popts.extra = 보충 달리기 뒤 가방에 들어올 카드(4 임무 동기 카드) — 부족분 계산엔 미리 넣고, 그만큼 칸을 더 비워야 출발
  function supplementPrep(mission, result, bag, done, popts) {
    var extra = (popts && popts.extra) || [];
    var screen = document.getElementById('screen-prep');
    var need = Math.min(DR.config.supplementFreeSlots, mission.bag);
    var comboById = {};
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { comboById[c.id] = c; }); });
    // 종류(key)마다 필요한 최대 장수 — 여유 계산용
    var needByKey = {};
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { c.keys.forEach(function (k) { needByKey[k] = Math.max(needByKey[k] || 0, c.need); }); }); });

    var zoom = zoomer(mission, screen, 'prep-zoom', function () { render(); });

    // 종류별 "1장 빼기"는 바로 빼지 않는다 — 그 라벨의 카드 썸네일을 펼쳐 학생이 사진을 보고 직접 고른다
    // (가장 최근 카드를 몰래 빼면 가짜가 남고 진짜가 빠질 수 있다)
    var openKinds = {};

    function render() {
      // forceResubmit = 보충 횟수 밖 다시 제출(4 임무 결판, 남은 보충 0번) — 달리지 않는다
      var resubmit = !!(popts && popts.forceResubmit) || Object.keys(DR.Judge.shortfall(mission, bag.concat(extra), DR.config)).length === 0;
      var free = mission.bag - bag.length - extra.length, lack = resubmit ? Math.max(0, -free) : Math.max(0, need - free);
      var counts = DR.Cards.labelCounts(mission, bag), withPeer = extra.length ? DR.Cards.labelCounts(mission, bag.concat(extra)) : counts;
      screen.innerHTML = '';

      // 놓친 장면 + 그 장면에서 모자란 카드 종류(아이콘 + 라벨 + 부족 n장)
      var failed = el('ul', { id: 'prep-failed', class: 'failed' });
      DR.UI.sceneOrder(mission).forEach(function (sd) {
        var s = result.scenes.filter(function (x) { return x.id === sd.id; })[0];
        if (!s || s.pass) return;
        var sc = mission.scenes.filter(function (x) { return x.id === s.id; })[0];
        var shorts = el('ul', { class: 'combo-list' });
        s.missing.forEach(function (id) {
          var c = comboById[id], have = comboCount(mission, counts, c), filled = have < c.need && comboCount(mission, withPeer, c) >= c.need;
          shorts.appendChild(el('li', { class: 'combo short', 'data-combo': id }, [
            DR.UI.iconStrip(mission, c.keys[0], 20), el('span', { class: 'combo-label', text: DR.Cards.keyLabel(mission, c.keys[0]) }),
            el('b', { class: 'combo-count', text: filled ? '동기 카드로 채워짐' : have < c.need ? '부족 ' + (c.need - have) + '장' : (mission.changeLog ? '사진을 다시 살펴봐요' : mission.labels ? '이름표를 다시 살펴봐요' : '설명표를 다시 살펴봐요') })
          ]));
        });
        // 오염으로 실패한 장면: 어느 카드인지는 말하지 않는다 — 사진을 보고 찾게
        var contam = (s.contaminated || []).length ? el('p', { class: 'prep-contam', text: mission.labels && mission.relabel !== false
          ? '엉뚱한 사진이 섞여 있다. 사진을 보고 찾아서 고치거나 빼자.'
          : '엉뚱한 사진이 섞여 있다. 사진을 보고 찾아서 빼자.' }) : null;
        failed.appendChild(el('li', { 'data-scene': s.id }, [el('span', { text: sc.title }), s.missing.length ? shorts : null, contam]));
      });

      // 종류별 요약: 개수 · 여유 n장 · 1장 빼기
      var summary = el('ul', { id: 'prep-summary', class: 'kind-list' });
      Object.keys(counts).forEach(function (k) {
        var extra = needByKey[k] === undefined ? 0 : counts[k] - needByKey[k]; // 어느 조합에도 없는 이름표(4 임무 7·8)는 여유를 말하지 않는다
        var open = !!openKinds[k];
        var minus = el('button', { class: 'btn btn-small', type: 'button', text: open ? '접기' : '1장 빼기', 'aria-expanded': String(open),
          'aria-label': DR.Cards.keyLabel(mission, k) + (open ? ' 사진 접기' : ' 사진 펼쳐서 1장 고르기') });
        minus.addEventListener('click', function () { DR.Sfx.play('ui'); openKinds[k] = !openKinds[k]; render(); });
        var pick = null;
        if (open) {
          pick = el('div', { class: 'kind-pick', role: 'group', 'aria-label': DR.Cards.keyLabel(mission, k) + ' — 뺄 사진 고르기' });
          bag.forEach(function (card, n) {
            if (DR.Cards.displayKey(mission, card) !== k || card.fixed) return;
            var b = el('button', { class: 'kind-pick-card', type: 'button', 'data-id': card.id, 'aria-label': '빼기: ' + cardLabel(mission, card) + ' 사진 ' + (n + 1) }, [
              el('img', { src: thumbUrl(mission, card), alt: '' })
            ]);
            b.addEventListener('click', function () { DR.Sfx.play('ui'); removeWithUndo(mission, bag, card, render); });
            pick.appendChild(b);
          });
        }
        summary.appendChild(el('li', { class: 'kind', 'data-key': k }, [
          DR.UI.iconStrip(mission, k, 20), el('span', { class: 'combo-label', text: DR.Cards.keyLabel(mission, k) }),
          el('b', { class: 'combo-count', text: counts[k] + '장' + (extra > 0 ? ' · 여유 ' + extra + '장' : '') }), minus, pick
        ]));
      });

      var go = el('button', { id: 'btn-supplement', class: 'btn btn-primary', type: 'button', text: resubmit ? '다시 제출' : '보충 달리기 출발' });
      go.disabled = lack > 0;
      go.addEventListener('click', function () { DR.Sfx.unlock(); DR.Sfx.play('ui'); DR.UI.clearToast(); zoom.close(); done(bag, { resubmit: resubmit }); });
      var note = resubmit ? '모자란 카드는 없다. 가방을 정리했으면 다시 제출하자.'
        : '이번엔 그 장면에 필요한 카드가 더 자주 나온다. 가방 칸은 그대로라서, 출발하려면 ' + need + '칸 이상 비어 있어야 한다.';
      var peerNote = extra.length ? el('p', { id: 'prep-peer', class: 'notice', text: '동기가 따로 모아 둔 카드 ' + extra.length + '장이 ' + (resubmit ? '다시 제출하기 전에' : '보충 달리기가 끝나면') + ' 가방에 들어온다(' + extra.length + '칸)' +
        (popts.peerFixed ? ' — 이번엔 동기와 함께 넣는다.' : ' — 넣을지는 검수에서 정한다.') }) : null;
      var helpBtn = el('button', { id: 'btn-help-prep', class: 'btn btn-ghost btn-help', type: 'button', text: '?', 'aria-label': '도움말' });
      helpBtn.addEventListener('click', function () { DR.Sfx.play('ui'); DR.UI.help(mission); });
      screen.appendChild(helpBtn);
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: '보충 달리기 준비' }),
        el('h2', { text: '놓친 장면' }),
        failed,
        el('p', { class: 'note', text: note }),
        peerNote,
        resubmit && !lack ? null : el('p', { id: 'prep-need', class: 'notice', text: lack > 0 ? lack + '칸 더 비워야 해요.' : '출발할 수 있어요.' }),
        el('h3', { text: '가방 속 종류별 개수' }),
        summary,
        bagGrid(mission, bag, 'prep-grid', { onOpen: zoom.open, onRemove: function (card) { removeWithUndo(mission, bag, card, render); } }),
        el('div', { class: 'actions' }, [go])
      ]));
      zoom.reopen();
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
