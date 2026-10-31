/*
 * 결과(기획서 §4.5) — 복구된 AI가 브리핑 장면을 하나씩 판정하는 모습을 그림 + 짧은 문구로.
 * 실패는 두 종류(불편/위험)로 구분하고, 문구는 "우리가 넣은 데이터에는 ○○가 없었다" 형식. 숫자 정확도 없음.
 */
(function (root) {
  'use strict';

  var DR = root.DR;
  function el() { return DR.UI.el.apply(null, arguments); }

  // 칩 문구는 임무마다 mission.outcomeText로 덮어쓴다(없으면 이 기본 문구)
  var OUTCOME = {
    pass: { text: '제대로 판단했다', cls: 'ok' },
    inconvenience: { text: '멀쩡한 길을 막았다 · 불편', cls: 'warn' },
    danger: { text: '잠긴 길을 통과시켰다 · 위험', cls: 'danger' }
  };

  function result(mission, judged, done) {
    var screen = document.getElementById('screen-result');
    var byCombo = {};
    mission.scenes.forEach(function (s) { s.combos.forEach(function (c) { byCombo[c.id] = c; }); });
    var i = 0;

    function show() {
      var r = judged.scenes[i], s = mission.scenes[i];
      var outcome = r.pass ? 'pass' : r.failKind;
      var last = i === judged.scenes.length - 1;
      var parts = [
        el('p', { class: 'kicker', text: '결과 · ' + (i + 1) + '/' + judged.scenes.length + ' 장면' }),
        el('h2', { text: s.title }),
        el('img', { class: 'result-art', src: DR.CardArt.scene(mission, s.id, outcome, 480).toDataURL(), alt: s.title }),
        el('p', { class: 'chip chip-' + OUTCOME[outcome].cls, text: (mission.outcomeText && mission.outcomeText[outcome]) || OUTCOME[outcome].text }),
        el('p', { class: 'lead', text: r.pass ? s.passLine : (r.failLine || s.cuts[r.failKind]) })
      ];
      // 빠진 조합: 문구 + 이번 가방의 숫자(붙은 설명표 기준)
      var counts = DR.Cards.labelCounts(mission, (DR.App.state && DR.App.state.bag) || []);
      r.missing.forEach(function (id) {
        var c = byCombo[id];
        parts.push(el('p', { class: 'missing', text: c.missingLine }));
        parts.push(el('p', { class: 'missing-count', text: '이번 가방: ' + DR.Cards.keyLabel(mission, c.keys[0]) + ' ' + DR.UI.comboCount(mission, counts, c) + '장 / 필요 ' + c.need + '장' }));
      });
      (r.contaminated || []).forEach(function (src) {
        parts.push(el('p', { class: 'missing contam', text: DR.Judge.contaminationLine(mission, src) }));
      });
      if (outcome === 'danger') parts.push(DR.UI.line({ who: 'supervisor', text: mission.story.responsibility }));
      if (last) {
        if (judged.mislabeled.length) parts.push(el('p', { class: 'missing', text: '설명표를 다르게 붙인 "?" 카드 ' + judged.mislabeled.length + '장은 어느 장면의 데이터도 되지 못했다.' }));
        var client = judged.allPass ? mission.story.clientPass : mission.story.clientFail;
        (client || []).forEach(function (l) { parts.push(DR.UI.line(l)); });
      }
      var next = el('button', { id: 'btn-next', class: 'btn btn-primary', type: 'button', text: last ? '계속' : '다음 장면' });
      next.addEventListener('click', function () {
        DR.Sfx.play('ui');
        if (last) { screen.innerHTML = ''; done(); } else { i++; show(); }
      });
      parts.push(el('div', { class: 'actions' }, [next]));
      screen.innerHTML = '';
      screen.appendChild(el('div', { class: 'page' }, [el('div', { class: 'result-scene', 'data-scene': s.id, 'data-outcome': outcome }, parts)]));
      screen.scrollTop = 0;
    }

    DR.App.go('result');
    show();
  }

  // 불꽃에 HP를 다 잃었을 때 — 같은 코스를 처음부터 다시
  function knockout(onRetry) {
    var screen = document.getElementById('screen-knockout');
    screen.innerHTML = '';
    var btn = el('button', { id: 'btn-rerun', class: 'btn btn-primary', type: 'button', text: '다시 달리기' });
    btn.addEventListener('click', function () { DR.Sfx.unlock(); DR.Sfx.play('ui'); onRetry(); });
    screen.appendChild(el('div', { class: 'page page-center' }, [
      el('p', { class: 'kicker', text: '데이터 세계' }),
      el('h2', { text: '러너 연결이 끊겼다' }),
      el('p', { class: 'lead', text: '불꽃에 너무 많이 맞았다. 같은 코스를 처음부터 다시 달린다. 이번 판에 잡은 카드는 비워진다.' }),
      DR.UI.line({ who: 'supervisor', text: '괜찮아, 다시 접속하자. 불꽃은 빨간 경고가 뜬 레인을 피하면 돼.' }),
      el('div', { class: 'actions' }, [btn])
    ]));
    DR.App.go('knockout');
  }

  root.DR.UI.result = result;
  root.DR.UI.knockout = knockout;
})(window);
