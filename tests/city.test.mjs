// 도시 복구 화면(설계 2026-11-01 §7): 흑백 도시 5칸(튜토리얼 + 1~4 임무), 깬 직후에만, 4 임무는 늘 5/5
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Save = require('../js/save.js');
const tut = require('../missions/tutorial.js'), m1 = require('../missions/legacy-flood.js'), m2 = require('../missions/m2.js'), m3 = require('../missions/m3.js'), m4 = require('../missions/m4.js');
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const C = { cleared: true };

test('cityCount = tutorial + cleared missions (order does not matter), 0..5', () => {
  assert.equal(Save.cityCount({}), 0);
  assert.equal(Save.cityCount({ tutorial: C }), 1, 'tutorial only');
  assert.equal(Save.cityCount({ m3: C }), 1, 'skipped ahead with the mission picker');
  assert.equal(Save.cityCount({ tutorial: C, m1: C, m2: C, m3: C, m4: C }), 5);
  assert.equal(Save.cityCount({ tutorial: C, m1: C, m2: C, m3: C, m4: C, m9: C }), 5, 'never above 5');
  assert.equal(Save.cityCount({ m2: { cleared: false } }), 0);
});

test('old saves (before the city screen) keep the tutorial cell once; later saves never guess', () => {
  const st = mem();
  st.setItem(Save.KEY, JSON.stringify({ v: 1, mission: null, tutorialDone: true, records: { m1: C } }));
  assert.equal(Save.cityCount(Save.records(st)), 2, 'tutorial + m1');
  Save.setRecord('m2', C, st);
  assert.equal(Save.cityCount(Save.records(st)), 3, 'migration stays after the next write');
  // 새 저장: 튜토리얼 기록이 없으면 튜토리얼은 세지 않는다
  const st2 = mem();
  Save.markTutorialDone(st2);
  Save.setRecord('m1', C, st2);
  assert.equal(Save.cityCount(Save.records(st2)), 1);
});

test('"처음부터" (clear) brings the city back to 0, even with the tutorial done', () => {
  const st = mem();
  Save.markTutorialDone(st);
  Save.setRecord('tutorial', C, st);
  Save.setRecord('m1', C, st);
  assert.equal(Save.cityCount(Save.records(st)), 2);
  Save.clear(st);
  assert.equal(Save.cityCount(Save.records(st)), 0);
  assert.equal(Save.load(st).tutorialDone, true, 'skip-tutorial option stays');
  // 리뷰 I1: '처음부터' 뒤 튜토리얼을 건너뛰고 1 임무만 깨면 1칸(2칸이 아니다)
  Save.setRecord('m1', C, st);
  assert.equal(Save.cityCount(Save.records(st)), 1);
});

test('every stage has a city line naming its AI (no numbers, no %)', () => {
  assert.equal(tut.cityLine, '데이터 러너가 처음 길을 냈다');
  assert.equal(m1.cityLine, '침수 판별 AI가 다시 이어졌다');
  assert.equal(m2.cityLine, '분리배출 분류 AI가 다시 이어졌다');
  assert.equal(m3.cityLine, '길 안내 AI가 다시 이어졌다');
  assert.equal(m4.cityLine, '채점 AI까지, 도시가 다시 이어졌다');
  for (const m of [tut, m1, m2, m3, m4]) assert.ok(!/\d|%/.test(m.cityLine));
});

test('city step: show only when the count grew; mission 4 always shows 5/5', () => {
  assert.deepEqual(Save.cityStep('m1', 0, 1), { from: 0, to: 1 });
  assert.equal(Save.cityStep('m1', 2, 2), null, 'replaying a cleared mission skips the screen');
  assert.deepEqual(Save.cityStep('m4', 2, 3), { from: 2, to: 5 }, 'reconnect is the story end');
  assert.deepEqual(Save.cityStep('m4', 4, 4), { from: 4, to: 5 });
  assert.deepEqual(Save.cityStep('m4', 5, 5), { from: 4, to: 5 }, 'replaying m4 still shows the last cell lighting up');
});
