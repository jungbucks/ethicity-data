// 컨베이어 실제 분류(spec §5.5) — 같은 가방이면 늘 같은 결과, 빨간 물건은 늘 가방의 원인과 이어진다
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const Rng = require('../js/rng.js');
const m2 = require('../missions/m2.js');
const { judge } = require('../js/judge.js');
const Conveyor = require('../js/conveyor.js');

const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const fakesOf = (id, n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: id + '_' + i, fakeId: id, ...extra }));
const M2_ALL2 = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };
const run = (bag) => Conveyor.sort(m2, judge(m2, bag, cfg));

test('all correct when nothing failed', () => {
  const out = run(bagOf(M2_ALL2));
  assert.equal(out.length, m2.conveyor.length);
  for (const it of out) {
    assert.equal(it.correct, true, it.id);
    assert.equal(it.bin, it.correctBin, it.id);
    assert.equal(it.cause, null, it.id);
    assert.equal(it.emergency, false, it.id);
  }
  assert.deepEqual(out.map((o) => o.id), m2.conveyor.map((c) => c.id));
});

test('every cause has an item', () => {
  const causes = new Set(m2.conveyor.flatMap((c) => c.causes));
  for (const s of m2.scenes) {
    for (const c of s.combos) assert.ok(causes.has(c.id), c.id);
    assert.ok(causes.has('contaminated:' + s.id), s.id);
  }
  for (const f of m2.fakes) assert.ok(causes.has(f.id), f.id);
});

test('deterministic', () => {
  const bag = bagOf({ ...M2_ALL2, can_tin: 0 }).concat(fakesOf('f_receipt', 2));
  assert.deepEqual(run(bag), run(bag));
});

test('receipt goes to paper when f_receipt contaminates', () => {
  const out = run(bagOf(M2_ALL2).concat(fakesOf('f_receipt', 2)));
  const receipt = out.find((o) => o.art === 'f_receipt');
  assert.equal(receipt.bin, 'paper');
  assert.equal(receipt.correct, false);
  assert.equal(receipt.cause, 'f_receipt');
  assert.ok(out.filter((o) => !o.correct).every((o) => o.scene === 'S3'));
});

test('missing battery stops the press', () => {
  const out = run(bagOf({ ...M2_ALL2, battery_aa: 0 }));
  const bad = out.filter((o) => !o.correct);
  assert.ok(bad.length >= 1);
  assert.ok(bad.every((o) => o.scene === 'S4'));
  assert.ok(bad.some((o) => o.emergency && o.bin === 'can'));
});

test("fake causes only count in the item's own scene", () => {
  // 건전지 가짜 1장(캔) + 음료 캔을 '건전지'로 잘못 고친 1장 → S4만 오염(S1은 캔 이름표 1장뿐)
  const bag = bagOf(M2_ALL2).concat(fakesOf('f_battery', 1), [{ id: 'x', key: 'can_drink', label: 'battery' }]);
  const r = judge(m2, bag, cfg);
  assert.equal(r.scenes[0].pass, true);
  assert.equal(r.scenes[3].pass, false);
  for (const o of Conveyor.sort(m2, r)) if (o.scene === 'S1') assert.equal(o.correct, true, o.id);
  assert.equal(Conveyor.happened(r, 'f_battery'), true);
  assert.equal(Conveyor.happened(r, 'f_battery', 'S1'), false);
});

test('passing scene items are all correct (random bags)', () => {
  const rng = Rng.create(42);
  const keys = Object.keys(m2.cardTypes), labels = m2.labels.map((l) => l.id);
  for (let n = 0; n < 50; n++) {
    const bag = [];
    for (let i = 0; i < 30; i++) {
      if (rng.next() < 0.2) bag.push({ id: 'f' + i, fakeId: m2.fakes[Math.floor(rng.next() * m2.fakes.length)].id });
      else bag.push({ id: 'k' + i, key: keys[Math.floor(rng.next() * keys.length)] });
      if (rng.next() < 0.1) bag[bag.length - 1].label = labels[Math.floor(rng.next() * labels.length)];
    }
    const r = judge(m2, bag, cfg);
    const pass = new Set(r.scenes.filter((s) => s.pass).map((s) => s.id));
    for (const o of Conveyor.sort(m2, r)) {
      if (pass.has(o.scene)) assert.equal(o.correct, true, n + ' ' + o.id);
      if (!o.correct) assert.ok(o.cause, o.id);
    }
  }
});

// 리뷰 I1: 장면이 '위험'이면 그 장면에 비상 정지 물건이 있고, 위험이 아니면 없다(컨베이어와 장면 결과가 어긋나지 않게)
const consistent = (bag) => {
  const r = judge(m2, bag, cfg), out = Conveyor.sort(m2, r);
  for (const s of r.scenes) assert.equal(s.failKind === 'danger', out.some((o) => o.scene === s.id && o.emergency), s.id + ' ' + JSON.stringify(r.scenes.map((x) => x.failKind)));
  return { r, out };
};
test('danger scene <=> emergency item in that scene (targeted bags)', () => {
  // 건전지 가짜를 '일반쓰레기'로 잘못 고침 → S3 위험 → S3에서 비상 정지
  const { r, out } = consistent(bagOf(M2_ALL2).concat(fakesOf('f_battery', 2, { label: 'trash' })));
  assert.equal(r.scenes[2].failKind, 'danger');
  assert.ok(out.some((o) => o.scene === 'S3' && o.emergency));
  // 고양이 2장을 '캔'으로 → S1·S4 불편, 비상 정지 없음
  const c = consistent(bagOf(M2_ALL2).concat(fakesOf('f_cat', 2, { label: 'can' })));
  assert.equal(c.out.some((o) => o.emergency), false);
  consistent(bagOf(M2_ALL2).concat(fakesOf('f_battery', 2, { label: 'pet' })));
  consistent(bagOf({ ...M2_ALL2, battery_aa: 0 }));
  consistent(bagOf(M2_ALL2).concat(fakesOf('f_battery', 2)));
});
test('danger scene <=> emergency item in that scene (random bags)', () => {
  const rng = Rng.create(7);
  const keys = Object.keys(m2.cardTypes), labels = m2.labels.map((l) => l.id);
  for (let n = 0; n < 80; n++) {
    const bag = [];
    for (let i = 0; i < 30; i++) {
      if (rng.next() < 0.25) bag.push({ id: 'f' + i, fakeId: m2.fakes[Math.floor(rng.next() * m2.fakes.length)].id });
      else bag.push({ id: 'k' + i, key: keys[Math.floor(rng.next() * keys.length)] });
      if (rng.next() < 0.15) bag[bag.length - 1].label = labels[Math.floor(rng.next() * labels.length)];
    }
    consistent(bag);
  }
});
test('emergency line names the bin the battery went into', () => {
  assert.match(m2.story.emergency.text, /\{bin\}/);
});
