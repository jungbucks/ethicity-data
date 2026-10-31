/*
 * 코스 생성(기획서 §4.2·§7.3) — 같은 seed면 같은 코스.
 * 카드를 섞어 "줄"(같은 z)마다 1~2장씩 놓고, 드문 카드("?" 포함)는 같은 레인 바로 앞에 노이즈 벽을 둔다.
 * 벽은 그 밖에도 줄 사이에 듬성듬성(카드 수의 약 15%). 한 줄을 세 레인 모두 막는 일은 없다.
 * 불꽃(mission.fires개, 보충은 1개)은 벽·카드와 떨어진 줄 사이에 한 번에 하나씩 — 피할 빈 레인이 늘 있다.
 * 보충: 짧은 코스. focusCounts(부족한 장 수)가 있으면 key마다 부족분 × 1.5장 + 흔한 카드 4장,
 * focusKeys만 있으면 카드 12장 중 8장을 그 key로 고르게 채운다.
 * 가짜 카드(mission.fakes, spec §3.4): 종류마다 count장, 코스 앞 15%에는 두지 않는다(벽도 없음). 보충에는 1장.
 */
(function (root) {
  'use strict';

  var START_SECONDS = 3, END_SECONDS = 1.5;
  var SUPPLEMENT_CARDS = 12, SUPPLEMENT_FOCUS = 8, SUPPLEMENT_SPARE = 1.5, SUPPLEMENT_COMMON = 4, SUPPLEMENT_FIRES = 1, EXTRA_WALL_RATE = 0.15, FIRE_CLEAR = 4, FAKE_FROM = 0.15;

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

  // 코스 순서는 사용자 승인: S2 → S4 → S3 → S1. 장면 자체의 순서/정답은 그대로 둔다.
  var ZONES = [
    { id: 'S2', title: '물청소 직후의 낮 도로', short: '물청소 도로' },
    { id: 'S4', title: '고가도로 아래 저지대', short: '고가도로 아래' },
    { id: 'S3', title: '비 오는 밤 번화가 교차로', short: '밤 번화가' },
    { id: 'S1', title: '낮 주택가 골목', short: '주택가 골목' }
  ];
  function splitZones(deck, mission) {
    var groups = [[], [], [], []], wet = 0;
    deck.forEach(function (c) {
      var key = c.key || c.ambiguousId;
      if (c.fakeId) key = (mission.fakes.find(function (f) { return f.id === c.fakeId; }) || {}).label;
      var n = /^(day_deep|day_shallow)$/.test(key) ? 3 : /^(day_wet|day_dry|q_clean)$/.test(key) ? 0 : /^(night_shallow|night_muddy|q_muddy)$/.test(key) ? 1 : 2;
      if (key === 'night_wet' && !c.fakeId) n = wet++ % 2 ? 1 : 2;
      groups[n].push(c);
    });
    return groups;
  }
  function zonedRows(deck, mission, length, cfg, rng) {
    var groups = splitZones(deck, mission), weights = splitZones(mainDeck(mission), mission).map(function (g) { return g.length; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), start = 0, zones = [], rows = [];
    groups.forEach(function (group, i) {
      var end = i === 3 ? length : start + length * weights[i] / total;
      var zone = { id: ZONES[i].id, title: ZONES[i].title, short: ZONES[i].short, start: start, end: end };
      zones.push(zone);
      var count = group.length ? Math.ceil(group.length / 1.35) : 0;
      var first = i === 0 ? cfg.baseSpeed * START_SECONDS : start + 8;
      var last = end - (i === 3 ? cfg.baseSpeed * END_SECONDS : 8);
      var local = [], di = 0;
      for (var j = 0; j < count; j++) local.push({ z: count === 1 ? last : first + (last - first) * j / (count - 1), cards: [group[di++]] });
      var singles = shuffle(local.slice(), rng);
      for (var k = 0; di < group.length; k++) singles[k].cards.push(group[di++]);
      keepFakesLate(local, length * 0.5, rng);
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
    if (mission.id === 'm1') {
      var layout = zonedRows(deck, mission, length, cfg, rng);
      rows = layout.rows; zones = layout.zones; rowCount = rows.length;
    } else keepFakesLate(rows, length * FAKE_FROM, rng);

    var items = [];
    rows.forEach(function (row) {
      var lanes = shuffle([0, 1, 2], rng);
      row.cards.forEach(function (c, i) {
        var item = { kind: 'card', lane: lanes[i], z: row.z };
        if (c.zoneId) item.zoneId = c.zoneId;
        if (c.ambiguousId) item.ambiguousId = c.ambiguousId;
        else if (c.fakeId) item.fakeId = c.fakeId;
        else item.key = c.key;
        items.push(item);
        if (isRare(mission, c)) items.push({ kind: 'wall', lane: lanes[i], z: row.z - cfg.rareWallGap });
      });
    });

    // 줄 사이 듬성듬성 벽
    var gaps = [];
    for (var g = 0; g < rowCount - 1; g++) gaps.push(g);
    shuffle(gaps, rng);
    var extra = Math.min(gaps.length, Math.round(deck.length * EXTRA_WALL_RATE));
    for (var e = 0; e < extra; e++) {
      var gi = gaps[e];
      items.push({ kind: 'wall', lane: Math.floor(rng.next() * 3), z: (rows[gi].z + rows[gi + 1].z) / 2 });
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
    return course;
  }

  var api = { build: build };
  root.DR = root.DR || {};
  root.DR.Stream = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
