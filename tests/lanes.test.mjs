// 레인 수 = 임무 데이터(2026-11-09 사용자 결정 "마지막 미션에서만 4개"). 연습·1~3 임무는 3레인 코스 그대로, 4 임무만 4레인.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
require('../js/rng.js');
const Stream = require('../js/stream.js');
const Input = require('../js/input.js');
const M = { tutorial: require('../missions/tutorial.js'), m1: require('../missions/m1.js'), flood: require('../missions/legacy-flood.js'), m2: require('../missions/m2.js'), m3: require('../missions/m3.js'), m4: require('../missions/m4.js') };
const SEEDS = [1, 2, 3, 7, 8, 42, 99, 999, 1101, 1102, 2201, 2202, 3301, 3302, 3303, 3317, 4401];
const cards = (c) => c.items.filter((i) => i.kind === 'card');

// 바꾸기 전(5828537) 코스 그대로 — 카드·벽·불꽃·개인정보·지지직 표시까지 전부(tests/fixtures/make-courses-before-lanes.cjs)
test('tutorial·m1·m2·m3 (and old flood) courses are byte-identical to before lane counts became data', () => {
  const before = JSON.parse(fs.readFileSync(new URL('./fixtures/courses-before-lanes.json', import.meta.url)));
  for (const [id, m] of Object.entries(M)) {
    if (id === 'm4') continue;
    for (const seed of [m.seed, 42, 999]) assert.deepEqual(JSON.parse(JSON.stringify(Stream.build(m, cfg, { seed }))), before[id + '_' + seed], id + ' ' + seed);
    if (m.supplementSeconds) {
      assert.deepEqual(JSON.parse(JSON.stringify(Stream.build(m, cfg, { seed: m.seed + 1, focusCounts: { [Object.keys(m.counts)[0]]: 2 } }))), before[id + '_supc'], id + ' supc');
      assert.deepEqual(JSON.parse(JSON.stringify(Stream.build(m, cfg, { seed: m.seed + 2, focusKeys: Object.keys(m.counts).slice(0, 2) }))), before[id + '_supk'], id + ' supk');
    }
  }
});

test('lane count is mission data: 3 by default, 4 only in mission 4', () => {
  for (const id of ['tutorial', 'm1', 'm2', 'm3', 'flood']) assert.equal(Stream.laneCount(M[id]), 3, id);
  assert.equal(M.m4.lanes, 4);
  assert.equal(Stream.laneCount(M.m4), 4);
  assert.equal(Stream.laneCount(null), 3);
});

const courses4 = () => SEEDS.flatMap((seed) => [Stream.build(M.m4, cfg, { seed }), Stream.build(M.m4, cfg, { seed, focusCounts: { cur_ai: 2 } }), Stream.build(M.m4, cfg, { seed, focusKeys: ['neat_ai', 'alt_ml'] })]);

test('m4: items sit only on lanes 0..3, and all four lanes carry cards', () => {
  for (const c of courses4()) for (const it of c.items) assert.ok(Number.isInteger(it.lane) && it.lane >= 0 && it.lane <= 3, it.uid);
  for (const seed of SEEDS) assert.deepEqual([...new Set(cards(Stream.build(M.m4, cfg, { seed })).map((i) => i.lane))].sort(), [0, 1, 2, 3], 'seed ' + seed);
});

test('m4: same cards as a 3-lane build of the same seed — kinds, distances, zones, stagger; only lanes, walls and fires differ', () => {
  const three = { ...M.m4, lanes: 3 };
  const sig = (c) => cards(c).map(({ lane, ...it }) => it);
  for (const seed of SEEDS) {
    assert.deepEqual(sig(Stream.build(M.m4, cfg, { seed })), sig(Stream.build(three, cfg, { seed })), 'seed ' + seed);
    assert.deepEqual(sig(Stream.build(M.m4, cfg, { seed, focusCounts: { cur_ai: 2 } })), sig(Stream.build(three, cfg, { seed, focusCounts: { cur_ai: 2 } })), 'sup ' + seed);
  }
});

test('m4: a free lane always stays open — walls never close all four lanes at one distance, fires keep clear of walls', () => {
  for (const c of courses4()) {
    const walls = c.items.filter((i) => i.kind === 'wall');
    for (const w of walls) assert.ok(new Set(walls.filter((o) => Math.abs(o.z - w.z) < 6).map((o) => o.lane)).size < 4, w.uid);
    for (const f of c.items.filter((i) => i.kind === 'fire')) assert.ok(!walls.some((w) => Math.abs(w.z - f.z) < 4), f.uid);
  }
});

test('m4: every rare card still has its wall in its own lane', () => {
  for (const seed of SEEDS) {
    const c = Stream.build(M.m4, cfg, { seed });
    for (const it of cards(c).filter((i) => i.ambiguousId || (M.m4.cardTypes[i.key] || {}).rare)) {
      assert.ok(c.items.some((w) => w.kind === 'wall' && w.lane === it.lane && w.z < it.z && it.z - w.z < 60), seed + ' ' + it.uid);
    }
  }
});

test('input: lane moves stop at the edges for 3 and 4 lanes', () => {
  assert.equal(Input.nextLane(1, -1, 3), 0);
  assert.equal(Input.nextLane(0, -1, 3), 0);
  assert.equal(Input.nextLane(2, 1, 3), 2);
  assert.equal(Input.nextLane(2, 1, 4), 3);
  assert.equal(Input.nextLane(3, 1, 4), 3);
  assert.equal(Input.nextLane(1, 1), 2);
  assert.equal(Input.nextLane(2, 1), 2, 'default 3 lanes');
  assert.equal(Input.startLane(3), 1);
  assert.equal(Input.startLane(4), 1);
});
