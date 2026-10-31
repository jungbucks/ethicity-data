// 규칙 기반 판정 — 기획서 §5·§7.5와 spec §5.4의 설계 확인 사례
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const m1 = require('../missions/m1.js');
const tutorial = require('../missions/tutorial.js');
const { judge, missingLines } = require('../js/judge.js');

const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };
const q = (id, assigned) => ({ id, ambiguousId: id, assigned });

test('common cards only: S1 passes, S2-S4 fail', () => {
  const r = judge(m1, bagOf({ day_deep: 15, day_shallow: 15 }), cfg);
  assert.deepEqual(r.scenes.map((s) => s.pass), [true, false, false, false]);
});

test('normal-only bag still fails S4 as danger', () => {
  const s4 = judge(m1, bagOf({ day_wet: 6, day_dry: 6, night_wet: 6, night_neon: 3 }), cfg).scenes[3];
  assert.equal(s4.pass, false);
  assert.equal(s4.failKind, 'danger');
});

test('equal per type without boundary cards fails S3 and S4', () => {
  const r = judge(m1, bagOf({ day_deep: 3, day_shallow: 3, day_wet: 3, day_dry: 3, night_wet: 3, night_deep: 3, night_shallow: 3 }), cfg);
  assert.deepEqual(r.scenes.map((s) => s.pass), [true, true, false, false]);
  assert.deepEqual(r.scenes[2].missing, ['S3_night_neon']);
});

test('ordinary boundary cards fill boundary combos (user choice 나)', () => {
  assert.equal(judge(m1, bagOf(ALL2), cfg).allPass, true);
});

test('correct ambiguous card counts double', () => {
  const b = bagOf({ ...ALL2, night_muddy: 0 }).concat([q('q_muddy', 'flood_shallow')]);
  assert.equal(judge(m1, b, cfg).allPass, true);
});

test('mislabeled ambiguous fills nothing and is reported', () => {
  const r = judge(m1, bagOf({ ...ALL2, night_neon: 0 }).concat([q('q_neon', 'flood_deep')]), cfg);
  assert.equal(r.scenes[2].pass, false);
  assert.deepEqual(r.mislabeled, ['q_neon']);
});

test('excluded or undecided ambiguous is ignored', () => {
  for (const a of [null, undefined]) assert.deepEqual(judge(m1, bagOf({ day_deep: 2 }).concat([q('q_clean', a)]), cfg).mislabeled, []);
});

test('q_clean labelled wet fills S2_day_wet', () => {
  assert.equal(judge(m1, bagOf({ day_dry: 2 }).concat([q('q_clean', 'wet')]), cfg).scenes[1].pass, true);
});

test('flood missing beats normal missing for failKind', () => {
  assert.equal(judge(m1, bagOf({ night_wet: 2 }), cfg).scenes[3].failKind, 'danger');
});

test('only normal combos missing gives inconvenience', () => {
  assert.equal(judge(m1, bagOf({ night_deep: 2 }), cfg).scenes[2].failKind, 'inconvenience');
});

test('passing scene has no failKind', () => {
  const s1 = judge(m1, bagOf({ day_deep: 2, day_shallow: 2 }), cfg).scenes[0];
  assert.equal(s1.pass, true);
  assert.equal(s1.failKind, null);
  assert.deepEqual(s1.missing, []);
});

test('empty bag: all fail, no throw', () => {
  const r = judge(m1, [], cfg);
  assert.equal(r.allPass, false);
  assert.equal(r.scenes.length, 4);
});

test('tutorial: 8 dogs 2 cats fails, 3 and 3 passes', () => {
  assert.equal(judge(tutorial, bagOf({ dog: 8, cat: 2 }), cfg).allPass, false);
  assert.equal(judge(tutorial, bagOf({ dog: 3, cat: 3 }), cfg).allPass, true);
});

test('missingLines follows scene order', () => {
  const r = judge(m1, bagOf({ day_deep: 2, day_shallow: 2 }), cfg);
  assert.equal(missingLines(m1, r)[0], m1.scenes[1].combos[0].missingLine);
});

test('missingLines does not repeat a shared line', () => {
  const lines = missingLines(m1, judge(m1, [], cfg));
  assert.equal(lines.length, new Set(lines).size);
});

test('shortfall lists missing cards per key (shared key takes the larger need)', () => {
  const { shortfall } = require('../js/judge.js');
  assert.deepEqual(shortfall(m1, bagOf({ day_deep: 15, day_shallow: 15 }), cfg),
    { day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 });
  assert.deepEqual(shortfall(m1, bagOf({ ...ALL2, night_shallow: 1, night_muddy: 0 }), cfg), { night_shallow: 1, night_muddy: 2 });
  assert.deepEqual(shortfall(m1, bagOf(ALL2), cfg), {});
});

// 가짜 카드(spec §3.3) — Task 3 전이라 m1에 가짜를 테스트 안에서 덮어 쓴다
const { contaminationLines } = require('../js/judge.js');
const m1F = { ...m1, fakes: [
  { id: 'f_pool', label: 'day_deep', truth: null, count: 2, line: 'POOL' },
  { id: 'f_fountain', label: 'day_shallow', truth: null, count: 2, line: 'FOUNTAIN' },
  { id: 'f_fridge', label: 'night_wet', truth: null, count: 2, line: 'FRIDGE' }
] };
const fk = (id, n) => Array.from({ length: n }, (_, i) => ({ id: id + i, fakeId: id }));

test('one fake is harmless', () => {
  const r = judge(m1F, bagOf(ALL2).concat(fk('f_pool', 1)), cfg);
  assert.equal(r.allPass, true);
  assert.deepEqual(r.scenes[0].contaminated, []);
});

test('two fakes contaminate the scene of their label', () => {
  const s1 = judge(m1F, bagOf(ALL2).concat(fk('f_pool', 2)), cfg).scenes[0];
  assert.equal(s1.pass, false);
  assert.equal(s1.failKind, 'inconvenience');
  assert.deepEqual(s1.contaminated, ['f_pool']);
  assert.deepEqual(s1.missing, []);
});

test('fakes of different kinds add up per scene', () => {
  const s1 = judge(m1F, bagOf(ALL2).concat(fk('f_pool', 1), fk('f_fountain', 1)), cfg).scenes[0];
  assert.equal(s1.pass, false);
  assert.deepEqual(s1.contaminated, ['f_pool', 'f_fountain']);
});

test('fridge contaminates S3 and S4', () => {
  const r = judge(m1F, bagOf(ALL2).concat(fk('f_fridge', 2)), cfg);
  assert.deepEqual(r.scenes.map((s) => s.pass), [true, true, false, false]);
});

test('fakes fill no combo', () => {
  const s1 = judge(m1F, bagOf({ ...ALL2, day_deep: 0 }).concat(fk('f_pool', 2)), cfg).scenes[0];
  assert.ok(s1.missing.includes('S1_day_deep'));
});

test('hazard fake is danger in every scene of its label', () => {
  const mB = {
    labels: [{ id: 'can', text: '캔' }, { id: 'battery', text: '건전지' }],
    cardTypes: { can_drink: { label: 'can', name: '음료 캔' }, can_tin: { label: 'can', name: '통조림 캔' }, battery_aa: { label: 'battery', name: '건전지', hazard: true } },
    fakes: [{ id: 'f_battery', label: 'can', truth: 'battery_aa', count: 3, line: 'BAT' }],
    scenes: [
      { id: 'S1', combos: [{ id: 'S1_c', keys: ['can_drink'], need: 2, danger: false }, { id: 'S1_t', keys: ['can_tin'], need: 2, danger: false }] },
      { id: 'S4', combos: [{ id: 'S4_b', keys: ['battery_aa'], need: 2, danger: true }, { id: 'S4_c', keys: ['can_drink'], need: 2, danger: false }] }
    ]
  };
  const bag = bagOf({ can_drink: 2, can_tin: 2, battery_aa: 2 }).concat(fk('f_battery', 2));
  const r = judge(mB, bag, cfg);
  assert.deepEqual(r.scenes.map((s) => s.failKind), ['danger', 'danger']);
  assert.deepEqual(contaminationLines(mB, r), ['BAT']);
  const fixed = bagOf({ can_drink: 2, can_tin: 2 }).concat(fk('f_battery', 2).map((c) => ({ ...c, label: 'battery' })));
  assert.equal(judge(mB, fixed, cfg).allPass, true);
  const mis = judge(mB, bagOf({ can_drink: 4, can_tin: 2, battery_aa: 2 }).map((c, i) => (i < 2 ? { ...c, label: 'battery' } : c)), cfg);
  assert.deepEqual(contaminationLines(mB, mis), ["우리가 넣은 데이터에 음료 캔 사진이 '건전지'로 들어갔다."]);
});

test('ambiguous mislabel is still not a fake', () => {
  const r = judge(m1F, bagOf({ ...ALL2, night_neon: 0 }).concat([q('q_neon', 'flood_deep')]), cfg);
  assert.deepEqual(r.mislabeled, ['q_neon']);
  assert.deepEqual(r.scenes[2].contaminated, []);
});

test('contaminationLines in scene order without repeats', () => {
  const r = judge(m1F, bagOf(ALL2).concat(fk('f_fridge', 2), fk('f_pool', 2)), cfg);
  assert.deepEqual(contaminationLines(m1F, r), ['POOL', 'FRIDGE']);
});

test('shortfall ignores fakes', () => {
  const { shortfall } = require('../js/judge.js');
  assert.deepEqual(shortfall(m1F, bagOf({ ...ALL2, day_deep: 0 }).concat(fk('f_pool', 2)), cfg), { day_deep: 2 });
});

// P1: 실패 문구가 장면의 정답과 맞도록 — 조합별 결과(fail) 확장
test('S3: 밤 깊은 침수만 빠지면 불편, 조합 문구', () => {
  const r = judge(m1, bagOf({ ...ALL2, night_deep: 0 }), cfg);
  assert.equal(r.scenes[2].failKind, 'inconvenience');
  assert.match(r.scenes[2].failLine, /네온 반사를 깊은 물로 착각해 교차로를 막았다/);
  assert.equal(r.scenes[1].pass && r.scenes[3].pass, true); // 다른 장면은 그대로
});
test('fail 확장이 없는 조합은 failLine 없음(장면 문구 사용)', () => {
  const r = judge(m1, bagOf({ ...ALL2, day_deep: 0 }), cfg);
  assert.equal(r.scenes[0].failKind, 'danger');
  assert.equal(r.scenes[0].failLine, null);
});
test('S4: 젖은 밤 도로만 빠지면 불편, 침수 길은 막았다는 문구(장면 정답과 일치)', () => {
  const r = judge(m1, bagOf({ ...ALL2, night_wet: 0, night_neon: 4 }), cfg);
  assert.equal(r.scenes[3].failKind, 'inconvenience');
  assert.match(r.scenes[3].failLine, /얕게 잠긴 길은 막았지만/);
});
test('장면 문구가 장면 정답과 모순되지 않음', () => {
  const byId = Object.fromEntries(m1.scenes.map((s) => [s.id, s]));
  assert.doesNotMatch(byId.S2.cuts.danger, /세웠다/);       // S2 정답 = 젖었을 뿐(통과)
  assert.doesNotMatch(byId.S3.cuts.danger, /안전/);        // S3 정답 = 젖었을 뿐
  assert.doesNotMatch(byId.S4.cuts.inconvenience, /젖었을 뿐인/); // S4 정답 = 얕은 침수(막기)
});
