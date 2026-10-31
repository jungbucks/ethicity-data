// 코스 생성 — 기획서 §4.2·§7.3 카드 흐름
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
require('../js/rng.js');
const m1 = require('../missions/m1.js');
const tutorial = require('../missions/tutorial.js');
const { build } = require('../js/stream.js');

const c = build(m1, cfg, { seed: 1101 });
const cards = (course) => course.items.filter((i) => i.kind === 'card');

test('card counts match mission', () => {
  for (const [k, n] of Object.entries(m1.counts)) assert.equal(c.items.filter((i) => i.key === k).length, n, k);
  assert.equal(c.items.filter((i) => i.ambiguousId).length, 3);
});

test('same seed same course, other seed differs', () => {
  assert.deepEqual(build(m1, cfg, { seed: 1101 }), c);
  assert.notDeepEqual(build(m1, cfg, { seed: 2 }).items, c.items);
});

test('items sorted by z with unique uids', () => {
  for (let i = 1; i < c.items.length; i++) assert.ok(c.items[i].z >= c.items[i - 1].z);
  assert.equal(new Set(c.items.map((i) => i.uid)).size, c.items.length);
});

test('rare cards sit behind a wall in their lane', () => {
  for (const it of c.items.filter((i) => i.ambiguousId || (i.key && m1.cardTypes[i.key].rare))) {
    assert.ok(c.items.some((w) => w.kind === 'wall' && w.lane === it.lane && it.z - w.z > 0 && it.z - w.z <= cfg.rareWallGap), it.uid);
  }
});

test('extra walls beyond rare ones', () => {
  const rare = c.items.filter((i) => i.ambiguousId || (i.key && m1.cardTypes[i.key].rare)).length;
  assert.ok(c.items.filter((i) => i.kind === 'wall').length > rare);
});

test('never three walls in one row', () => {
  const rows = Object.groupBy(c.items.filter((i) => i.kind === 'wall'), (w) => Math.round(w.z));
  for (const r of Object.values(rows)) assert.ok(new Set(r.map((w) => w.lane)).size < 3);
});

test('walls never share a spot with a card', () => {
  for (const w of c.items.filter((i) => i.kind === 'wall')) assert.ok(!cards(c).some((k) => k.lane === w.lane && Math.abs(k.z - w.z) < 2), w.uid);
});

test('same-lane spacing and opening gap', () => {
  const cs = cards(c);
  assert.ok(cs[0].z >= cfg.baseSpeed * 3);
  for (const l of [0, 1, 2]) {
    const zs = cs.filter((i) => i.lane === l).map((i) => i.z);
    for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] >= cfg.baseSpeed * 0.35 - 1e-9);
  }
});

test('course length matches run time', () => {
  assert.equal(c.length, m1.runSeconds * cfg.baseSpeed);
  assert.ok(c.items.at(-1).z < c.length);
});

test('supplement focuses on missing keys', () => {
  const s = build(m1, cfg, { seed: 3, focusKeys: ['night_shallow', 'night_muddy'] });
  const cs = cards(s).filter((i) => !i.fakeId);
  assert.equal(cs.length, 12);
  assert.ok(cs.filter((i) => ['night_shallow', 'night_muddy'].includes(i.key)).length >= 8);
  for (const k of ['night_shallow', 'night_muddy']) assert.ok(cs.filter((i) => i.key === k).length >= 4, k);
  assert.equal(cs.filter((i) => i.ambiguousId).length, 0);
  assert.equal(cards(s).filter((i) => i.fakeId).length, 1);
  assert.equal(s.length, m1.supplementSeconds * cfg.baseSpeed);
});

test('tutorial course builds', () => {
  const t = build(tutorial, cfg, { seed: 7 });
  assert.equal(t.items.filter((i) => i.key === 'dog').length, tutorial.counts.dog);
  assert.equal(t.items.filter((i) => i.key === 'cat').length, tutorial.counts.cat);
});

test('common-only bag can pass after one perfect supplement', () => {
  const { judge, shortfall } = require('../js/judge.js');
  const bag = [...Array(15)].map((_, i) => ({ id: 'a' + i, key: 'day_deep' })).concat([...Array(15)].map((_, i) => ({ id: 'b' + i, key: 'day_shallow' })));
  const short = shortfall(m1, bag, cfg);
  const s = build(m1, cfg, { seed: 5, focusCounts: short });
  const picked = s.items.filter((i) => i.kind === 'card' && short[i.key]).map((i) => ({ id: i.uid, key: i.key }));
  for (const [k, n] of Object.entries(short)) assert.ok(picked.filter((p) => p.key === k).length >= Math.ceil(n * 1.5), k);
  const kept = bag.filter((c) => c.id === 'a0' || c.id === 'a1' || c.id === 'b0' || c.id === 'b1');
  const after = kept.concat(picked);
  assert.ok(after.length <= m1.bag, `${after.length} > ${m1.bag}`);
  assert.equal(judge(m1, after, cfg).allPass, true);
  assert.equal(s.length, m1.supplementSeconds * cfg.baseSpeed);
});

// 불꽃(방해 세력) — 한 번에 하나, 빈 레인 보장, 카드와 겹치지 않음
const fires = (course) => course.items.filter((i) => i.kind === 'fire');

test('fire count follows mission and fires are spaced apart', () => {
  assert.equal(fires(c).length, m1.fires);
  const zs = fires(c).map((f) => f.z);
  for (let i = 1; i < zs.length; i++) assert.ok(zs[i] - zs[i - 1] >= cfg.baseSpeed * 3, 'one fire at a time');
});

test('a free lane always exists when a fire arrives (no walls near a fire)', () => {
  for (const f of fires(c)) assert.ok(!c.items.some((w) => w.kind === 'wall' && Math.abs(w.z - f.z) < 4), f.uid);
});

test('fires never sit on a card in their lane', () => {
  for (const f of fires(c)) assert.ok(!cards(c).some((k) => k.lane === f.lane && Math.abs(k.z - f.z) < 4), f.uid);
});

test('tutorial practice fires come late in the course', () => {
  const t = build(tutorial, cfg, { seed: tutorial.seed });
  assert.equal(fires(t).length, tutorial.fires);
  for (const f of fires(t)) assert.ok(f.z >= t.length * tutorial.fireFrom, f.uid);
});

test('supplement run has one fire', () => {
  assert.equal(fires(build(m1, cfg, { seed: 5, focusCounts: { night_shallow: 2 } })).length, 1);
});

// 가짜 카드(spec §3.4) — Task 3 전이라 테스트 안에서 m1에 가짜를 덮어 쓴다
const m1F = { ...m1, fakes: [{ id: 'f_a', label: 'day_deep', truth: null, count: 2 }, { id: 'f_b', label: 'night_wet', truth: null, count: 2 }] };
const fakesOf = (course) => course.items.filter((i) => i.kind === 'card' && i.fakeId);

test('fake counts match mission', () => {
  for (const seed of [1101, 3, 77]) {
    const f = fakesOf(build(m1F, cfg, { seed }));
    for (const d of m1F.fakes) assert.equal(f.filter((i) => i.fakeId === d.id).length, d.count, d.id + ' seed ' + seed);
  }
});

test('no fake in the first 15%', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const course = build(m1F, cfg, { seed });
    for (const f of fakesOf(course)) assert.ok(f.z >= course.length * 0.15, 'seed ' + seed + ' z ' + f.z);
  }
});

test('no wall right before a fake', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const course = build(m1F, cfg, { seed });
    for (const f of fakesOf(course)) {
      const wall = course.items.find((w) => w.kind === 'wall' && w.lane === f.lane && w.z < f.z && f.z - w.z <= cfg.rareWallGap);
      assert.equal(wall, undefined, 'seed ' + seed);
    }
  }
});

test('same seed same course with fakes', () => {
  assert.deepEqual(build(m1F, cfg, { seed: 9 }), build(m1F, cfg, { seed: 9 }));
});

test('supplement has one fake', () => {
  for (const seed of [4, 5]) {
    const f = fakesOf(build(m1F, cfg, { seed, focusCounts: { night_deep: 2 } }));
    assert.equal(f.length, 1);
    assert.equal(f[0].fakeId, m1F.fakes[seed % 2].id);
  }
});

test('missions without fakes unchanged', () => {
  const plain = { ...m1, fakes: undefined };
  const n = Object.values(m1.counts).reduce((a, b) => a + b, 0) + m1.ambiguous.length;
  assert.equal(cards(build(plain, cfg, { seed: 1101 })).length, n);
  assert.equal(fakesOf(build(tutorial, cfg, { seed: 7 })).length, 0);
});
