// "지지직" 연출(요청서 docs/feedback/2026-11-08-glitch-effect.md) — 대상 고르기·선명해지는 거리·깜빡임 일정·글자 깨기. 판정·코스는 그대로
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
require('../js/rng.js');
const Glitch = require('../js/glitch.js');
const Stream = require('../js/stream.js');
const M = { tutorial: require('../missions/tutorial.js'), m1: require('../missions/m1.js'), m2: require('../missions/m2.js'), m3: require('../missions/m3.js'), m4: require('../missions/m4.js'), flood: require('../missions/legacy-flood.js') };
const SEEDS = [1, 2, 3, 7, 8, 42, 99, 999, 1101, 1102, 2201, 2202, 3301, 3302, 3303, 3317, 4401];
const cards = (c) => c.items.filter((i) => i.kind === 'card');
const strip = (c) => ({ ...c, items: c.items.map(({ glitch, ...it }) => it) });

test('rates per mission: tutorial 0, m1 0.05, m2 0.15, m3 0.2, m4 untouched (none)', () => {
  assert.equal(M.tutorial.glitchRate, 0);
  assert.equal(M.m1.glitchRate, 0.05);
  assert.equal(M.m2.glitchRate, 0.15);
  assert.equal(M.m3.glitchRate, 0.2);
  assert.equal(M.m4.glitchRate, undefined);
  assert.doesNotMatch(fs.readFileSync(new URL('../missions/m4.js', import.meta.url), 'utf8'), /glitch/i, 'm4 file not touched');
});

test('only common cards: never fake, "?", rare or private cards', () => {
  for (const [id, m] of Object.entries(M)) for (const seed of SEEDS) for (const c of [Stream.build(m, cfg, { seed }), m.supplementSeconds ? Stream.build(m, cfg, { seed, focusCounts: { [Object.keys(m.counts)[0]]: 2 } }) : null].filter(Boolean)) {
    for (const it of c.items.filter((i) => i.glitch)) {
      assert.equal(it.kind, 'card', id);
      assert.ok(it.key && !it.fakeId && !it.ambiguousId && !it.privateId, id + ' ' + seed + ' ' + it.uid);
      assert.ok(!m.cardTypes[it.key].rare, id + ' rare ' + it.key);
      assert.ok(Glitch.EFFECTS.includes(it.glitch), it.glitch);
    }
  }
});

test('how many: round(common cards × glitchRate), none where the rate is 0', () => {
  for (const [id, m] of Object.entries(M)) for (const seed of SEEDS) {
    const c = Stream.build(m, cfg, { seed });
    const pool = cards(c).filter((it) => Glitch.eligible(m, it));
    assert.equal(cards(c).filter((i) => i.glitch).length, Math.round(pool.length * (m.glitchRate || 0)), id + ' ' + seed);
  }
  assert.ok(cards(Stream.build(M.m2, cfg, { seed: M.m2.seed })).filter((i) => i.glitch).length >= 4, 'm2 has a few');
});

test('seed-based: same seed same marks, seeds differ, all three effects show up', () => {
  const seen = new Set();
  for (const seed of SEEDS) {
    const a = Stream.build(M.m3, cfg, { seed });
    assert.deepEqual(a, Stream.build(M.m3, cfg, { seed }));
    cards(a).forEach((i) => i.glitch && seen.add(i.glitch));
  }
  assert.deepEqual([...seen].sort(), ['glyph', 'rgb', 'stripe']);
  const marks = (seed) => cards(Stream.build(M.m3, cfg, { seed })).map((i) => i.glitch || '').join(',');
  assert.notEqual(marks(3301), marks(3302));
});

test('purely visual: the course is the same with glitches off (cards, walls, fires, uids)', () => {
  for (const [id, m] of Object.entries(M)) for (const seed of SEEDS) {
    assert.deepEqual(strip(Stream.build(m, cfg, { seed })), Stream.build({ ...m, glitchRate: 0 }, cfg, { seed }), id + ' ' + seed);
  }
});

test('clear distance = catch window + 1.0 s (never shorter than at base speed)', () => {
  assert.equal(cfg.glitch.clearSec, 1.0);
  assert.equal(Glitch.clearDist(20, cfg), 20 * (cfg.catchLead + 1.0));
  assert.equal(Glitch.clearDist(8, cfg), cfg.baseSpeed * (cfg.catchLead + 1.0), 'slowed by a wall: still clears by base-speed distance');
  // 잡기 구간이 시작되기 전에 늘 1초 이상 선명
  for (const v of [8, 16, 20, 30]) {
    const reach = Math.max(v, cfg.baseSpeed);
    assert.ok((Glitch.clearDist(v, cfg) - reach * cfg.catchLead) / v >= 1.0 - 1e-9, 'speed ' + v);
  }
});

test('flash safety: at most 3 bursts in any 1 s window, short bursts', () => {
  for (const uid of ['c0', 'c7', 'c13', 'c42']) {
    const onsets = [];
    let prev = -1;
    for (let t = 0; t < 12; t += 1 / 240) {
      const f = Glitch.burst(t, uid, cfg);
      if (f >= 0 && prev < 0) onsets.push(t);
      prev = f;
    }
    assert.ok(onsets.length >= 10, 'it does glitch');
    for (const t of onsets) assert.ok(onsets.filter((o) => o >= t && o < t + 1).length <= 3, uid + ' at ' + t);
  }
  assert.ok(cfg.glitch.on <= 0.2 && cfg.glitch.on < cfg.glitch.period);
});

test('glyph scramble: same length, some letters become symbols, never "?", deterministic', () => {
  for (const s of ['캔 음료', '신문지·종이 상자', '역 앞 광장', 'PET']) {
    for (const f of [0, 1]) {
      const g = Glitch.scramble(s, f, 'c5');
      assert.equal([...g].length, [...s].length);
      assert.notEqual(g, s);
      assert.ok(!g.includes('?'));
      assert.equal(g, Glitch.scramble(s, f, 'c5'));
      [...s].forEach((ch, i) => { if (ch === ' ') assert.equal([...g][i], ' '); });
    }
  }
});
