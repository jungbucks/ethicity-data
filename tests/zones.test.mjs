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
      if (it.ambiguousId || m.cardTypes[it.key]?.rare) assert.ok(c.items.some(w => w.kind === 'wall' && w.lane === it.lane && Math.abs(w.z - (it.z - cfg.rareWallGap)) < 1e-8));
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
