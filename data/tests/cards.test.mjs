// 카드의 진짜 종류·붙은 이름표(spec §3.2) — 1 임무형(이름표 = key)과 2 임무형(labels)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../js/cards.js');

const mA = {
  cardTypes: { day_deep: { icons: ['day', 'flood_deep'] }, night_wet: { icons: ['night', 'wet'] } },
  ambiguous: [{ id: 'q1', truthKey: 'night_wet', correctLabel: 'wet', icons: ['night', 'unknown'] }],
  labelOptions: [{ id: 'wet', text: '정상(젖음)' }],
  fakes: [{ id: 'f_pool', label: 'day_deep', truth: null, count: 2, line: 'L' }],
  scenes: [
    { id: 'S1', combos: [{ id: 'a', keys: ['day_deep'], need: 2 }] },
    { id: 'S3', combos: [{ id: 'b', keys: ['night_wet'], need: 2 }] },
    { id: 'S4', combos: [{ id: 'c', keys: ['night_wet'], need: 2 }] }
  ]
};
const mB = {
  labels: [{ id: 'can', text: '캔' }, { id: 'battery', text: '건전지' }, { id: 'trash', text: '일반쓰레기' }],
  cardTypes: {
    can_drink: { label: 'can', name: '음료 캔' }, can_tin: { label: 'can', name: '통조림 캔' },
    battery_aa: { label: 'battery', name: '건전지', hazard: true }, trash_misc: { label: 'trash', name: '일반쓰레기' }
  },
  fakes: [{ id: 'f_battery', label: 'can', truth: 'battery_aa', count: 3 }, { id: 'f_cat', label: 'trash', truth: null, count: 2 }],
  scenes: [
    { id: 'S1', combos: [{ id: 'x', keys: ['can_drink'], need: 2 }, { id: 'y', keys: ['can_tin'], need: 2 }] },
    { id: 'S3', combos: [{ id: 'z', keys: ['trash_misc'], need: 2 }] },
    { id: 'S4', combos: [{ id: 'w', keys: ['battery_aa'], need: 2 }, { id: 'v', keys: ['can_drink'], need: 2 }] }
  ]
};

test('currentLabel: own label, fake label, relabel wins', () => {
  assert.equal(C.currentLabel(mA, { key: 'day_deep' }), 'day_deep');
  assert.equal(C.currentLabel(mB, { key: 'can_tin' }), 'can');
  assert.equal(C.currentLabel(mA, { fakeId: 'f_pool' }), 'day_deep');
  assert.equal(C.currentLabel(mB, { key: 'can_tin', label: 'trash' }), 'trash');
  assert.equal(C.currentLabel(mA, { ambiguousId: 'q1', assigned: 'wet' }), null);
});

test('truthKey', () => {
  assert.equal(C.truthKey(mB, { key: 'can_drink' }), 'can_drink');
  assert.equal(C.truthKey(mB, { fakeId: 'f_battery' }), 'battery_aa');
  assert.equal(C.truthKey(mA, { fakeId: 'f_pool' }), null);
  assert.equal(C.truthKey(mA, { ambiguousId: 'q1' }), null);
});

test('isMislabeled', () => {
  assert.equal(C.isMislabeled(mB, { key: 'can_drink' }), false);
  assert.equal(C.isMislabeled(mB, { fakeId: 'f_battery' }), true);
  assert.equal(C.isMislabeled(mB, { fakeId: 'f_battery', label: 'battery' }), false);
  for (const label of ['can', 'battery', 'trash']) assert.equal(C.isMislabeled(mB, { fakeId: 'f_cat', label }), true);
  assert.equal(C.isMislabeled(mB, { key: 'can_drink', label: 'trash' }), true);
  assert.equal(C.isMislabeled(mB, { key: 'can_drink', label: 'can' }), false);
  assert.equal(C.isMislabeled(mA, { ambiguousId: 'q1', assigned: 'dry' }), false);
});

test('scenesForLabel covers every card type under the label', () => {
  assert.deepEqual(C.scenesForLabel(mB, 'can'), ['S1', 'S4']);
  assert.deepEqual(C.scenesForLabel(mA, 'night_wet'), ['S3', 'S4']);
  assert.deepEqual(C.scenesForLabel(mA, 'nope'), []);
});

test('harm: hazard truth is danger, else inconvenience', () => {
  assert.equal(C.harm(mB, { fakeId: 'f_battery' }), 'danger');
  assert.equal(C.harm(mB, { fakeId: 'f_cat' }), 'inconvenience');
  assert.equal(C.harm(mA, { fakeId: 'f_pool' }), 'inconvenience');
});

test('sourceId', () => {
  assert.equal(C.sourceId(mB, { fakeId: 'f_cat', label: 'can' }), 'f_cat');
  assert.equal(C.sourceId(mB, { key: 'can_drink', label: 'trash' }), 'mis:can_drink:trash');
});

test('iconsOf: label icon, card-type icons, ambiguous rule', () => {
  assert.deepEqual(C.iconsOf(mB, { key: 'can_tin', label: 'trash' }), ['trash']);
  assert.deepEqual(C.iconsOf(mA, { fakeId: 'f_pool' }), ['day', 'flood_deep']);
  assert.deepEqual(C.iconsOf(mA, { ambiguousId: 'q1' }), ['night', 'unknown']);
  assert.deepEqual(C.iconsOf(mA, { ambiguousId: 'q1', assigned: 'wet' }), ['night', 'wet']);
});

test('artId and labelText', () => {
  assert.equal(C.artId({ fakeId: 'f_pool' }), 'f_pool');
  assert.equal(C.artId({ ambiguousId: 'q1' }), 'q1');
  assert.equal(C.labelText(mB, 'battery'), '건전지');
  assert.equal(C.labelText(mA, 'wet'), '정상(젖음)');
});

// 카드 라벨·개수(P2·P3) — 언제나 "카드에 붙은 설명표" 기준
const m1 = require('../missions/m1.js');
const tut = require('../missions/tutorial.js');
test('cardLabel: 시간 · 설명표, 드문 종류는 덧말', () => {
  assert.equal(C.cardLabel(m1, { key: 'night_wet' }), '밤 · 정상(젖음)');
  assert.equal(C.cardLabel(m1, { key: 'day_deep' }), '낮 · 침수(깊음)');
  assert.equal(C.cardLabel(m1, { key: 'night_neon' }), '밤 · 정상(젖음) · 네온 반사');
  assert.equal(C.cardLabel(tut, { key: 'dog' }), '강아지');
});
test('cardLabel: 가짜는 붙은 설명표 그대로(정체를 드러내지 않음)', () => {
  assert.equal(C.cardLabel(m1, { fakeId: 'f_pool' }), '낮 · 침수(깊음)');
  assert.equal(C.cardLabel(m1, { fakeId: 'f_fridge' }), '밤 · 정상(젖음)');
});
test('cardLabel: "?" 카드는 붙인 설명표만, 정답 여부를 드러내지 않음', () => {
  assert.equal(C.cardLabel(m1, { ambiguousId: 'q_neon' }), '밤 · ?');
  assert.equal(C.cardLabel(m1, { ambiguousId: 'q_neon', assigned: 'wet' }), '밤 · 정상(젖음)');
  assert.equal(C.cardLabel(m1, { ambiguousId: 'q_muddy', assigned: 'wet' }), '밤 · 정상(젖음)');
  assert.equal(C.cardLabel(m1, { ambiguousId: 'q_neon', assigned: null }), '밤 · ? (넣지 않기)');
});
test('displayKey·labelCounts: 붙은 설명표 기준, "?"는 붙인 설명표의 보통 종류로 1장', () => {
  assert.equal(C.displayKey(m1, { fakeId: 'f_pool' }), 'day_deep');
  assert.equal(C.displayKey(m1, { ambiguousId: 'q_neon', assigned: 'wet' }), 'night_wet');
  assert.equal(C.displayKey(m1, { ambiguousId: 'q_neon', assigned: undefined }), null);
  const bag = [{ key: 'night_wet' }, { fakeId: 'f_fridge' }, { ambiguousId: 'q_neon', assigned: 'wet' }, { key: 'night_neon' }, { ambiguousId: 'q_muddy', assigned: null }];
  assert.deepEqual(C.labelCounts(m1, bag), { night_wet: 3, night_neon: 1 });
  assert.equal(C.keyLabel(m1, 'night_muddy'), '밤 · 침수(얕음) · 흙탕물');
});
