// 2026-11-06 첫 시험(사진·이름표 분리)과 새 1 임무(분실물 센터): 코스·판정·컨베이어
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
require('../js/rng.js');
const C = require('../js/cards.js');
const Judge = require('../js/judge.js');
const Conveyor = require('../js/conveyor.js');
const Stream = require('../js/stream.js');
const tut = require('../missions/tutorial.js');
const m1 = require('../missions/m1.js');

const cards = (c) => c.items.filter((i) => i.kind === 'card');
const dog = (id) => ({ id: 'c' + id, key: 'dog' }), cat = (id) => ({ id: 'c' + id, key: 'cat' });
const bag5 = () => [1, 2, 3, 4, 5].map(dog).concat([6, 7, 8, 9, 10].map(cat));

test('첫 시험 코스: 개 8·고양이 8 그대로, 이름표 틀린 카드 2장은 코스 뒤쪽 절반', () => {
  for (const seed of [7, 1, 2, 42, 999]) {
    const c = Stream.build(tut, cfg, { seed }), all = cards(c), fakes = all.filter((i) => i.fakeId);
    assert.equal(all.length, 16);
    assert.deepEqual(fakes.map((f) => f.fakeId).sort(), ['f_cat_as_dog', 'f_dog_as_cat']);
    assert.equal(all.filter((i) => C.truthKey(tut, i) === 'dog').length, 8);
    assert.equal(all.filter((i) => C.truthKey(tut, i) === 'cat').length, 8);
    fakes.forEach((f) => assert.ok(f.z >= c.length * 0.5, 'late ' + f.z));
  }
});

test('이름표 틀린 카드: 이름표는 반대, 사진은 그대로, 고치면 맞음', () => {
  const f = { id: 'c1', fakeId: 'f_dog_as_cat' };
  assert.equal(C.cardLabel(tut, f), '고양이');
  assert.equal(C.truthKey(tut, f), 'dog');
  assert.equal(C.isMislabeled(tut, f), true);
  f.label = 'dog';
  assert.equal(C.isMislabeled(tut, f), false);
  assert.equal(C.cardLabel(tut, f), '개');
});

test('시험 판정: 사진 기준으로 세고, 이름표를 바꿔도 사진 수는 그대로', () => {
  assert.equal(Judge.exam(tut, bag5()).pass, true);
  // 개 사진을 고양이라고 붙이면: 수는 맞지만 이름표 오류
  const wrong = bag5(); wrong[0].label = 'cat';
  let r = Judge.exam(tut, wrong);
  assert.equal(r.pass, false); assert.deepEqual(r.short, []); assert.equal(r.wrong.length, 1); assert.equal(r.have.dog, 5);
  // 고양이 이름표가 붙은 개 사진은 고양이 수에 안 들어간다
  const six = [1, 2, 3, 4, 5, 6].map(dog).concat([7, 8, 9, 10].map(cat)); six[5].label = 'cat';
  r = Judge.exam(tut, six);
  assert.deepEqual(r.short, [{ key: 'cat', n: 1 }]); assert.equal(r.wrong.length, 1);
  // 빈 가방
  r = Judge.exam(tut, []);
  assert.equal(r.empty, true); assert.equal(r.short.length, 2);
  // 이름표 틀린 카드를 고쳐서 내면 합격
  const fixed = bag5(); fixed[0] = { id: 'c1', fakeId: 'f_dog_as_cat', label: 'dog' };
  assert.equal(Judge.exam(tut, fixed).pass, true);
});

const six = (except = {}) => {
  const bag = []; let n = 1;
  Object.keys(m1.cardTypes).forEach((k) => { const c = except[k] === undefined ? 3 : except[k]; for (let i = 0; i < c; i++) bag.push({ id: 'c' + n++, key: k }); });
  return bag;
};

test('분실물 코스: 카드 수·구역 3개·드문 모습은 흔한 모습보다 뒤에도 있음·같은 시드 같은 코스', () => {
  const total = Object.values(m1.counts).reduce((a, b) => a + b, 0);
  for (const seed of [1101, 1, 2, 42, 999]) {
    const c = Stream.build(m1, cfg, { seed });
    assert.equal(cards(c).length, total);
    assert.equal(c.zones.length, 3);
    assert.deepEqual(Stream.build(m1, cfg, { seed }), c);
    c.zones.forEach((z) => { const inZ = cards(c).filter((i) => i.z >= z.start && i.z < z.end).sort((a, b) => a.z - b.z); assert.ok(inZ.slice(0, 2).every((i) => !m1.cardTypes[i.key].rare), '구역 앞은 흔한 모습 ' + seed + z.id); assert.ok(inZ.filter((i) => m1.cardTypes[i.key].rare).length >= 4, '드문 모습은 놓쳐도 또 나온다'); });
  }
  assert.ok(Object.values(m1.counts).reduce((a, b) => a + b, 0) >= m1.bag, '가방보다 카드가 많다');
});

test('이름표는 두 모습 모두 같은 종류, 사진은 다름', () => {
  assert.equal(C.cardLabel(m1, { key: 'umbrella_open' }), '우산');
  assert.equal(C.cardLabel(m1, { key: 'umbrella_folded' }), '우산');
  assert.equal(C.cardLabel(m1, { key: 'phone_back' }), '스마트폰');
  Object.values(m1.cardTypes).forEach((t) => assert.ok(fs.existsSync(new URL(`../assets/cards/lost-found/${t.art.photo}.webp`, import.meta.url)), t.art.photo));
});

test('여섯 모습 충족 → 전부 통과, 모두 제 칸', () => {
  const r = Judge.judge(m1, six(), cfg);
  assert.equal(r.allPass, true);
  Conveyor.sort(m1, r).forEach((it) => { assert.equal(it.correct, true, it.id); assert.notEqual(it.bin, 'hold'); });
});

test('접힌 우산만 부족 → 접힌 우산만 분류 보류, 펼친 우산은 우산 칸(모습별 독립)', () => {
  const r = Judge.judge(m1, six({ umbrella_folded: 1, umbrella_open: 9 }), cfg);
  assert.equal(r.allPass, false);
  const s1 = r.scenes.find((s) => s.id === 'S1');
  assert.deepEqual(s1.missing, ['S1_folded']); assert.equal(s1.failKind, 'inconvenience');
  assert.equal(r.scenes.find((s) => s.id === 'S2').pass, true);
  const sorted = Conveyor.sort(m1, r);
  sorted.filter((it) => it.art === 'umbrella_folded').forEach((it) => assert.equal(it.bin, 'hold'));
  sorted.filter((it) => it.art !== 'umbrella_folded').forEach((it) => assert.equal(it.correct, true, it.id));
  assert.equal(sorted.some((it) => it.emergency), false, '비상 정지 없음');
});

test('보충 코스: 모자란 모습이 나온다', () => {
  const c = Stream.build(m1, cfg, { seed: 1102, focusCounts: { umbrella_folded: 2 } });
  assert.ok(cards(c).filter((i) => i.key === 'umbrella_folded').length >= 2);
});

test('가짜·"?" 카드 없음(이번 임무의 난점은 빠진 모습 하나), 침수 흔적 없음', () => {
  assert.equal((m1.fakes || []).length, 0); assert.equal(m1.ambiguous.length, 0);
  assert.doesNotMatch(JSON.stringify(m1), /침수|도로|비 오는/);
});
