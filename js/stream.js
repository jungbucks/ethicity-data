/*
 * 코스 생성(기획서 §4.2·§7.3) — 같은 seed면 같은 코스.
 * 카드를 섞어 "줄"마다 1~2장씩 놓고(두 번째 카드는 cfg.cardStaggerSec초 뒤 — 나란히 같은 거리에 오지 않게), 드문 카드("?" 포함)는 같은 레인 앞에 노이즈 벽을 둔다.
 * 드문 카드 앞 벽 간격은 초 단위(cfg.rareWallGapSec) — 초반은 옆 레인으로 피했다 돌아와 잡을 수 있게 넉넉히, 후반은 촘촘히.
 *   거리 = 그 지점 속도 × 초. 다른 카드에 겹치면 rareGapRange 안에서 비킨다(카드 자리는 그대로, 벽만 옮긴다).
 * 벽은 그 밖에도 줄 사이에 듬성듬성(카드 수의 약 15%) — 바로 다음 줄에 카드가 있는 레인은 피한다. 세 레인을 모두 막는 일은 없다.
 * 불꽃(mission.fires개, 보충은 1개)은 벽·카드와 떨어진 줄 사이에 한 번에 하나씩 — 피할 빈 레인이 늘 있다.
 * 보충: 짧은 코스. focusCounts(부족한 장 수)가 있으면 key마다 부족분 × 1.5장 + 흔한 카드 4장,
 * focusKeys만 있으면 카드 12장 중 8장을 그 key로 고르게 채운다.
 * 가짜 카드(mission.fakes, spec §3.4): 종류마다 count장, 코스 앞 15%에는 두지 않는다(벽도 없음). 보충에는 1장.
 * 구역(장면 2개 이상인 임무): 코스를 장면별 구역으로 나눈다. 순서·짧은 이름은 mission.zones(없으면 장면 순서).
 *   카드 → 그 종류를 조합에 쓰는 장면(여러 장면이면 번갈아) · "?" 카드 → 진짜 종류 · 가짜 → 붙은 이름표를 쓰는 장면 중 가장 늦은 구역.
 *   가짜는 mission.fakeLate가 'zone'이면 자기 구역의 뒤쪽 절반(그리고 앞 15% 밖), 아니면 코스 50% 뒤(1 임무, 사용자 승인).
 */
(function (root) {
  'use strict';

  var START_SECONDS = 3, END_SECONDS = 1.5;
  var SUPPLEMENT_CARDS = 12, SUPPLEMENT_FOCUS = 8, SUPPLEMENT_SPARE = 1.5, SUPPLEMENT_COMMON = 4, SUPPLEMENT_FIRES = 1, EXTRA_WALL_RATE = 0.15, FIRE_CLEAR = 4, FAKE_FROM = 0.15;
  // 벽 자리: 뒤에 오는 같은 레인 카드와는 이만큼(s), 앞에 지나간 카드와는 이만큼(s) 띄운다 · 간격을 옮길 수 있는 폭 · 세 레인 막힘으로 치는 거리(m)
  var WALL_CLEAR_AFTER = 0.9, WALL_CLEAR_BEFORE = 0.5, WALL_SHIFT = 0.25, WALL_DODGE_SPARE = 0.1, WALL_ROW = 6;

  function cardsApi() {
    if (root.DR && root.DR.Cards) return root.DR.Cards;
    return require('./cards.js');
  }

  function glitchApi() {
    if (root.DR && root.DR.Glitch) return root.DR.Glitch;
    return require('./glitch.js');
  }

  function privacyApi() {
    if (root.DR && root.DR.Privacy) return root.DR.Privacy;
    return require('./privacy.js');
  }

  function rngApi() {
    if (root.DR && root.DR.Rng) return root.DR.Rng;
    return require('./rng.js');
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function isRare(mission, c) { if (c.fakeId) return false; return !!c.ambiguousId || !!(mission.cardTypes[c.key] && mission.cardTypes[c.key].rare); }

  function mainDeck(mission) {
    var deck = [];
    Object.keys(mission.counts).forEach(function (k) {
      for (var i = 0; i < mission.counts[k]; i++) deck.push({ key: k });
    });
    (mission.ambiguous || []).forEach(function (a) { deck.push({ ambiguousId: a.id }); });
    (mission.fakes || []).forEach(function (f) {
      for (var i = 0; i < f.count; i++) deck.push({ fakeId: f.id });
    });
    return deck;
  }

  // 구역 정의: mission.zones(1 임무 순서 S2 → S4 → S3 → S1은 사용자 승인) 또는 장면 순서. 장면이 하나뿐이면(튜토리얼) 구역 없음
  function zonesOf(mission) {
    if (mission.zones && mission.zones.length) return mission.zones;
    if (!mission.scenes || mission.scenes.length < 2) return null;
    return mission.scenes.map(function (sc) { return { id: sc.id, title: sc.title, short: sc.title }; });
  }
  function zoneIndex(mission, zones, c, alt) {
    var ids = zones.map(function (z) { return z.id; });
    if (c.fakeId) {
      var f = (mission.fakes || []).filter(function (x) { return x.id === c.fakeId; })[0];
      var best = -1;
      (f ? (f.scenes || cardsApi().scenesForLabel(mission, f.label)) : []).forEach(function (id) { best = Math.max(best, ids.indexOf(id)); });
      return best >= 0 ? best : ids.length - 1;
    }
    var key = c.key;
    if (c.ambiguousId) { var q = (mission.ambiguous || []).filter(function (x) { return x.id === c.ambiguousId; })[0]; key = q && q.truthKey; }
    var list = mission.scenes.filter(function (sc) { return sc.combos.some(function (cb) { return cb.keys.indexOf(key) >= 0; }); })
      .map(function (sc) { return sc.id; }).filter(function (id) { return ids.indexOf(id) >= 0; });
    if (!list.length) return ids.length - 1;
    var n = alt[key] || 0; alt[key] = n + 1;
    return ids.indexOf(list[n % list.length]);
  }
  function splitZones(deck, mission, zones) {
    var groups = zones.map(function () { return []; }), alt = {};
    deck.forEach(function (c) { groups[zoneIndex(mission, zones, c, alt)].push(c); });
    return groups;
  }
  function zonedRows(deck, mission, length, cfg, rng, zdefs) {
    var groups = splitZones(deck, mission, zdefs), weights = splitZones(mainDeck(mission), mission, zdefs).map(function (g) { return g.length; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), start = 0, zones = [], rows = [];
    groups.forEach(function (group, i) {
      var lastZone = i === zdefs.length - 1;
      var end = lastZone ? length : start + length * weights[i] / total;
      var zone = { id: zdefs[i].id, title: zdefs[i].title, short: zdefs[i].short, start: start, end: end };
      zones.push(zone);
      var count = group.length ? Math.ceil(group.length / 1.35) : 0;
      var first = i === 0 ? cfg.baseSpeed * START_SECONDS : start + 8;
      var last = end - (lastZone ? cfg.baseSpeed * END_SECONDS : 8);
      var local = [], di = 0;
      for (var j = 0; j < count; j++) local.push({ z: count === 1 ? last : first + (last - first) * j / (count - 1), cards: [group[di++]] });
      var singles = shuffle(local.slice(), rng);
      for (var k = 0; di < group.length; k++) singles[k].cards.push(group[di++]);
      keepFakesLate(local, mission.fakeLate === 'zone' ? Math.max((start + end) / 2, length * FAKE_FROM) : length * 0.5, rng);
      if (mission.rareLate) keepRareLate(local, start + (end - start) * mission.rareLate, mission, rng); // 구역 앞쪽은 흔한 모습부터(1 임무)
      local.forEach(function (r) { r.cards.forEach(function (c) { c.zoneId = zone.id; }); rows.push(r); });
      start = end;
    });
    return { rows: rows, zones: zones };
  }

  // focusCounts({key: 부족한 장 수})가 있으면 부족분 × SUPPLEMENT_SPARE장씩(놓칠 여유), 없으면 focusKeys로 8장 고르게
  function supplementDeck(mission, focusKeys, focusCounts, seed) {
    var deck = [];
    if (focusCounts) {
      Object.keys(focusCounts).forEach(function (k) {
        for (var n = Math.ceil(focusCounts[k] * SUPPLEMENT_SPARE); n > 0; n--) deck.push({ key: k });
      });
    } else {
      for (var i = 0; i < SUPPLEMENT_FOCUS; i++) deck.push({ key: focusKeys[i % focusKeys.length] });
    }
    var fill = focusCounts ? deck.length + SUPPLEMENT_COMMON : SUPPLEMENT_CARDS;
    // 나머지는 흔한 카드(드물지 않은 것 중 많은 순)
    var common = Object.keys(mission.counts).filter(function (k) { return !mission.cardTypes[k].rare; })
      .sort(function (a, b) { return mission.counts[b] - mission.counts[a]; });
    for (var j = 0; deck.length < fill; j++) deck.push({ key: common[j % common.length] });
    var fakes = mission.fakes || [];
    if (fakes.length) deck.push({ fakeId: fakes[Math.abs(seed | 0) % fakes.length].id });
    return deck;
  }

  // 앞 구간 줄의 드문 카드를 뒤 구간 줄의 흔한 카드와 맞바꾼다(mission.rareLate가 있는 임무만)
  function keepRareLate(rows, from, mission, rng) {
    var early = [], late = [];
    rows.forEach(function (row) {
      row.cards.forEach(function (c, i) {
        if (row.z < from && isRare(mission, c)) early.push({ row: row, i: i });
        if (row.z >= from && !isRare(mission, c)) late.push({ row: row, i: i });
      });
    });
    shuffle(late, rng);
    early.forEach(function (e, n) {
      var t = late[n];
      if (!t) return;
      var c = e.row.cards[e.i];
      e.row.cards[e.i] = t.row.cards[t.i];
      t.row.cards[t.i] = c;
    });
  }

  // 앞 구간 줄의 가짜를 뒤 구간 줄의 가짜 아닌 카드와 맞바꾼다(가짜가 없으면 rng를 쓰지 않아 코스가 그대로)
  function keepFakesLate(rows, from, rng) {
    var early = [];
    rows.forEach(function (row) {
      if (row.z < from) row.cards.forEach(function (c, i) { if (c.fakeId) early.push({ row: row, i: i }); });
    });
    if (!early.length) return;
    var late = [];
    rows.forEach(function (row) {
      if (row.z >= from) row.cards.forEach(function (c, i) { if (!c.fakeId) late.push({ row: row, i: i }); });
    });
    shuffle(late, rng);
    early.forEach(function (e, n) {
      var t = late[n];
      if (!t) return;
      var c = e.row.cards[e.i];
      e.row.cards[e.i] = t.row.cards[t.i];
      t.row.cards[t.i] = c;
    });
  }

  // 코스 진행 비율 → 드문 카드 앞 벽 간격(초). 표의 비율부터 다음 칸 전까지 같은 값
  function rareGapSec(cfg, progress) {
    var sec = cfg.rareWallGapSec[0][1];
    cfg.rareWallGapSec.forEach(function (row) { if (progress >= row[0]) sec = row[1]; });
    return sec;
  }
  function speedAt(cfg, progress) { return cfg.baseSpeed * (1 + cfg.speedRamp * Math.min(1, progress)); }
  // 벽을 옆 레인으로 피했다가 돌아와 카드를 잡는 데 드는 시간(레인 2번 이동 + 판정 구간)
  function dodgeSec(cfg) { return 2 * cfg.laneMoveSec + cfg.catchLead; }
  function canDodge(cfg, sec) { return sec >= dodgeSec(cfg); }

  // 이 자리에 벽을 세워도 되나: 같은 레인 카드와 떨어져 있고(target = 이 벽이 지키는 카드), 세 레인을 다 막지 않는다
  function wallFits(z, lane, cards, walls, cfg, target) {
    var after = cfg.baseSpeed * WALL_CLEAR_AFTER, before = cfg.baseSpeed * WALL_CLEAR_BEFORE;
    var near = cards.some(function (c) {
      if (c === target || c.lane !== lane) return false;
      var d = c.z - z;
      return d >= 0 ? d < after : -d < before;
    });
    if (near) return false;
    var others = {};
    walls.forEach(function (w) { if (w.lane !== lane && Math.abs(w.z - z) < WALL_ROW) others[w.lane] = true; });
    return Object.keys(others).length < 2;
  }

  // 간격을 옮겨도 되는 범위(초). 피할 수 있는 구간은 앞줄 카드를 비켜 더 좁혀도 되지만, 피할 수 있는 시간 밑으로는 내려가지 않는다
  function rareGapRange(cfg, sec) {
    return [canDodge(cfg, sec) ? dodgeSec(cfg) + WALL_DODGE_SPARE : sec * (1 - WALL_SHIFT), sec * (1 + WALL_SHIFT)];
  }

  function rareWallZ(card, length, cards, walls, cfg) {
    var p = card.z / length, sec = rareGapSec(cfg, p), v = speedAt(cfg, p), range = rareGapRange(cfg, sec);
    var best = null, bestRoom = -1;
    for (var n = 0; n <= 60; n++) {
      var s = sec + (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.05; // 정해진 간격에서 가까운 순
      if (s < range[0] || s > range[1]) continue;
      var z = card.z - v * s;
      if (z >= cfg.baseSpeed && wallFits(z, card.lane, cards, walls, cfg, card)) return z;
      // 꼭 맞는 자리가 없으면(후반 드문 카드 둘이 같은 레인에 가까이) 범위 안에서 같은 레인 다른 카드와 가장 먼 자리
      var room = Math.min.apply(null, cards.filter(function (c) { return c !== card && c.lane === card.lane; }).map(function (c) { return Math.abs(c.z - z); }).concat([Infinity]));
      if (z >= cfg.baseSpeed && room > bestRoom) { best = z; bestRoom = room; }
    }
    return best !== null ? best : card.z - v * sec;
  }

  function build(mission, cfg, opts) {
    var counts = opts.focusCounts && Object.keys(opts.focusCounts).length ? opts.focusCounts : null;
    var focus = counts ? Object.keys(counts) : (opts.focusKeys && opts.focusKeys.length ? opts.focusKeys : null);
    var seconds = opts.seconds || (focus ? mission.supplementSeconds : mission.runSeconds);
    var length = seconds * cfg.baseSpeed;
    var rng = rngApi().create(opts.seed);
    var deck = shuffle(focus ? supplementDeck(mission, focus, counts, opts.seed) : mainDeck(mission), rng);

    // 줄 수: 한 줄에 1~2장
    var rowCount = Math.max(1, Math.ceil(deck.length / 1.35));
    var z0 = cfg.baseSpeed * START_SECONDS, z1 = length - cfg.baseSpeed * END_SECONDS;
    var step = rowCount > 1 ? (z1 - z0) / (rowCount - 1) : 0;
    var rows = [];
    for (var r = 0; r < rowCount; r++) rows.push({ z: z0 + step * r, cards: [] });
    // 각 줄에 한 장씩, 남는 카드는 아직 한 장뿐인 줄 중 무작위로
    var di = 0;
    rows.forEach(function (row) { row.cards.push(deck[di++]); });
    var singles = shuffle(rows.slice(), rng);
    for (var s = 0; di < deck.length; s++) singles[s].cards.push(deck[di++]);
    var zones = null;
    var zdefs = zonesOf(mission);
    if (zdefs) {
      var layout = zonedRows(deck, mission, length, cfg, rng, zdefs);
      rows = layout.rows; zones = layout.zones; rowCount = rows.length;
    } else keepFakesLate(rows, length * (mission.fakeFrom || FAKE_FROM), rng); // 첫 시험은 코스 뒤 절반(기본 잡기를 익힌 뒤)

    var items = [];
    rows.forEach(function (row) {
      var lanes = shuffle([0, 1, 2], rng);
      // 앞뒤 간격(2026-11-08 사용자 결정): 한 줄의 두 번째 카드는 그 지점 속도 × cfg.cardStaggerSec만큼 뒤에 — 나란히 같은 거리에 오지 않게.
      //   뒤로만 민다(가짜·드문·개인정보 카드의 '앞쪽엔 두지 않음' 규칙이 그대로 지켜진다). 난수를 쓰지 않아 종류·레인·구역은 그대로
      //   드문 카드와 흔한 카드가 한 줄이면 흔한 카드를 민다(드문 카드와 그 앞 벽은 원래 자리 — rareWallGapSec 그대로)
      var behind = speedAt(cfg, row.z / length) * (cfg.cardStaggerSec || 0);
      var first = row.cards.length > 1 && !isRare(mission, row.cards[0]) && isRare(mission, row.cards[1]) ? 1 : 0;
      row.cards.forEach(function (c, i) {
        var item = { kind: 'card', lane: lanes[i], z: row.z + (i === first ? 0 : behind), row: row };
        if (c.zoneId) item.zoneId = c.zoneId;
        if (c.ambiguousId) item.ambiguousId = c.ambiguousId;
        else if (c.fakeId) item.fakeId = c.fakeId;
        else item.key = c.key;
        if (isRare(mission, c)) item.rare = true;
        items.push(item);
      });
    });
    var cardItems = items.slice(), walls = [];
    function addWall(lane, z) { var w = { kind: 'wall', lane: lane, z: z }; walls.push(w); items.push(w); }
    cardItems.forEach(function (c) { if (c.rare) addWall(c.lane, rareWallZ(c, length, cardItems, walls, cfg)); });

    // 줄 사이 듬성듬성 벽
    var gaps = [];
    for (var g = 0; g < rowCount - 1; g++) gaps.push(g);
    shuffle(gaps, rng);
    var extra = Math.min(gaps.length, Math.round(deck.length * EXTRA_WALL_RATE));
    for (var e = 0; e < extra; e++) {
      var gi = gaps[e], z = (rows[gi].z + rows[gi + 1].z) / 2, first = Math.floor(rng.next() * 3);
      var lanes = [first, (first + 1) % 3, (first + 2) % 3].filter(function (l) { return wallFits(z, l, cardItems, walls, cfg); });
      var usedBy = function (row, l) { return cardItems.some(function (c) { return c.row === row && c.lane === l; }); }; // 줄 소속으로(앞뒤 간격으로 z가 조금씩 다르다)
      // 바로 다음 줄에 카드가 없는 레인만, 그중 앞 줄에도 없는 레인을 먼저(자리가 없으면 이 벽은 세우지 않는다)
      var open = lanes.filter(function (l) { return !usedBy(rows[gi + 1], l); });
      var clear = open.filter(function (l) { return !usedBy(rows[gi], l); });
      if (open.length) addWall(clear.length ? clear[0] : open[0], z);
    }

    // 불꽃(방해 세력): 남은 줄 사이 중 벽·카드와 떨어진 곳에, 한 번에 하나씩(간격 3초 이상)
    var fireCount = focus ? SUPPLEMENT_FIRES : (mission.fires || 0);
    var fireFrom = length * (mission.fireFrom || 0), fireZs = [];
    gaps.slice(extra).forEach(function (gi) {
      if (fireZs.length >= fireCount) return;
      var z = (rows[gi].z + rows[gi + 1].z) / 2, lane = Math.floor(rng.next() * 3);
      if (z < fireFrom) return;
      if (fireZs.some(function (fz) { return Math.abs(fz - z) < cfg.baseSpeed * 3; })) return;
      if (items.some(function (it) { return Math.abs(it.z - z) < FIRE_CLEAR && (it.kind === 'wall' || it.lane === lane); })) return;
      fireZs.push(z);
      items.push({ kind: 'fire', lane: lane, z: z });
    });

    items.sort(function (a, b) { return a.z - b.z || a.lane - b.lane; });
    var nc = 0, nw = 0, nf = 0;
    items = items.map(function (it) {
      var o = { uid: it.kind === 'card' ? 'c' + (nc++) : it.kind === 'fire' ? 'f' + (nf++) : 'w' + (nw++), kind: it.kind };
      if (it.key) o.key = it.key;
      if (it.ambiguousId) o.ambiguousId = it.ambiguousId;
      if (it.fakeId) o.fakeId = it.fakeId;
      if (it.zoneId) o.zoneId = it.zoneId;
      o.lane = it.lane; o.z = it.z;
      return o;
    });
    var course = { length: length, items: items };
    if (zones) { course.zones = zones; course.supplement = !!focus; }
    // 목적 밖 개인정보 카드(첫 판만): 이미 놓인 흔한 카드에 privateId만 붙인다 — 자리·uid·벽은 그대로(DR.Privacy.mark)
    if (!focus) privacyApi().mark(mission, course);
    // "지지직" 연출 대상(흔한 카드만, mission.glitchRate) — 따로 돌리는 난수라 코스는 그대로, 표시 필드 glitch만 붙는다(DR.Glitch.mark)
    glitchApi().mark(mission, course, opts.seed);
    return course;
  }

  var api = { build: build, zonesOf: zonesOf, rareGapSec: rareGapSec, rareGapRange: rareGapRange, speedAt: speedAt, dodgeSec: dodgeSec, canDodge: canDodge };
  root.DR = root.DR || {};
  root.DR.Stream = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
