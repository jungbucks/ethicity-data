// 임무 데이터 형식·기획서 일치 검증
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const Rng = require('../js/rng.js');
const m1 = require('../missions/m1.js');
const tutorial = require('../missions/tutorial.js');
const cast = require('../missions/cast.js');

const combos = (m) => m.scenes.flatMap((s) => s.combos);

test('m1 combos reference existing card keys', () => {
  for (const c of combos(m1)) for (const k of c.keys) assert.ok(m1.cardTypes[k], k);
});

test('m1 scenes match the plan', () => {
  assert.deepEqual(m1.scenes.map((s) => s.id), ['S1', 'S2', 'S3', 'S4']);
  assert.equal(m1.scenes.find((s) => s.id === 'S4').emphasis, 'low');
  assert.deepEqual(combos(m1).filter((c) => c.boundary).map((c) => c.id).sort(), ['S3_night_neon', 'S4_night_muddy']);
});

test('ambiguous cards point at real keys and labels', () => {
  for (const q of m1.ambiguous) {
    assert.ok(m1.cardTypes[q.truthKey], q.id);
    assert.ok(m1.labelOptions.some((o) => o.id === q.correctLabel), q.id);
  }
  assert.equal(m1.ambiguous.length, 3);
});

test('every combo is fillable within the bag', () => {
  const keys = new Set(combos(m1).flatMap((c) => c.keys));
  const minCards = [...keys].reduce((n, k) => n + Math.max(...combos(m1).filter((c) => c.keys.includes(k)).map((c) => c.need)), 0);
  assert.ok(minCards <= m1.bag, `${minCards} > ${m1.bag}`);
  for (const k of keys) assert.ok(m1.counts[k] >= 2, k);
});

test('no forbidden copy', () => {
  const txt = JSON.stringify([m1, tutorial]);
  assert.ok(!/지하차도|%|AI가 틀렸|당신이 실패/.test(txt));
});

test('missingLine format', () => {
  for (const c of combos(m1)) assert.match(c.missingLine, /^우리가 넣은 데이터에는 .+(없었다|부족했다)\.$/, c.id);
});

test('tutorial needs 3 dogs and 3 cats in a 10-card bag', () => {
  assert.equal(tutorial.bag, 10);
  assert.deepEqual(tutorial.scenes[0].combos.map((c) => [c.keys[0], c.need]), [['dog', 3], ['cat', 3]]);
});

test('cast covers every speaker', () => {
  for (const m of [m1, tutorial]) {
    const lines = Object.values(m.story).filter(Array.isArray).flat();
    for (const l of lines) assert.ok(cast[l.who], l.who);
  }
});

test('config has the tuning keys', () => {
  for (const k of ['baseSpeed', 'speedRamp', 'laneWidth', 'catchLead', 'perfectWindow', 'grabBuffer', 'wallSlow', 'rareWallGap', 'swipeMin', 'maxDt', 'ambiguousWeight', 'maxSupplements', 'supplementFreeSlots', 'randomSeed']) assert.ok(k in cfg, k);
});

test('rng is deterministic', () => {
  const a = Rng.create(5), b = Rng.create(5);
  assert.equal(a.next(), b.next());
});

// 1 임무 가짜(spec §4)
const Cards = require('../js/cards.js');
const { judge } = require('../js/judge.js');
const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };

test('m1 fakes are well-formed', () => {
  assert.deepEqual(m1.fakes.map((f) => f.id), ['f_pool', 'f_fountain', 'f_fridge']);
  for (const f of m1.fakes) {
    assert.ok(m1.cardTypes[f.label], f.id);
    assert.ok(f.truth === null || m1.cardTypes[f.truth], f.id);
    assert.ok(f.count >= 1 && f.name && f.art, f.id);
    assert.match(f.line, /^우리가 넣은 데이터에 .+\.$/, f.id);
  }
});

test('m1 fake scenes', () => {
  const at = (id) => Cards.scenesForLabel(m1, m1.fakes.find((f) => f.id === id).label);
  assert.deepEqual(at('f_pool'), ['S1']);
  assert.deepEqual(at('f_fountain'), ['S1']);
  assert.deepEqual(at('f_fridge'), ['S3', 'S4']);
});

test('m1 passes in 30 cards avoiding fakes, fails with two', () => {
  const bag = bagOf({ ...ALL2, day_deep: 5, day_shallow: 5, day_wet: 3, day_dry: 3, night_wet: 6 });
  assert.equal(bag.length, 30);
  assert.equal(judge(m1, bag, cfg).allPass, true);
  const two = bag.slice(2).concat([{ id: 'x1', fakeId: 'f_fridge' }, { id: 'x2', fakeId: 'f_fridge' }]);
  assert.deepEqual(judge(m1, two, cfg).scenes.map((s) => s.pass), [true, true, false, false]);
});

test('m1 outcomeText has three kinds and chains to m2', () => {
  for (const k of ['pass', 'inconvenience', 'danger']) assert.ok(m1.outcomeText[k], k);
  assert.equal(m1.next, 'm2');
});

test('m1 bot says it labelled everything', () => {
  assert.ok(m1.story.intro.some((l) => l.who === 'bot' && /이름표/.test(l.text)));
});

test('no forbidden copy in fake lines', () => {
  assert.ok(!/지하차도|%|AI가 틀렸|당신이 실패/.test(JSON.stringify(m1.fakes)));
});
