// 규칙 기반 판정 — 기획서 §5·§7.5와 spec §5.4의 설계 확인 사례
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const m1 = require('../missions/legacy-flood.js');
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

test('tutorial: 8 dogs 2 cats fails, 5 and 5 passes', () => {
  assert.equal(judge(tutorial, bagOf({ dog: 8, cat: 2 }), cfg).allPass, false);
  assert.equal(judge(tutorial, bagOf({ dog: 5, cat: 5 }), cfg).allPass, true);
  assert.equal(judge(tutorial, bagOf({ dog: 5, cat: 4 }), cfg).allPass, false);
});

test('missingLines follows scene order', () => {
  const r = judge(m1, bagOf({ day_deep: 2, day_shallow: 2 }), cfg);
  assert.equal(missingLines(m1, r)[0], '우리가 넣은 데이터에는 물에 젖었을 뿐인 낮 도로가 없었다.');
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

// [1] 결과에서 이름이 나온 가짜(오염 원인)가 아직 가방에 있으면, 개수와 상관없이 그 장면은 통과하지 않는다
{
  const { contaminationLine, contaminationLines } = require('../js/judge.js');
  const fk = (id, n = 1, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: id + i, fakeId: id, ...extra }));
  test('first submit keeps fakeLimit 2', () => {
    const r = judge(m1, bagOf(ALL2).concat(fk('f_fountain')), cfg, { named: [] });
    assert.equal(r.allPass, true);
    assert.deepEqual(r.scenes[0].lingering, []);
  });
  test('a named fake left in the bag keeps its scene failing, with a "still there" line', () => {
    const first = judge(m1, bagOf(ALL2).concat(fk('f_pool'), fk('f_fountain')), cfg);
    assert.deepEqual(first.scenes[0].contaminated, ['f_pool', 'f_fountain']);
    const named = first.scenes.flatMap((s) => s.contaminated);
    const again = judge(m1, bagOf(ALL2).concat(fk('f_fountain')), cfg, { named });
    assert.equal(again.scenes[0].pass, false);
    assert.equal(again.scenes[0].failKind, 'inconvenience');
    assert.deepEqual(again.scenes[0].lingering, ['f_fountain']);
    assert.deepEqual(again.scenes[0].contaminated, ['f_fountain']);
    assert.ok(again.scenes.slice(1).every((s) => s.pass));
    assert.equal(contaminationLine(m1, 'f_fountain', true), '우리가 넣은 데이터에 분수 광장 사진이 아직 남아 있다.');
    assert.deepEqual(contaminationLines(m1, again), ['우리가 넣은 데이터에 분수 광장 사진이 아직 남아 있다.']);
    assert.equal(judge(m1, bagOf(ALL2), cfg, { named }).allPass, true, 'both removed → pass');
  });
  test('named player-made mislabel and hazard: still there keeps danger', () => {
    const m2 = require('../missions/m2.js');
    const M2 = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };
    const r = judge(m2, bagOf(M2).concat(fk('f_battery')), cfg, { named: ['f_battery'] });
    assert.deepEqual(r.scenes.map((s) => s.failKind), ['danger', null, null, 'danger']);
    const mis = [{ id: 'x', key: 'can_drink', label: 'paper' }];
    const r2 = judge(m2, bagOf(M2).concat(mis), cfg, { named: ['mis:can_drink:paper'] });
    assert.equal(r2.scenes[2].pass, false);
    assert.equal(contaminationLine(m2, 'mis:can_drink:paper', true), "우리가 넣은 데이터에 음료 캔 사진이 아직 '종이' 이름표로 남아 있다.");
    assert.equal(judge(m2, bagOf(M2).concat([{ id: 'x', key: 'can_drink' }]), cfg, { named: ['mis:can_drink:paper'] }).allPass, true, 'fixed → pass');
  });
}

// [2] 빠진 조합 문구: 가진 개수가 0이면 "…없었다", 0보다 크고 모자라면 "…부족했다"(두 임무·튜토리얼 모든 조합)
{
  const { missingLine, fixedNotes } = require('../js/judge.js');
  const m2 = require('../missions/m2.js');
  const M2 = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };
  test('missingLine: 0 → 없었다, some → 부족했다, with the right 이/가', () => {
    for (const m of [m1, m2, tutorial]) for (const s of m.scenes) for (const c of s.combos) {
      assert.match(missingLine(m, c.id, 0), /^우리가 넣은 데이터에는 .+[이가] 없었다\.$/, c.id);
      assert.match(missingLine(m, c.id, 1), /^우리가 넣은 데이터에는 .+[이가] 부족했다\.$/, c.id);
    }
    assert.equal(missingLine(m2, 'S4_battery_aa', 0), '우리가 넣은 데이터에는 건전지가 없었다.');
    assert.equal(missingLine(m2, 'S1_can_tin', 1), '우리가 넣은 데이터에는 통조림 캔이 부족했다.');
    assert.equal(missingLine(m1, 'S4_night_muddy', 1), '우리가 넣은 데이터에는 흙탕물에 얕게 잠긴 밤 도로가 부족했다.');
  });
  test('missingLines uses the counts the judge saw', () => {
    const r0 = judge(m2, bagOf({ ...M2, battery_aa: 0 }), cfg);
    assert.deepEqual(missingLines(m2, r0), ['우리가 넣은 데이터에는 건전지가 없었다.']);
    const r1 = judge(m2, bagOf({ ...M2, battery_aa: 1 }), cfg);
    assert.deepEqual(missingLines(m2, r1), ['우리가 넣은 데이터에는 건전지가 부족했다.']);
  });
  test('fixedNotes: a label fixed right but too few → the cause is the count, not the label', () => {
    const bag = bagOf({ ...M2, battery_aa: 0 }).concat([{ id: 'fb', fakeId: 'f_battery', label: 'battery' }]);
    const r = judge(m2, bag, cfg);
    assert.equal(r.scenes[3].failKind, 'danger');
    assert.deepEqual(fixedNotes(m2, bag, r), { S4: ['이름표는 맞게 고쳤지만, 건전지 사진이 1장뿐이라 AI가 건전지를 배우지 못했다.'] });
    assert.deepEqual(fixedNotes(m2, bagOf({ ...M2, battery_aa: 1 }), judge(m2, bagOf({ ...M2, battery_aa: 1 }), cfg)), {}, 'no fixed card → no note');
    const tin = bagOf({ ...M2, can_tin: 0 }).concat([{ id: 't', key: 'can_tin', label: 'trash' }].map((c) => ({ ...c, label: 'can' })));
    assert.deepEqual(fixedNotes(m2, tin, judge(m2, tin, cfg)), {}, 'untouched (label equals original) is not a fix');
  });
}

// 사소한 문제 7: 튜토리얼 합격 기준은 기획서 §6 그대로 — "판정(초기값): 개와 고양이 사진이 각각 3장 이상",
// 귀여운 실패는 "한쪽만 잔뜩 모으면". 가방 10칸을 다 채우거나 개·고양이 수를 똑같이 맞출 필요는 없다(의도)
test('tutorial pass rule is each ≥5 in the 10-card bag', () => {
  assert.equal(judge(tutorial, bagOf({ dog: 7, cat: 3 }), cfg).allPass, false, '7:3 fails');
  assert.equal(judge(tutorial, bagOf({ dog: 3, cat: 3 }), cfg).allPass, false, '3:3 fails');
  assert.equal(judge(tutorial, bagOf({ dog: 5, cat: 5 }), cfg).allPass, true, '5:5 passes');
  assert.equal(judge(tutorial, bagOf({ dog: 10 }), cfg).allPass, false, 'one side only fails');
});
