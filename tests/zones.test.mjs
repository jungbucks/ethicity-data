import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Stream = require('../js/stream.js'), m = require('../missions/m1.js'), cfg = require('../js/config.js');
test('four approved zones, counts, late fakes and rare wall distance', () => {
  for (const seed of [1101, 1102, 1, 8, 42, 999]) {
    const c = Stream.build(m, cfg, { seed });
    assert.deepEqual(c.zones.map(z => z.id), ['S2', 'S4', 'S3', 'S1']);
    const cards = c.items.filter(i => i.kind === 'card');
    for (const [key, count] of Object.entries(m.counts)) assert.equal(cards.filter(i => i.key === key).length, count);
    for (const it of cards) {
      const z = c.zones.find(z => z.id === it.zoneId);
      assert.ok(it.z >= z.start && it.z < z.end);
      const expected = { day_deep:'S1', day_shallow:'S1', day_wet:'S2', day_dry:'S2', q_clean:'S2', night_neon:'S3', night_deep:'S3', q_neon:'S3', night_shallow:'S4', night_muddy:'S4', q_muddy:'S4' }[it.key || it.ambiguousId];
      if (expected) assert.equal(it.zoneId, expected);
      if (it.fakeId) { assert.ok(it.z >= c.length * .5); assert.equal(it.zoneId, it.fakeId === 'f_fridge' ? 'S3' : 'S1'); }
      if (it.ambiguousId || m.cardTypes[it.key]?.rare) assert.ok(rareWallOf(c, it), it.uid);
    }
    assert.equal(cards.filter(i => i.key === 'night_wet' && i.zoneId === 'S3').length, 3);
    assert.equal(cards.filter(i => i.key === 'night_wet' && i.zoneId === 'S4').length, 3);
    assert.deepEqual(c, Stream.build(m, cfg, { seed }));
  }
});
test('supplements keep the map and fake in matching late zone', () => {
  for (const seed of [1102, 1103, 1104]) {
    const c = Stream.build(m, cfg, { seed, focusCounts: { night_deep: 2 } });
    assert.equal(c.zones.length, 4); assert.equal(c.supplement, true);
    const f = c.items.find(i => i.fakeId); assert.ok(f.z >= c.length / 2);
  }
});

// [3] 구역 배치 일반화: 1 임무·튜토리얼의 카드는 그대로다(일반화 전 스냅숏). 벽은 초 단위 간격으로 옮겨서 카드만 비교
import fs from 'node:fs';
import { rareWallOf, cardsOf } from './walls-helper.mjs';
const before = JSON.parse(fs.readFileSync(new URL('./fixtures/courses-before-zones.json', import.meta.url)));
const tut = require('../missions/tutorial.js');
test('m1 and tutorial courses identical to before the generalisation', () => {
  for (const seed of [1101, 1102, 1, 8, 42, 999]) assert.deepEqual(cardsOf(Stream.build(m, cfg, { seed })), cardsOf(before['m1_' + seed]), 'm1 ' + seed);
  assert.deepEqual(cardsOf(Stream.build(m, cfg, { seed: 1102, focusCounts: { night_deep: 2 } })), cardsOf(before.m1_sup_1102));
  assert.deepEqual(cardsOf(Stream.build(m, cfg, { seed: 1103, focusCounts: { night_shallow: 2, night_muddy: 2, day_wet: 1 } })), cardsOf(before.m1_sup_1103));
  assert.deepEqual(cardsOf(Stream.build(tut, cfg, { seed: 7 })), cardsOf(before.tut_7), 'tutorial has no zones');
});

const m2 = require('../missions/m2.js');
test('m2: four scene zones, counts kept, late fakes, rare walls', () => {
  for (const seed of [2201, 2202, 1, 8, 42, 999]) {
    const c = Stream.build(m2, cfg, { seed });
    assert.deepEqual(c.zones.map((z) => z.id), ['S1', 'S2', 'S3', 'S4']);
    assert.deepEqual(c.zones.map((z) => z.short), ['캔', '페트·비닐', '종이·영수증', '건전지']);
    const cards = c.items.filter((i) => i.kind === 'card');
    for (const [key, count] of Object.entries(m2.counts)) assert.equal(cards.filter((i) => i.key === key).length, count, key);
    for (const f of m2.fakes) assert.equal(cards.filter((i) => i.fakeId === f.id).length, f.count, f.id);
    for (const it of cards) {
      const z = c.zones.find((zz) => zz.id === it.zoneId);
      assert.ok(it.z >= z.start && it.z < z.end, it.uid);
      if (it.key) {
        const sc = m2.scenes.filter((s) => s.combos.some((cb) => cb.keys.includes(it.key))).map((s) => s.id);
        assert.ok(sc.includes(it.zoneId), it.key + ' in ' + it.zoneId);
      }
      if (it.fakeId) {
        assert.ok(it.z >= c.length * 0.15, 'no fake in the first 15% ' + it.fakeId);
        assert.ok(it.z >= (z.start + z.end) / 2 - 1e-9, 'fake in the later half of its zone ' + it.fakeId);
        const expect = { f_battery: 'S4', f_receipt: 'S3', f_toothbrush: 'S2', f_cat: 'S2' }[it.fakeId];
        assert.equal(it.zoneId, expect, it.fakeId);
        assert.ok(!c.items.some((w) => w.kind === 'wall' && w.lane === it.lane && it.z - w.z > 0 && it.z - w.z <= 6), 'no wall right before a fake');
      }
      if (m2.cardTypes[it.key]?.rare) assert.ok(rareWallOf(c, it), 'wall before rare ' + it.key);
    }
    assert.ok(cards.some((i) => i.key === 'can_drink' && i.zoneId === 'S1') && cards.some((i) => i.key === 'can_drink' && i.zoneId === 'S4'), 'drink cans in both can scenes');
    assert.deepEqual(c, Stream.build(m2, cfg, { seed }));
  }
});
test('m2 supplements keep the zones', () => {
  const c = Stream.build(m2, cfg, { seed: 2202, focusCounts: { battery_aa: 2 } });
  assert.equal(c.zones.length, 4); assert.equal(c.supplement, true);
  const f = c.items.find((i) => i.fakeId);
  assert.ok(f && f.z >= c.length * 0.15);
});
