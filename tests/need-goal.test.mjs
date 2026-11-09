// 보충 달리기 누적 목표(교사 피드백 2026-11-09, DR.NeedGoal): 출발할 때 판정으로 모자란 조합이 먼저,
// 개수는 가방 + 동기 카드 + 이번에 잡은 카드를 '붙은 이름표 기준'(검수 화면과 같은 규칙)으로 센다. 판정 규칙은 그대로.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const Cards = require('../js/cards.js');
const Judge = require('../js/judge.js');
const Showdown = require('../js/showdown.js');
const NeedGoal = require('../js/need-goal.js');
const m1 = require('../missions/m1.js'), m2 = require('../missions/m2.js'), m3 = require('../missions/m3.js'), m4 = require('../missions/m4.js');

const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const MIN = { neat_data: 1, neat_algo: 1, neat_ai: 1, neat_ml: 1, cur_ai: 2, cur_algo: 2, alt_ai: 2, alt_data: 2, alt_ml: 2, scrawl_ml: 2 };
const row = (p, name) => p.rows.find((r) => r.name === name);

test('4 임무: 모자란 조합(흘려 쓴 인공지능 1/2)이 맨 앞, 찬 조합은 뒤에 done', () => {
  const bag = bagOf({ ...MIN, cur_ai: 1 });
  const p = NeedGoal.plan(m4, bag, [], cfg);
  assert.equal(p.rows[0].name, '흘려 쓴 인공지능');
  assert.equal(p.rows[0].short, true);
  assert.equal(p.rows.filter((r) => r.short).length, 1);
  const s = NeedGoal.status(m4, p, []);
  assert.equal(s.rows[0].have, 1);
  assert.equal(s.rows[0].need, 2);
  assert.equal(s.rows[0].done, false);
  assert.equal(s.rows[0].text, '흘려 쓴 인공지능 1/2장');
  // 달리며 흘려 쓴 인공지능을 하나 잡으면 2/2장 ✓
  const s2 = NeedGoal.status(m4, p, [{ uid: 'c9', key: 'cur_ai' }]);
  assert.equal(s2.rows[0].have, 2);
  assert.equal(s2.rows[0].done, true);
  assert.equal(s2.rows[0].text, '흘려 쓴 인공지능 2/2장 ✓');
  assert.equal(s2.allDone, true);
});

test('같은 종류 묶음은 한 줄(또박또박 S1 4장·S3 2장 → 필요 4장, 띄어 쓴 머신 러닝 S3·S4 → 한 줄)', () => {
  const p = NeedGoal.plan(m4, bagOf(MIN), [], cfg);
  const neat = p.rows.filter((r) => r.name === '또박또박 쓴 답안');
  assert.equal(neat.length, 1);
  assert.equal(neat[0].need, 4);
  assert.equal(p.rows.filter((r) => r.name === "띄어 쓴 '머신 러닝'").length, 1);
  assert.ok(p.rows.every((r) => !r.short), 'minimum bag passes');
  // 모든 조합이 한 번씩은 줄에 있다(키 묶음 기준)
  const keySets = new Set(m4.scenes.flatMap((s) => s.combos).map((c) => c.keys.slice().sort().join('+')));
  assert.equal(p.rows.length, keySets.size);
});

test('모자란 줄 순서 = 구역 순서, 다 찬 줄은 그 뒤', () => {
  const bag = bagOf({ ...MIN, scrawl_ml: 0, cur_algo: 0, neat_data: 0 });
  const p = NeedGoal.plan(m4, bag, [], cfg);
  const shortNames = p.rows.filter((r) => r.short).map((r) => r.name);
  assert.deepEqual(shortNames, ['또박또박 쓴 답안', '흘려 쓴 알고리즘', '아주 흘려 쓴 머신러닝']);
  const firstDone = p.rows.findIndex((r) => !r.short);
  assert.ok(p.rows.slice(firstDone).every((r) => !r.short));
});

test('동기 카드(예약 4장)는 누적에 들어가고, 그것으로 찬 줄은 peerFilled', () => {
  const bag = bagOf({ ...MIN, scrawl_ml: 0 });
  const extra = Showdown.peerCards(m4, bag, false);
  assert.equal(extra.length, 4);
  const p = NeedGoal.plan(m4, bag, extra, cfg);
  assert.equal(p.peer, 4);
  const r = row(p, '아주 흘려 쓴 머신러닝');
  assert.equal(r.short, false);
  assert.equal(r.peerFilled, true);
  assert.equal(NeedGoal.status(m4, p, []).rows.find((x) => x.name === '아주 흘려 쓴 머신러닝').have, 2);
  assert.equal(NeedGoal.plan(m4, bag, [], cfg).peer, 0);
});

test('가짜의 정체를 드러내지 않는다: 잡은 가짜는 검수 화면과 같은 줄(붙은 이름표의 보통 종류)로 센다', () => {
  const bag = bagOf({ ...MIN, cur_ai: 1 });
  const p = NeedGoal.plan(m4, bag, [], cfg);
  // 흘려 쓴 알고리즘인데 '인공지능' 이름표 → 화면 규칙으로는 또박또박 인공지능(검수 화면과 같은 셈)
  const fake = { uid: 'c20', fakeId: 'x_algo_ai' };
  const s = NeedGoal.status(m4, p, [fake]);
  const counts = Cards.labelCounts(m4, bag.concat([fake]));
  for (const r of s.rows) assert.equal(r.have, r.keys.reduce((n, k) => n + (counts[k] || 0), 0), r.name);
  // 셈은 플레이어 눈에 보이는 것만: 진짜 종류(truthKey)로 세지 않는다
  assert.equal(s.rows.find((x) => x.name === '흘려 쓴 인공지능').have, 1);
});

test('달리며 잡은 "?" 카드는 세지 않고 따로(검수에서 정하기)', () => {
  const p = NeedGoal.plan(m4, bagOf({ ...MIN, cur_ai: 1 }), [], cfg);
  const s = NeedGoal.status(m4, p, [{ uid: 'c3', ambiguousId: 'q_ai' }, { uid: 'c4', ambiguousId: 'q_algo' }]);
  assert.equal(s.unknown, 2);
  assert.equal(s.rows[0].have, 1);
});

test('판정에서 모자란데 화면 개수로는 찬 줄(이름표가 틀린 카드가 끼어 있음) = lookAgain, ✓ 아님', () => {
  // 반듯한 답 진짜는 1장뿐인데, 이름표가 틀린 카드 3장이 화면 규칙으로 또박또박 줄에 세어진다
  const bag = bagOf({ ...MIN, neat_ai: 0, neat_data: 0, neat_algo: 0 }).concat([{ id: 'f1', fakeId: 'x_neat_algo' }, { id: 'f2', fakeId: 'x_neat_data' }, { id: 'f3', fakeId: 'x_algo_ai' }]);
  const r = Judge.judge(m4, bag, cfg);
  assert.ok(r.scenes.find((s) => s.id === 'S1').missing.includes('S1_neat'));
  const p = NeedGoal.plan(m4, bag, [], cfg);
  const st = NeedGoal.status(m4, p, []).rows.find((x) => x.name === '또박또박 쓴 답안');
  assert.equal(st.have, 4);
  assert.equal(st.lookAgain, true);
  assert.equal(st.done, false);
  assert.doesNotMatch(st.text, /✓/);
});

test('잃은 카드(벽)는 grabbed에서 빠지므로 개수도 내려간다(함수는 받은 목록만 센다)', () => {
  const p = NeedGoal.plan(m4, bagOf({ ...MIN, cur_ai: 0 }), [], cfg);
  assert.equal(NeedGoal.status(m4, p, [{ uid: 'a', key: 'cur_ai' }]).rows[0].have, 1);
  assert.equal(NeedGoal.status(m4, p, []).rows[0].have, 0);
});

test('1~3 임무에도 같은 모양(1 임무는 결과 뒤라 모습 이름)', () => {
  for (const m of [m1, m2, m3]) {
    const p = NeedGoal.plan(m, [], [], cfg);
    assert.ok(p.rows.length > 0, m.id);
    assert.ok(p.rows.every((r) => r.short), m.id + ' empty bag: all short');
    assert.ok(p.rows.every((r) => typeof r.name === 'string' && r.name.length), m.id);
    const s = NeedGoal.status(m, p, []);
    assert.ok(s.rows.every((r) => /^.+ 0\/\d+장$/.test(r.text)), m.id);
  }
  // 1 임무: 모습 이름(접힌 우산 …) — hideShapes는 첫 결과 전까지만 숨긴다(보충은 늘 결과 뒤)
  const names = NeedGoal.plan(m1, [], [], cfg).rows.map((r) => r.name);
  assert.ok(names.includes(m1.cardTypes[m1.scenes[0].combos[0].keys[0]].name));
});

test('판정 규칙은 그대로(plan은 가방을 바꾸지 않는다)', () => {
  const bag = bagOf({ ...MIN, cur_ai: 1 });
  const copy = JSON.stringify(bag);
  NeedGoal.status(m4, NeedGoal.plan(m4, bag, [], cfg), [{ uid: 'x', key: 'cur_ai' }]);
  assert.equal(JSON.stringify(bag), copy);
});
