// 4 임무 같은 답안지 전후 비교(교사 피드백 2026-11-09, DR.GradeCompare): 첫 판정의 채점 시연 결과 + 첫 가방을 남겨 두고,
// 임무 완료 때 마지막 판정과 같은 답안지끼리 견준다(답안 사진 · 처음 판정 · 내가 바꾼 자료 · 마지막 판정). 판정 규칙은 그대로.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
require('../js/josa.js');
const Cards = require('../js/cards.js');
const Judge = require('../js/judge.js');
require('../js/conveyor.js');
const Showdown = require('../js/showdown.js');
const GC = require('../js/grade-compare.js');
const m4 = require('../missions/m4.js');

const bagOf = (counts, pre = '') => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: pre + key + i, key })));
const MIN = { neat_data: 1, neat_algo: 1, neat_ai: 1, neat_ml: 1, cur_ai: 2, cur_algo: 2, alt_ai: 2, alt_data: 2, alt_ml: 2, scrawl_ml: 2 };
const snap = (bag) => GC.snapshot(m4, Judge.judge(m4, bag, cfg), bag);
const cmp = (first, bag) => GC.rows(m4, first, Judge.judge(m4, bag, cfg), bag, cfg);

test('judge.comboHave = 판정이 세는 개수(읽기 전용)', () => {
  const bag = bagOf({ ...MIN, cur_ai: 1 }).concat([{ id: 'f', fakeId: 'x_algo_ai' }, { id: 'q', ambiguousId: 'q_ai', assigned: 'ai' }]);
  assert.equal(Judge.comboHave(m4, bag, cfg, 'S2_cur_ai'), 1 + cfg.ambiguousWeight);
  assert.equal(Judge.comboHave(m4, bag, cfg, 'S1_neat'), 4);
  assert.equal(Judge.comboHave(m4, bag, cfg, 'nope'), 0);
});

test('snapshot: 답안지마다 처음 도장·맞았나·원인 + 실패 장면 + 첫 가방(최소 필드, JSON 그대로)', () => {
  const bag = bagOf({ ...MIN, cur_ai: 1 });
  bag[0].junk = 'x';
  const s = snap(bag);
  assert.equal(s.v, 1);
  assert.equal(s.sheets.length, m4.grading.length);
  const gr4 = s.sheets.find((x) => x.id === 'gr4');
  assert.deepEqual(gr4, { id: 'gr4', bin: 'x', correct: false, cause: 'S2_cur_ai' });
  assert.deepEqual(s.scenes.S2.missing, ['S2_cur_ai']);
  assert.equal(s.scenes.S1, undefined, 'passed scenes are not kept');
  assert.equal(s.bag.length, bag.length);
  assert.equal('junk' in s.bag[0], false);
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('모자란 조합을 채움: 흘려 쓴 인공지능 1장 → 2장, 처음 ✕(알고리즘으로 읽음) → 개선 후 ○, 비교용 1장', () => {
  const first = snap(bagOf({ ...MIN, cur_ai: 1 }));
  const fin = bagOf(MIN);
  const out = cmp(first, fin);
  assert.equal(out.firstAllOk, false);
  const changed = out.rows.filter((r) => r.kind === 'changed');
  assert.deepEqual(changed.map((r) => r.id), ['gr4']);
  const r = changed[0];
  assert.equal(r.art, 'cur_ai');
  assert.equal(r.wrote, '인공지능');
  assert.equal(r.before.text, '✕ 알고리즘으로 읽음');
  assert.equal(r.after.text, '○ 인공지능으로 읽음');
  assert.deepEqual(r.changes, ['흘려 쓴 인공지능 1장 → 2장']);
  const control = out.rows.filter((x) => x.kind === 'control');
  assert.equal(control.length, 1);
  assert.equal(control[0].before.text.startsWith('○'), true);
  assert.deepEqual(control[0].changes, ['바꿀 필요 없었음']);
  assert.ok(out.rows.length <= 4);
});

test('이름표가 틀린 카드를 고침·뺌: 무엇을 바꿨는지 장 수로', () => {
  const fakes = [{ id: 'f1', fakeId: 'x_neat_algo' }, { id: 'f2', fakeId: 'x_neat_algo' }];
  const first = snap(bagOf(MIN).concat(fakes));
  assert.equal(first.sheets.find((x) => x.id === 'gr9').correct, false);
  // 하나는 이름표를 알고리즘으로 고치고, 하나는 뺐다
  const fin = bagOf(MIN).concat([{ id: 'f1', fakeId: 'x_neat_algo', label: 'algo' }]);
  const out = cmp(first, fin);
  const gr9 = out.rows.find((r) => r.id === 'gr9');
  assert.equal(gr9.kind, 'changed');
  assert.equal(gr9.before.text, '✕ 인공지능으로 읽음');
  assert.deepEqual(gr9.changes, ["'인공지능' 이름표가 붙은 또박또박 쓴 알고리즘 2장 → 이름표 고침 1장 · 뺌 1장"]);
  // 같은 장면이 오염돼 사람 채점으로 넘겼던 반듯한 답안지(gr1)도 같은 까닭
  const gr1 = out.rows.find((r) => r.id === 'gr1');
  assert.ok(gr1, 'gr1 also changed');
  assert.equal(gr1.before.text, '사람 채점 · 못 읽음');
  assert.match(gr1.changes[0], /또박또박 쓴 알고리즘 2장 → 이름표 고침 1장 · 뺌 1장/);
});

test('동기 카드로 채움: 아주 흘려 쓴 머신러닝 0장 → 2장(동기 카드 2장)', () => {
  const bag0 = bagOf({ ...MIN, scrawl_ml: 0 });
  const first = snap(bag0);
  const fin = bag0.concat(Showdown.peerCards(m4, bag0, false));
  const out = cmp(first, fin);
  const gr11 = out.rows.find((r) => r.id === 'gr11');
  assert.equal(gr11.kind, 'changed');
  assert.equal(gr11.before.text, '✕ 인공지능으로 읽음');
  assert.equal(gr11.after.text, '○ 머신러닝으로 읽음');
  assert.deepEqual(gr11.changes, ['아주 흘려 쓴 머신러닝 0장 → 2장(동기 카드 2장)']);
});

test('처음부터 다 맞음 → firstAllOk, 표 줄 없음', () => {
  const out = cmp(snap(bagOf(MIN)), bagOf(MIN));
  assert.equal(out.firstAllOk, true);
  assert.deepEqual(out.rows, []);
});

test('줄 수 ≤ 4: 바뀐 답안지 최대 3장(채점 순서) + 비교용 1장, 아직 틀린 답안지는 still', () => {
  const bad = { ...MIN, cur_ai: 0, cur_algo: 0, scrawl_ml: 0, alt_data: 0, alt_ai: 0 };
  const first = snap(bagOf(bad));
  const out = cmp(first, bagOf({ ...MIN, alt_ai: 0 }));
  assert.ok(out.rows.length <= 4);
  const kinds = out.rows.map((r) => r.kind);
  assert.deepEqual(kinds.filter((k) => k === 'changed').length, 3);
  assert.equal(kinds[kinds.length - 1], 'control');
  const order = m4.grading.map((g) => g.id);
  const ch = out.rows.filter((r) => r.kind === 'changed').map((r) => order.indexOf(r.id));
  assert.deepEqual(ch, ch.slice().sort((a, b) => a - b));
  // 개선 후에도 틀린 답안지만 남으면 still로(바뀐 게 없을 때 보이게)
  const out2 = cmp(snap(bagOf({ ...MIN, alt_ai: 0 })), bagOf({ ...MIN, alt_ai: 0 }));
  assert.ok(out2.rows.some((r) => r.kind === 'still'));
  assert.equal(out2.rows.find((r) => r.kind === 'still').after.text, '사람 채점 · 못 읽음');
});

// 리뷰 2026-11-10 ④: 고치다가 필요한 자료를 빼면 맞던 답안지가 틀리게 된다 — 그 답안지도 표에 나와야 한다(전엔 개선·아직 틀림만 골랐다)
const NO_NEAT = { neat_data: 0, neat_algo: 0, neat_ai: 0, neat_ml: 0 };
test('새로 틀린 답안지(worse): 아주 흘려 쓴 답은 채웠지만 또박또박 쓴 답안을 다 뺌 → gr1·gr14가 맞음 → 틀림으로 표에 나온다', () => {
  const first = snap(bagOf({ ...MIN, scrawl_ml: 0 }));
  const fin = bagOf({ ...MIN, scrawl_ml: 2, ...NO_NEAT });
  assert.equal(Judge.judge(m4, fin, cfg).allPass, false, 'the last judgment still fails');
  const out = cmp(first, fin);
  assert.deepEqual(out.rows.map((r) => r.id + ':' + r.kind), ['gr11:changed', 'gr1:worse', 'gr14:worse', 'gr4:control']);
  const gr1 = out.rows.find((r) => r.id === 'gr1');
  assert.equal(gr1.before.correct, true);
  assert.equal(gr1.before.text, '○ 인공지능으로 읽음');
  assert.equal(gr1.after.correct, false);
  assert.equal(gr1.after.text, '사람 채점 · 못 읽음');
  assert.deepEqual(gr1.changes, ['또박또박 쓴 답안 4장 → 0장'], 'the removed material is the cause line');
  assert.deepEqual(out.rows.find((r) => r.id === 'gr14').changes, ['또박또박 쓴 답안 4장 → 0장']);
  assert.equal(out.firstAllOk, false);
});

test('개선과 악화가 함께: 어느 쪽도 숨기지 않는다(바뀐 3장 자리 안에 새로 틀린 답안지 최소 1장), 줄 수 ≤ 4', () => {
  const first = snap(bagOf({ ...MIN, cur_ai: 0, cur_algo: 0, scrawl_ml: 0, alt_data: 0 }));
  const fin = bagOf({ ...MIN, ...NO_NEAT });
  const out = cmp(first, fin);
  const kinds = out.rows.map((r) => r.kind);
  assert.ok(out.rows.length <= 4, kinds.join(','));
  assert.equal(kinds.filter((k) => k === 'changed').length, 2, kinds.join(','));
  assert.equal(kinds.filter((k) => k === 'worse').length, 1, kinds.join(','));
  // 새로 틀린 답안지만 여럿이면 3장까지
  const out2 = cmp(snap(bagOf({ ...MIN, alt_ai: 0 })), bagOf({ ...MIN, alt_ai: 0, ...NO_NEAT, cur_ai: 0 }));
  const k2 = out2.rows.map((r) => r.kind);
  assert.equal(k2.filter((k) => k === 'worse').length, 3, k2.join(','));
  assert.equal(k2.includes('still'), false, 'worse rows take the limited rows before still ones');
});

test('새로 틀린 답안지: 이름표가 틀린 카드를 나중에 넣어 오염 → 그 카드가 원인 줄에', () => {
  const first = snap(bagOf({ ...MIN, scrawl_ml: 0 }));
  const fin = bagOf(MIN).concat([{ id: 'f1', fakeId: 'x_neat_algo' }, { id: 'f2', fakeId: 'x_neat_algo' }]);
  const out = cmp(first, fin);
  const gr9 = out.rows.find((r) => r.id === 'gr9');
  assert.ok(gr9, out.rows.map((r) => r.id + ':' + r.kind).join(','));
  assert.equal(gr9.kind, 'worse');
  assert.equal(gr9.after.text, '✕ 인공지능으로 읽음');
  assert.deepEqual(gr9.changes, ["'인공지능' 이름표가 붙은 또박또박 쓴 알고리즘 0장 → 2장"]);
});

test('처음엔 채점 시연을 다 맞았어도 마지막에 새로 틀린 답안지가 있으면 줄이 나온다(처음부터 끝까지 다 맞으면 예전처럼 빈 줄)', () => {
  const out = cmp(snap(bagOf(MIN)), bagOf({ ...MIN, ...NO_NEAT }));
  assert.equal(out.firstAllOk, true);
  assert.ok(out.rows.some((r) => r.kind === 'worse'));
  assert.deepEqual(cmp(snap(bagOf(MIN)), bagOf(MIN)), { firstAllOk: true, rows: [] });
});

test('옛 저장(첫 판정 기록 없음) → null', () => {
  assert.equal(GC.rows(m4, null, Judge.judge(m4, bagOf(MIN), cfg), bagOf(MIN), cfg), null);
  assert.equal(GC.rows(m4, { v: 99 }, Judge.judge(m4, bagOf(MIN), cfg), bagOf(MIN), cfg), null);
});

test('정말 틀린 답(gr3)의 ✕는 맞는 채점 문구', () => {
  const s = snap(bagOf(MIN));
  assert.equal(GC.verdictText(m4, m4.grading.find((g) => g.id === 'gr3'), s.sheets.find((x) => x.id === 'gr3')), '✕ 정말 틀린 답');
});
