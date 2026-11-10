// 임무 뒤 활동(마지막 대화 → 챕터 끝 → 도시 복구 → 임무 완료 화면) 이어하기 — 리뷰 2026-11-10 ③
//   게임 결과 완료(records[임무].cleared + mission:null — 예전 그대로)와 뒤 활동 완료(save.ending이 없어짐)를 따로 남긴다.
//   save.ending = { mission, step(0 챕터 끝 앞 · 1~3 챕터 끝 단계 · 4 챕터 끝 뒤), city(아직 안 본 도시 복구 {from,to} | null), peer, compare(4 임무 비교 줄 | null) }
//   옛 저장(ending 없음)은 그대로 읽히고, 옛 코드는 ending을 모른 채 지나간다(mission:null이라 '다음 임무부터').
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Save = require('../js/save.js');
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const raw = (st) => JSON.parse(st.getItem(Save.KEY));

// 임무를 끝낸 직후(app.js finishMission과 같은 순서): 진행 지우기 → 기록 → 뒤 활동 시작
function finished(st, id, ending) {
  Save.checkpoint('result', { mission: id, bag: [{ id: 'c1', key: 'umbrella_open' }], supplements: 1 }, { tutorialDone: true }, st);
  Save.finish(st);
  Save.setRecord(id, { cleared: true, passed: true, firstTry: false, supplements: 1, firstFails: [] }, st);
  Save.setEnding(Object.assign({ mission: id, step: 0, city: { from: 0, to: 1 }, peer: 'none', compare: null }, ending || {}), st);
}

test('뒤 활동 저장·불러오기: 단계·도시 복구·4 임무 비교 줄', () => {
  const st = mem();
  assert.equal(Save.ending(st), null, 'nothing saved');
  finished(st, 'm1');
  assert.deepEqual(Save.ending(st), { mission: 'm1', step: 0, city: { from: 0, to: 1 }, peer: 'none', compare: null });
  assert.equal(Save.setEnding({ mission: 'm1', step: 2, city: { from: 0, to: 1 }, peer: 'none', compare: null }, st), true);
  assert.equal(Save.ending(st).step, 2);
  const cmp = { firstAllOk: false, rows: [{ id: 'gr4', kind: 'changed' }] };
  Save.setEnding({ mission: 'm4', step: 4, city: null, peer: 'joined', compare: cmp }, st);
  assert.deepEqual(Save.ending(st), { mission: 'm4', step: 4, city: null, peer: 'joined', compare: cmp });
});

test('게임 결과 완료는 예전 그대로: 진행 없음(mission null) + 기록 — 뒤 활동이 남아 있어도', () => {
  const st = mem();
  finished(st, 'm1');
  const s = Save.load(st);
  assert.equal(s.mission, null);
  assert.equal(s.screen, null);
  assert.deepEqual(s.bag, []);
  assert.equal(Save.records(st).m1.cleared, true);
  assert.equal(Save.nextMission(Save.records(st)), 'm2');
  assert.equal(Save.cityCount(Save.records(st)), 1);
  assert.equal(raw(st).mission, null, 'old code reading this save sees a finished mission');
});

test('뒤 활동 완료(endingDone): ending만 사라지고 기록·도시 칸은 그대로(완료 기록·도시 복구가 두 번 세어지지 않음)', () => {
  const st = mem();
  finished(st, 'm1');
  const before = JSON.stringify(Save.records(st));
  // 이어하기로 다시 들어와 단계를 여러 번 저장해도 기록은 그대로
  for (const step of [1, 2, 3, 4]) Save.setEnding({ mission: 'm1', step, city: step < 4 ? { from: 0, to: 1 } : null, peer: 'none', compare: null }, st);
  assert.equal(JSON.stringify(Save.records(st)), before);
  assert.equal(Save.cityCount(Save.records(st)), 1);
  assert.equal(Save.endingDone(st), true);
  assert.equal(Save.ending(st), null);
  assert.equal('ending' in raw(st), false, 'no key when absent (save shape unchanged)');
  assert.equal(JSON.stringify(Save.records(st)), before);
  assert.equal(raw(st).tutorialDone, true);
});

test('챕터 끝 답 저장(setRecord)·튜토리얼 표시는 뒤 활동을 지우지 않는다', () => {
  const st = mem();
  finished(st, 'm2', { step: 1 });
  Save.setRecord('m2', { cleared: true, chapter: { req: { first: 'refuse', last: 'refuse' }, concept: { first: null, last: null }, note: '' } }, st);
  Save.markTutorialDone(st);
  assert.equal(Save.ending(st).step, 1);
  assert.equal(Save.chapterOf(Save.records(st), 'm2').req.last, 'refuse');
});

test('다른 진행을 시작하면 뒤 활동은 버린다: 새 체크포인트 · 처음부터(clear) · 임무 끝(finish)', () => {
  let st = mem();
  finished(st, 'm1', { step: 2 });
  Save.checkpoint('briefing', { mission: 'm2', bag: [] }, {}, st);
  assert.equal(Save.ending(st), null, 'a new mission checkpoint drops it');
  assert.equal(Save.records(st).m1.cleared, true);
  st = mem(); finished(st, 'm1', { step: 2 });
  Save.clear(st);
  assert.equal(Save.ending(st), null);
  st = mem(); finished(st, 'm1', { step: 2 });
  Save.finish(st);
  assert.equal(Save.ending(st), null);
});

test('옛 저장(ending 없음)은 그대로: 끝낸 임무 → 다음 임무부터, 진행 중 → 그 화면', () => {
  const done = mem();
  done.setItem(Save.KEY, JSON.stringify({ v: 1, mission: null, tutorialDone: true, records: { tutorial: { cleared: true }, m1: { cleared: true, passed: true, firstTry: true, supplements: 0, firstFails: [] } }, cityV: 1 }));
  assert.equal(Save.ending(done), null);
  assert.equal(Save.load(done).mission, null);
  assert.equal(Save.nextMission(Save.records(done)), 'm2');
  assert.equal(Save.cityCount(Save.records(done)), 2);
  const mid = mem();
  mid.setItem(Save.KEY, JSON.stringify({ v: 1, mission: 'm2', screen: 'inspect', bag: [{ id: 'c1', key: 'can_drink' }], records: { m1: { cleared: true } } }));
  assert.equal(Save.ending(mid), null);
  assert.equal(Save.load(mid).screen, 'inspect');
  assert.equal(Save.setEnding({ mission: 'm1', step: 1, city: null, peer: 'none', compare: null }, mid), true);
  assert.equal(Save.load(mid).screen, 'inspect', 'the in-progress checkpoint itself is untouched');
});

test('깨진 값은 없는 것으로: 임무 이름·단계가 이상하면 null, 나머지 필드는 기본값', () => {
  const st = mem();
  const put = (ending) => st.setItem(Save.KEY, JSON.stringify({ v: 1, mission: null, records: {}, ending }));
  for (const bad of ['oops', 5, null, { step: 1 }, { mission: 3, step: 1 }, { mission: 'm1', step: 9 }, { mission: 'm1', step: -1 }, { mission: 'm1', step: 1.5 }, { mission: 'm1', step: '2' }]) {
    put(bad);
    assert.equal(Save.ending(st), null, JSON.stringify(bad));
  }
  put({ mission: 'm1', step: 3, city: 'x', peer: 7, compare: 'y' });
  assert.deepEqual(Save.ending(st), { mission: 'm1', step: 3, city: null, peer: 'none', compare: null });
  put({ mission: 'm1', step: 3, city: { from: 1, to: 'a' } });
  assert.equal(Save.ending(st).city, null);
  assert.equal(Save.setEnding({ mission: 'm1', step: 9 }, st), false, 'refuses to write a broken value');
});

test('저장소가 막혀 있으면 조용히 false(게임은 그대로)', () => {
  const kept = JSON.stringify({ v: 1, mission: null, records: { m1: { cleared: true } }, ending: { mission: 'm1', step: 2 } });
  const full = { getItem: () => kept, setItem: () => { throw new Error('quota'); } };
  assert.equal(Save.setEnding({ mission: 'm1', step: 1, city: null, peer: 'none', compare: null }, full), false);
  assert.equal(Save.endingDone(full), false);
  assert.equal(Save.setRecord('m1', { cleared: true }, full), false, '(리뷰 ⑥) the chapter note status reads this');
  assert.equal(Save.ending(null), null);
});
