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

  function variantOf(card) { return numOf(card) % 3 || 0; }
  // 카드 번호(사진 카드가 사진을 고를 때) = id의 마지막 숫자 묶음. 보충 카드 id 's1_c5'는 5 — 전엔 숫자를 다 이어 15가 돼, 달릴 때(c5)와 검수에서 그림 변형·사진이 달랐다(2026-11-10)
  function numOf(card) { var m = String(card.id).match(/(\d+)\D*$/); return m ? parseInt(m[1], 10) : 0; }
  var LOOK_MS = 2600; // 개인정보 카드가 남은 종류의 테두리를 밝혀 두는 시간
  var maskLast = { id: null, at: 0 }; // 마지막으로 가림을 바꾼 카드와 때(ms) — 같은 카드를 바로 다시 누른 것만 무시한다
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
    return A.thumb(A.card(mission, cardId(card), variantOf(card), 192, numOf(card)), 24).toDataURL();
  }

  // 장면별 모아 보기의 그림: 붙은 설명표(“?”는 붙인 설명표의 보통 종류)를 쓰는 장면에 놓는다
  function inScene(mission, card, keys) { var k = DR.Cards.displayKey(mission, card); return !!(k && keys[k]); }

  // 조합 한 줄: 아이콘 + 라벨 + 현재 n장(공개 뒤 "n / 2장")
  function comboCount(mission, counts, c) { return c.keys.reduce(function (n, k) { return n + (counts[k] || 0); }, 0); }
  function countText(have, need) { return DR.UI.needRevealed() ? have + ' / ' + need + '장' : '현재 ' + have + '장'; }
  function comboRow(mission, counts, c) {
    // 1 임무(hideShapes): 첫 결과 전에는 sceneRows가 종류 한 줄로 합치고, 공개 뒤에는 모습 이름으로
    var have = comboCount(mission, counts, c), label = DR.Cards.comboName(mission, c); // 여러 종류 조합은 합친 이름(플레이테스트 1)
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
        fixed ? el('span', { class: 'bag-fixed', text: '고침' }) : null,
        card.masked ? el('span', { class: 'bag-masked', text: DR.Privacy.TEXT.maskedTag }) : null
      ]);
      if (opts.onOpen) open.addEventListener('click', function () { opts.onOpen(card); });
      // 4 임무 동기 카드(마지막 보충): 빼기 버튼 대신 "동기와 함께 넣음"(누를 수 없음)
      var rm = card.fixed
        ? el('span', { class: 'bag-peer-fixed', text: '동기와 함께 넣음' })
        : el('button', { class: 'btn-remove', type: 'button', text: '빼기', 'aria-label': '빼기: ' + label });
      if (!card.fixed) rm.addEventListener('click', function () { DR.Sfx.play('ui'); opts.onRemove(card); });
      var cell = el('div', { class: 'bag-card' + (amb ? ' ambiguous' : '') + (amb && card.assigned === undefined ? ' undecided' : '') + (isNew ? ' is-new' : '') + (fixed ? ' fixed' : '') + (card.fixed ? ' peer-fixed' : '') + (card.masked ? ' masked' : ''), 'data-id': card.id, 'data-key': card.key || card.ambiguousId || card.fakeId }, [open, rm]);
      if (card.peer) cell.setAttribute('data-peer', card.fixed ? 'fixed' : 'joined');
      grid.appendChild(cell);
    });
    return grid;
  }

  // 가방을 바꾼 것(빼기·되돌리기·이름표 고치기·설명표 붙이기·가리기)은 그 자리에서 지금 화면의 체크포인트로 다시 저장한다 —
  //   전엔 화면에 들어올 때만 저장해서, 새로고침·탭 되살아남 뒤 정리한 가방이 예전으로 돌아갔다(리뷰 2026-11-10 ②).
  //   검수 = 'inspect', 보충 준비 = 'prep' 그대로(다시 들어오면 그 화면). 연습은 본편 저장을 덮지 않고, 튜토리얼 검수(ui-exam)는 여기를 쓰지 않는다
  function saveBag(bag) {
    var App = DR.App, st = App && App.state, scr = App && App.screen;
    if (!st || st.practice || st.mission === 'tutorial' || st.bag !== bag) return false;
    if (scr !== 'inspect' && scr !== 'prep') return false;
    return DR.Save.checkpoint(scr, st, {});
  }

  // 빼기 + 되돌리기(마지막 1장만, 5초)
  function removeWithUndo(mission, bag, card, rerender) {
    var at = bag.indexOf(card);
    if (at < 0 || card.fixed) return; // 동기와 함께 넣은 카드는 빼지 않는다
    bag.splice(at, 1);
    saveBag(bag);
    rerender();
    DR.UI.undoToast('뺐어요: ' + cardLabel(mission, card), function () {
      bag.splice(Math.min(at, bag.length), 0, card);
      saveBag(bag);
      rerender();
    });
  }

  /* ---------- 검수 ---------- */
  // opts.newIds = 이번 보충 달리기에서 새로 담은 카드 id(NEW 표시) · opts.lost = 직전 달리기에서 노이즈로 잃은 카드 수
  function inspect(mission, bag, done, opts) {
    opts = opts || {};
    var screen = document.getElementById('screen-inspect');
    var zoom = zoomer(mission, screen, 'inspect-zoom', function () { saveBag(bag); render(); }, function (card) { removeWithUndo(mission, bag, card, render); });
    // opts.look = 테두리를 잠깐 밝힐 이름표들(개인정보 카드가 남은 종류 — 감독관이 종류를 말했는데도 그대로 다시 냈을 때, app.js askSupervisor).
    //   그 이름표가 붙은 카드 전부의 테두리만 밝힌다(어느 카드인지는 말하지 않는다). 이 화면에 들어온 첫 그리기에만, LOOK_MS 뒤 저절로 꺼진다(움직임 없음)
    var look = opts.look && opts.look.length ? opts.look : null;

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
        if (mission.hideShapes && !DR.UI.needRevealed()) {
          // 첫 판: 모습을 글로 알려 주지 않는다 — 종류 한 줄 + 아래 사진
          var total = s.combos.reduce(function (n, c) { return n + comboCount(mission, counts, c); }, 0);
          combos.appendChild(el('li', { class: 'combo', 'data-combo': s.id }, [el('span', { class: 'combo-label', text: s.title }), el('b', { class: 'combo-count', text: '현재 ' + total + '장' })]));
        } else s.combos.forEach(function (c) { combos.appendChild(comboRow(mission, counts, c)); });
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
        opts.lost ? el('p', { id: 'inspect-lost', class: 'lost-line', text: '이번 달리기에서 노이즈로 잃은 카드 ' + opts.lost + '장' }) : null, // 직전 달리기 하나 기준(플레이테스트 8)
        changeLogBoard(mission),
        el('p', { class: 'note', text: mission.inspectNote ? mission.inspectNote : mission.changeLog ? '카드를 누르면 크게 볼 수 있다. 언제 찍은 사진인지 도시 변경 기록과 맞춰 보고, 지금의 거리가 아닌 사진은 뺀다.' : mission.labels ? (mission.relabel !== false ? '카드를 누르면 크게 볼 수 있다. 그림과 이름표가 안 맞으면 이름표를 고치거나 뺀다.' : '카드를 누르면 크게 볼 수 있다. 그림을 보고 필요 없는 카드는 뺀다.') : '카드를 누르면 크게 볼 수 있다. "?" 카드는 단서를 보고 설명표를 붙이거나, 넣지 않기로 정한다.' }),
        DR.Privacy.on(mission) ? el('p', { id: 'inspect-privacy-note', class: 'note', text: DR.Privacy.text(mission, 'inspectNote') }) : null,
        notice,
        bagGrid(mission, bag, 'inspect-grid', {
          onOpen: zoom.open, newIds: opts.newIds,
          onRemove: function (card) { removeWithUndo(mission, bag, card, render); }
        }),
        el('h2', { text: '장면별로 모아 보기' }),
        scenes,
        el('div', { class: 'actions' }, [submit])
      ]));
      if (look) {
        var marked = [];
        Array.prototype.forEach.call(screen.querySelectorAll('#inspect-grid .bag-card'), function (cell) {
          var card = bag.filter(function (c) { return String(c.id) === cell.getAttribute('data-id'); })[0];
          if (card && !card.ambiguousId && look.indexOf(DR.Cards.currentLabel(mission, card)) >= 0) { cell.classList.add('look-here'); marked.push(cell); }
        });
        look = null;
        setTimeout(function () { marked.forEach(function (cell) { cell.classList.remove('look-here'); }); }, LOOK_MS);
      }
      zoom.reopen();
    }

    DR.App.go('inspect');
    render();
  }

  /* ---------- 카드 크게 보기(검수·보충 준비 공용) ----------
   * "?" 카드: 단서 + 설명표 붙이기(1 임무). 2 임무(mission.labels): 모든 카드에 이름표 7종 버튼 — 가짜만 버튼이 있으면 그 자체가 정답 단서라서.
   * 이름표를 원래 것으로 되돌리면 card.label을 지운다("고침" 표시도 사라진다). 고친 이름표가 맞는지는 어디에도 표시하지 않는다.
   * rerender()가 화면을 다시 그리면 reopen()으로 같은 카드 창을 다시 연다. keydown 정리 함수는 하나만(다시 그릴 때 쌓이지 않게).
   * 포커스(리뷰 2026-11-10 ⑤): 창이 떠 있는 동안 Tab·Shift+Tab은 창 안에서만 돌고(전엔 Shift+Tab이 배경 '제출'로 빠졌다), 배경(화면의 다른 자식)은 inert —
   *   창은 화면을 다시 그릴 때마다 새로 만들어 화면 안에 붙이는 div라 <dialog>(공용 modal)로 바꾸지 않고, 대화 창(ui-story)처럼 키로 가둔다.
   *   닫기·Esc·바깥 누르기로 닫으면 열었던 카드 버튼으로 포커스를 돌려준다. 창 안 버튼을 눌러 다시 그릴 때는 같은 버튼으로(닫기로 튀지 않게) — rerender(sel). */
  function zoomer(mission, host, zoomId, rerenderHost, onRemove) {
    var zoomed = null, zoomCleanup = null, focusSel = null;
    // 창 안 조작으로 화면을 다시 그린다 — sel = 다시 그린 창에서 포커스를 줄 조작
    function rerender(sel) { focusSel = sel || null; rerenderHost(); focusSel = null; }

    function open(card) {
      if (zoomCleanup) zoomCleanup();
      zoomed = card;
      var A = DR.CardArt, amb = !!card.ambiguousId, label = cardLabel(mission, card), digit = mission.labelStyle === 'digit', word = mission.labelStyle === 'word';
      var big = A.card(mission, cardId(card), variantOf(card), 320, numOf(card));
      // 모든 임무 같은 구조(플레이테스트 5): 머리줄(이름표 + 닫기, 오른쪽 위) → 가운데 사진 → 가리기 → (임무별) 단서·날짜·이름표 고치기
      var close = el('button', { id: 'btn-zoom-close', class: 'btn btn-ghost btn-small zoom-close', type: 'button', text: '닫기' });
      var inner = [
        el('div', { class: 'zoom-head' }, [el('p', { class: 'zoom-label' }, [DR.UI.iconStrip(mission, DR.Cards.iconsOf(mission, card)), el('span', { text: label })]), close]),
        el('img', { class: 'zoom-art', src: big.toDataURL(), alt: '카드 원본: ' + label })
      ];
      // 빼기(플레이테스트 2026-11-12 — 안내는 "크게 보기에서 가리거나 뺀다"인데 창 안엔 가리기만 있었다): 창을 닫고 격자의 '빼기'와 같은 길(되돌리기 5초 포함).
      //   포커스는 같은 자리의 다음 카드로(없으면 마지막 카드)
      function removeBtn() {
        if (!onRemove) return null;
        var rb = el('button', { id: 'btn-zoom-remove', class: 'btn btn-small btn-zoom-remove', type: 'button', text: '빼기', 'aria-label': '빼기: ' + label });
        rb.addEventListener('click', function () {
          DR.Sfx.play('ui');
          var cells = host.querySelectorAll('.bag-card'), at = 0;
          for (var i = 0; i < cells.length; i++) if (cells[i].getAttribute('data-id') === String(card.id)) at = i;
          zoomed = null; if (zoomCleanup) zoomCleanup();
          onRemove(card);
          var left = host.querySelectorAll('.bag-card .bag-open'), to = left[Math.min(at, left.length - 1)];
          if (to && to.offsetParent !== null) to.focus();
        });
        return rb;
      }
      if (DR.Privacy.on(mission) && !card.fixed) {
        var maskBtn = el('button', { id: 'btn-mask', class: 'btn btn-small btn-mask', type: 'button', 'aria-pressed': card.masked ? 'true' : 'false',
          text: card.masked ? DR.Privacy.TEXT.unmaskButton : DR.Privacy.TEXT.maskButton });
        var maskNote = el('p', { id: 'zoom-mask-note', class: 'note zoom-mask-note', role: 'status' });
        maskBtn.addEventListener('click', function () {
          // 더블 클릭·더블 탭: 다시 그린 '되돌리기' 버튼이 같은 자리라 두 번째 누름이 가림을 바로 풀었다 → 잠깐은 무시(2026-11-10)
          var now = Date.now();
          if (DR.Privacy.canMask(mission, card) && maskLast.id === card.id && now - maskLast.at < 450) return;
          DR.Sfx.play('ui');
          if (DR.Privacy.canMask(mission, card)) {
            maskLast = { id: card.id, at: now };
            var nowMasked = DR.Privacy.toggleMask(mission, card);
            var st = DR.App && DR.App.state;
            if (st && st.bag && st.bag.indexOf(card) >= 0) {
              // 한 번 가려 본 카드는 나중에 빼도 "가렸으면 살려 쓸 수 있었어"를 듣지 않는다(가릴 줄 알고 뺀 것)
              if (nowMasked && st.privCaught) { var pi = st.privCaught.indexOf(card.id); if (pi >= 0) st.privCaught.splice(pi, 1); }
            }
            rerender('#btn-mask'); // 가린 것도 바로 저장된다(크게 보기에서 바꾼 것은 모두 — inspect·supplementPrep이 넘긴 rerender가 saveBag)
          }
          else maskNote.textContent = DR.Privacy.text(mission, 'noPrivate');
        });
        inner.push(el('div', { class: 'zoom-mask' }, [maskBtn, removeBtn(), maskNote]));
      } else if (!card.fixed && onRemove) inner.push(el('div', { class: 'zoom-mask' }, [removeBtn()]));
      if (amb) {
        var q = ambDef(mission, card.ambiguousId);
        var clues = el('div', { class: 'clues' });
        q.clues.forEach(function (cl, i) {
          clues.appendChild(el('figure', { class: 'clue' }, [el('img', { src: A.clue(mission, q.id, i, 256).toDataURL(), alt: cl.text }), el('figcaption', { text: cl.text })]));
        });
        var labels = el('div', { class: 'labels' + (digit ? ' digit' : '') + (word ? ' word' : ''), role: 'group', 'aria-label': word ? '낱말 붙이기' : '설명표 붙이기' });
        // 4 임무(숫자 버튼): 번호 다섯 개가 한 줄, "넣지 않기"는 둘째 줄(누르기 실수 방지)
        // 4 임무 낱말판: 낱말 넷이 한 줄(좁으면 2×2), "넣지 않기"는 둘째 줄
        var noneRow = digit || word ? el('div', { class: 'labels label-none' }) : labels;
        mission.labelOptions.concat([{ id: 'none', text: '넣지 않기' }]).forEach(function (o) {
          var val = o.id === 'none' ? null : o.id;
          var b = digit && o.id !== 'none'
            ? el('button', { class: 'btn btn-label btn-digit', type: 'button', 'data-label': o.id, text: o.id, 'aria-label': o.text, 'aria-pressed': card.assigned === val ? 'true' : 'false' })
            : el('button', { class: 'btn btn-label' + (word && o.id !== 'none' ? ' btn-word' : ''), type: 'button', 'data-label': o.id, text: o.text, 'aria-pressed': card.assigned === val ? 'true' : 'false' });
          b.addEventListener('click', function () { DR.Sfx.play('ui'); card.assigned = val; rerender('[data-label="' + o.id + '"]'); });
          (o.id === 'none' ? noneRow : labels).appendChild(b);
        });
        inner.push(el('h3', { text: '추가 단서' }), clues, el('h3', { text: digit ? '번호 붙이기' : word ? '낱말 붙이기' : '설명표' }), labels);
        if (noneRow !== labels) inner.push(noneRow);
      }
      if (!amb && mission.changeLog) {
        var date = DR.Cards.dateOf(mission, card, variantOf(card)), cl = changeLogOf(mission, DR.Cards.currentLabel(mission, card));
        if (date) inner.push(el('p', { class: 'zoom-date', text: '촬영: ' + date }));
        if (cl) inner.push(el('p', { class: 'zoom-log', text: '도시 변경 기록 · ' + DR.Cards.labelText(mission, cl.label) + ': ' + (cl.when ? cl.when + ' ' : '') + cl.text }));
      }
      if (card.fixed) inner.push(el('p', { class: 'note zoom-peer', text: '동기와 함께 넣은 카드다. 이번엔 빼거나 이름표를 고치지 않는다.' }));
      else if (!amb && mission.labels && mission.relabel !== false) {
        var cur = DR.Cards.currentLabel(mission, card), orig = DR.Cards.originalLabel(mission, card);
        var relabel = el('div', { class: 'labels relabel' + (digit ? ' digit' : '') + (word ? ' word' : ''), role: 'group', 'aria-label': '이름표 고치기' });
        mission.labels.forEach(function (l) {
          // 4 임무(labelStyle 'digit'): 동그라미 숫자 하나만(아이콘·글자를 따로 두지 않음) — 375px 폰에서 다섯 개 한 줄
          var b = digit
            ? el('button', { class: 'btn btn-label btn-digit', type: 'button', 'data-relabel': l.id, 'aria-label': l.text, 'aria-pressed': cur === l.id ? 'true' : 'false', text: l.id })
            : word
            // 4 임무 낱말판: 낱말 글자만(아이콘 없음) — 375px 폰에서 넷이 한 줄(좁으면 2×2, CSS)
            ? el('button', { class: 'btn btn-label btn-word', type: 'button', 'data-relabel': l.id, 'aria-pressed': cur === l.id ? 'true' : 'false', text: l.text })
            : el('button', { class: 'btn btn-label', type: 'button', 'data-relabel': l.id, 'aria-pressed': cur === l.id ? 'true' : 'false' },
              [DR.UI.iconStrip(mission, [l.id], 18), el('span', { text: l.text })]);
          b.addEventListener('click', function () {
            DR.Sfx.play('ui');
            if (l.id === orig) delete card.label; else card.label = l.id;
            rerender('[data-relabel="' + l.id + '"]');
          });
          relabel.appendChild(b);
        });
        inner.push(el('h3', { text: '이름표' }),
          el('p', { class: 'note', text: mission.relabelNote || '그림과 맞지 않으면 맞는 이름표로 고친다. 맞는 이름표가 없으면 빼자.' }), relabel);
      }
      var panel = el('div', { class: 'zoom-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': '카드 크게 보기: ' + label }, inner);
      var overlay = el('div', { id: zoomId, class: 'zoom' }, [panel]);
      // 배경 = 화면(host)의 다른 자식들. 창이 떠 있는 동안 inert(누를 수도 포커스할 수도 없음), 닫으면 되돌린다
      var behind = [];
      function cleanup() {
        behind.forEach(function (n) { n.removeAttribute('inert'); });
        overlay.remove(); root.removeEventListener('keydown', onKey); zoomCleanup = null;
      }
      // 사람이 닫음(닫기·Esc·바깥): 열었던 카드로 포커스. 화면이 넘어갈 때 닫는 것(shutAll)은 포커스를 건드리지 않는다
      function shut() {
        zoomed = null; cleanup();
        var cells = host.querySelectorAll('.bag-card'), back = null;
        for (var i = 0; i < cells.length && !back; i++) if (cells[i].getAttribute('data-id') === String(card.id)) back = cells[i].querySelector('.bag-open');
        if (back && back.offsetParent !== null) back.focus();
      }
      function focusables() {
        return Array.prototype.filter.call(panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (n) { return !n.disabled && n.offsetParent !== null; });
      }
      function onKey(e) {
        if (e.key === 'Escape') { shut(); return; }
        if (e.key !== 'Tab') return;
        if (document.querySelector('dialog[open]')) return; // 도움말 같은 <dialog>가 위에 떠 있으면 그쪽이 가둔다
        var list = focusables(), first = list[0], last = list[list.length - 1], at = document.activeElement;
        if (!first) { e.preventDefault(); return; }
        if (!panel.contains(at)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
      }
      close.addEventListener('click', shut);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) shut(); });
      root.addEventListener('keydown', onKey);
      zoomCleanup = cleanup;
      Array.prototype.forEach.call(host.children, function (n) { if (!n.hasAttribute('inert')) { n.setAttribute('inert', ''); behind.push(n); } });
      host.appendChild(overlay);
      var keep = focusSel && panel.querySelector(focusSel);
      (keep || close).focus();
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
  // 보충 준비는 결과를 본 뒤라 1 임무도 모습 이름으로 말한다(접힌 우산 부족 2장)
  function kindName(mission, k) { return mission.hideShapes && mission.cardTypes[k] ? mission.cardTypes[k].name : DR.Cards.keyLabel(mission, k); }
  function supplementPrep(mission, result, bag, done, popts) {
    var extra = (popts && popts.extra) || [];
    var screen = document.getElementById('screen-prep');
    var comboById = {};
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { comboById[c.id] = c; }); });
    // 종류(key)마다 필요한 최대 장수 — 여유 계산용
    var needByKey = {};
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { c.keys.forEach(function (k) { needByKey[k] = Math.max(needByKey[k] || 0, c.need); }); }); });

    var zoom = zoomer(mission, screen, 'prep-zoom', function () { saveBag(bag); render(); }, function (card) { removeWithUndo(mission, bag, card, render); });

    // 종류별 "1장 빼기"는 바로 빼지 않는다 — 그 라벨의 카드 썸네일을 펼쳐 학생이 사진을 보고 직접 고른다
    // (가장 최근 카드를 몰래 빼면 가짜가 남고 진짜가 빠질 수 있다)
    var openKinds = {};
    // 카드 전체 격자(카드마다 빼기)는 기본 접힘 — 종류별 '1장 빼기'와 겹쳐 화면이 너무 길어서(플레이테스트 13). 다시 그려도 펼친 채
    var showAll = false;

    function render() {
      // forceResubmit = 보충 횟수 밖 다시 제출(4 임무 결판, 남은 보충 0번) — 달리지 않는다
      var shortNow = DR.Judge.shortfall(mission, bag.concat(extra), DR.config);
      var resubmit = !!(popts && popts.forceResubmit) || Object.keys(shortNow).length === 0;
      // 비워야 할 칸 = 기본 칸과 모자란 장 수 합 중 큰 쪽(플레이테스트 7 — 9장이 모자란데 6칸이면 한 번에 못 채움). 가방보다 클 수는 없다
      var shortTotal = Object.keys(shortNow).reduce(function (n, k) { return n + shortNow[k]; }, 0);
      var need = Math.min(Math.max(DR.config.supplementFreeSlots, shortTotal), mission.bag - extra.length);
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
            DR.UI.iconStrip(mission, c.keys[0], 20), el('span', { class: 'combo-label', text: DR.Cards.comboName(mission, c) }),
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
          'aria-label': kindName(mission, k) + (open ? ' 사진 접기' : ' 사진 펼쳐서 1장 고르기') });
        minus.addEventListener('click', function () { DR.Sfx.play('ui'); openKinds[k] = !openKinds[k]; render(); });
        var pick = null;
        if (open) {
          pick = el('div', { class: 'kind-pick', role: 'group', 'aria-label': kindName(mission, k) + ' — 뺄 사진 고르기' });
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
          DR.UI.iconStrip(mission, k, 20), el('span', { class: 'combo-label', text: kindName(mission, k) }),
          el('b', { class: 'combo-count', text: counts[k] + '장' + (extra > 0 ? ' · 여유 ' + extra + '장' : '') }), minus, pick
        ]));
      });

      var allToggle = el('button', { id: 'btn-prep-all', class: 'btn btn-small btn-prep-all', type: 'button', 'aria-expanded': String(showAll), 'aria-controls': 'prep-grid',
        text: showAll ? '카드 전체 접기' : '카드 전체 보기 (' + bag.length + '장)' });
      allToggle.addEventListener('click', function () { DR.Sfx.play('ui'); showAll = !showAll; render(); });
      var grid = bagGrid(mission, bag, 'prep-grid', { onOpen: zoom.open, onRemove: function (card) { removeWithUndo(mission, bag, card, render); } });
      grid.hidden = !showAll;
      var go = el('button', { id: 'btn-supplement', class: 'btn btn-primary', type: 'button', text: resubmit ? '다시 제출' : '보충 달리기 출발' });
      go.disabled = lack > 0;
      go.addEventListener('click', function () { DR.Sfx.unlock(); DR.Sfx.play('ui'); DR.UI.clearToast(); zoom.close(); done(bag, { resubmit: resubmit }); });
      var note = resubmit ? '모자란 카드는 없다. 가방을 정리했으면 다시 제출하자.'
        : '이번엔 그 장면에 필요한 카드가 더 자주 나온다. 가방 칸은 그대로라서, 출발하려면 ' + need + '칸 이상 비어 있어야 한다' +
          (shortTotal > DR.config.supplementFreeSlots ? '(모자란 카드 ' + shortTotal + '장).' : '.');
      var peerNote = extra.length ? el('p', { id: 'prep-peer', class: 'notice', text: '동기가 따로 모아 둔 카드 ' + extra.length + '장이 ' + (resubmit ? '다시 제출하기 전에' : '보충 달리기가 끝나면') + ' 가방에 들어온다(' + extra.length + '칸)' +
        (popts.peerFixed ? ' — 이번엔 동기와 함께 넣는다.' : ' — 넣을지는 검수에서 정한다.') }) : null;
      // 동기 자리(교사 피드백 2026-11-09): 가방 칸 셈을 한 줄로 — 동기 카드가 예약될 때만
      var slots = extra.length ? el('p', { id: 'prep-slots', class: 'prep-slots', text: '가방 ' + extra.length + '칸은 동기가 가져올 답안 자리예요. 지금 가방 ' + bag.length + '장 · 동기 자리 ' + extra.length + '칸 · 빈칸 ' + Math.max(0, free) + '칸(모두 ' + mission.bag + '칸).' }) : null;
      var helpBtn = el('button', { id: 'btn-help-prep', class: 'btn btn-ghost btn-help', type: 'button', text: '?', 'aria-label': '도움말' });
      helpBtn.addEventListener('click', function () { DR.Sfx.play('ui'); DR.UI.help(mission); });
      screen.appendChild(helpBtn);
      screen.appendChild(el('div', { class: 'page' }, [
        el('p', { class: 'kicker', text: '보충 달리기 준비' }),
        el('h2', { text: '놓친 장면' }),
        failed,
        el('p', { class: 'note', text: note }),
        peerNote,
        slots,
        resubmit && !lack ? null : el('p', { id: 'prep-need', class: 'notice' + (lack > 0 ? '' : ' notice-ok'), text: lack > 0 ? lack + '칸 더 비워야 해요.' : '출발할 수 있어요.' }), // 가능 = 초록(경고 분홍 아님)
        el('h3', { text: '가방 속 종류별 개수' }),
        summary,
        allToggle,
        grid,
        el('div', { class: 'actions' }, [go])
      ]));
      zoom.reopen();
    }
    DR.App.go('prep');
    render();
  }

  // 개인정보 카드를 처리하지 않고 제출(DR.Privacy.check) — 어느 카드인지 말하지 않는다. 승인 버튼 없음
  function supervisorBlock(lines, back) {
    var screen = document.getElementById('screen-supervisor');
    screen.innerHTML = '';
    var b = el('button', { id: 'btn-back', class: 'btn btn-primary', type: 'button', text: '검수로 돌아가기' });
    b.addEventListener('click', function () { DR.Sfx.play('ui'); back(); });
    screen.appendChild(el('div', { class: 'page page-center', 'data-blocked': 'privacy' }, [
      el('p', { class: 'kicker', text: '승인 보류' }),
      el('div', { class: 'block-lines' }, lines.map(function (l) { return DR.UI.line(l); })),
      el('div', { class: 'actions' }, [b])
    ]));
    DR.App.go('supervisor');
  }

  root.DR.UI.inspect = inspect;
  root.DR.UI.supervisorBlock = supervisorBlock;
  root.DR.UI.supervisor = supervisor;
  root.DR.UI.supplementPrep = supplementPrep;
  root.DR.UI.effectiveKey = effectiveKey;
  root.DR.UI.comboCount = comboCount;
})(window);
