/*
 * 보충 달리기 누적 목표(교사 피드백 2026-11-09) — 순수 모듈(node로 단위 테스트). 판정 규칙은 바꾸지 않고 읽기만 한다.
 * plan(mission, bag, extra, cfg, named): 출발할 때 가방 + 동기 카드(extra)로 판정(DR.Judge.judge)해서 빠진 조합 = short.
 *   같은 종류 묶음(keys가 같은 조합 — 4 임무 S1·S3 또박또박, S3·S4 띄어 쓴 '머신 러닝')은 한 줄, 필요 장수는 큰 쪽.
 *   줄 순서 = 모자란 줄(구역 순서) → 다 찬 줄(구역 순서). 보충 준비가 같은 판정으로 '출발/다시 제출'을 정하므로 새로 드러나는 정보는 없다.
 * status(mission, plan, grabbed): 개수 = 가방 + 동기 카드 + 이번에 잡은 카드를 '붙은 이름표 기준'(DR.Cards.labelCounts —
 *   검수·보충 준비·결과 화면과 같은 규칙)으로. 가짜의 정체·"?" 카드 정답은 드러내지 않는다. 달리며 잡은 "?" 카드는 unknown으로 따로.
 *   lookAgain = 판정으로는 모자랐는데 화면 개수로는 찬 줄(이름표가 틀린 카드가 섞임) — ✓를 달지 않는다(보충 준비의 '이름표를 다시 살펴봐요'와 같은 뜻).
 */
(function (root) {
  'use strict';

  function api(name, file) {
    if (root.DR && root.DR[name]) return root.DR[name];
    return require(file);
  }

  function zoneOrder(mission) {
    var ids = (mission.zones || []).map(function (z) { return z.id; });
    mission.scenes.forEach(function (s) { if (ids.indexOf(s.id) < 0) ids.push(s.id); });
    return ids;
  }

  function plan(mission, bag, extra, cfg, named) {
    var C = api('Cards', './cards.js'), J = api('Judge', './judge.js');
    bag = bag || []; extra = extra || [];
    var base = bag.concat(extra);
    var judged = J.judge(mission, base, cfg, { named: named || [] });
    var withoutPeer = extra.length ? J.judge(mission, bag, cfg, { named: named || [] }) : judged;
    var missing = {}, missingNoPeer = {};
    judged.scenes.forEach(function (s) { s.missing.forEach(function (id) { missing[id] = true; }); });
    withoutPeer.scenes.forEach(function (s) { s.missing.forEach(function (id) { missingNoPeer[id] = true; }); });
    var order = zoneOrder(mission), groups = {}, list = [];
    order.forEach(function (sid, zi) {
      var scene = mission.scenes.filter(function (s) { return s.id === sid; })[0];
      if (!scene) return;
      scene.combos.forEach(function (c) {
        var sig = c.keys.slice().sort().join('+'), g = groups[sig];
        if (!g) {
          g = groups[sig] = { name: C.comboName(mission, c), keys: c.keys.slice(), need: 0, short: false, peerFilled: false, zone: zi, combos: [] };
          list.push(g);
        }
        g.need = Math.max(g.need, c.need);
        g.combos.push(c.id);
        if (missing[c.id]) g.short = true;
      });
    });
    var startCounts = C.labelCounts(mission, base);
    list.forEach(function (g) {
      g.peerFilled = !g.short && g.combos.some(function (id) { return missingNoPeer[id]; });
      g.startHave = g.keys.reduce(function (n, k) { return n + (startCounts[k] || 0); }, 0);
      g.lookAgain = g.short && g.startHave >= g.need;
    });
    var rows = list.filter(function (g) { return g.short; }).concat(list.filter(function (g) { return !g.short; }));
    return { rows: rows, base: base.map(function (c) { return Object.assign({}, c); }), peer: extra.length };
  }

  function status(mission, p, grabbed) {
    var C = api('Cards', './cards.js');
    grabbed = grabbed || [];
    var counts = C.labelCounts(mission, p.base.concat(grabbed.filter(function (g) { return !g.ambiguousId; })));
    var unknown = grabbed.filter(function (g) { return g.ambiguousId; }).length;
    var rows = p.rows.map(function (r) {
      var have = r.keys.reduce(function (n, k) { return n + (counts[k] || 0); }, 0);
      var full = have >= r.need, lookAgain = !!r.lookAgain; // 처음부터 화면 개수로 찼는데 판정은 모자랐던 줄 = 이름표가 틀린 카드가 섞임(✓ 없음)
      return { name: r.name, keys: r.keys, need: r.need, short: r.short, peerFilled: r.peerFilled, have: have, startHave: r.startHave,
        lookAgain: lookAgain, done: full && !lookAgain, text: r.name + ' ' + have + '/' + r.need + '장' + (full && !lookAgain ? ' ✓' : '') };
    });
    return { rows: rows, unknown: unknown, peer: p.peer, allDone: rows.every(function (r) { return !r.short || r.done; }) };
  }

  var out = { plan: plan, status: status };
  root.DR = root.DR || {};
  root.DR.NeedGoal = out;
  if (typeof module !== 'undefined' && module.exports) module.exports = out;
})(typeof window !== 'undefined' ? window : globalThis);
