// '처음부터'가 저장소에 닿지 못했을 때(리뷰 2026-11-12) — 옛 완료 기록이 새 진행에 섞이지 않는다
//   정상 초기화 / 용량 초과·접근 거부 중 초기화 / 저장이 다시 될 때 / 같은 탭에서 이어 하기 / 새로고침 뒤 / 튜토리얼 완료 유지
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SAVE_JS = process.env.DR_SAVE_JS || '../js/save.js'; // (고치기 전 파일로 같은 검사를 돌려 볼 때만 바꾼다)
const fresh = () => { delete require.cache[require.resolve(SAVE_JS)]; return require(SAVE_JS); }; // 새로고침 = 메모리가 비워진 새 모듈
const Save = fresh();
const KEY = 'ethicity.data.save';

// 고장 낼 수 있는 저장소: fail.set / fail.remove / fail.get 을 켜면 그 동작이 던진다
function store() {
  const m = new Map(), fail = { set: false, remove: false, get: false };
  const quota = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; return e; };
  return {
    fail, _m: m,
    getItem: (k) => { if (fail.get) throw new Error('SecurityError'); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (fail.set) throw quota(); m.set(k, String(v)); },
    removeItem: (k) => { if (fail.remove) throw new Error('SecurityError'); m.delete(k); }
  };
}
const raw = (st) => (st._m.has(KEY) ? JSON.parse(st._m.get(KEY)) : null);
// 튜토리얼을 끝내고 1 임무를 깬 뒤 2 임무 검수 중인 저장
function played(st) {
  Save.markTutorialDone(st);
  Save.setRecord('tutorial', { cleared: true }, st);
  Save.setRecord('m1', { cleared: true, firstTry: true, supplements: 0, firstFails: [] }, st);
  Save.checkpoint('inspect', { mission: 'm2', bag: [{ id: 'c1', key: 'can_drink' }], seed: 7 }, {}, st);
  Save.setEnding({ mission: 'm1', step: 2, city: null, peer: 'none', compare: null }, st);
  return st;
}
const newRun = { mission: 'tutorial', bag: [], supplements: 0, firstTry: null, seed: 1 };

test('정상 초기화: 진행·기록·뒤 활동이 지워지고 튜토리얼 완료만 남는다', () => {
  const st = played(store());
  assert.equal(Save.clear(st), true);
  assert.equal(Save.status(st), 'ok');
  assert.deepEqual(Save.records(st), {});
  assert.equal(Save.load(st).mission, null);
  assert.equal(Save.load(st).tutorialDone, true);
  assert.equal(Save.ending(st), null);
  assert.deepEqual(raw(st), { v: 1, mission: null, tutorialDone: true, cityV: 1 });
  Save.checkpoint('briefing', newRun, {}, st);
  assert.deepEqual(Save.records(st), {});
});

test('리뷰 재현: 쓰기가 막힌 채 초기화 → 쓰기가 풀림 → 새 체크포인트에 옛 1 임무 기록이 없다', () => {
  const st = played(store());
  st.fail.set = true;
  assert.equal(Save.clear(st), false);
  st.fail.set = false;
  assert.equal(Save.checkpoint('briefing', newRun, {}, st), true);
  assert.deepEqual(Save.records(st), {}, 'old m1 record must not come back');
  assert.deepEqual(raw(st).records, {});
  assert.equal(raw(st).mission, 'tutorial');
  assert.equal(raw(st).tutorialDone, true, 'tutorial-done rule kept');
  assert.equal(Save.status(st), 'ok');
});

test('쓰기만 막힘(지우기는 됨): 옛 기록을 지우고 unsaved — 저장소에 옛 기록이 남지 않는다', () => {
  const st = played(store());
  st.fail.set = true;
  assert.equal(Save.clear(st), false);
  assert.equal(Save.status(st), 'unsaved');
  assert.equal(raw(st), null, 'old record physically removed');
  // 같은 탭: 튜토리얼 완료는 메모리에 남아 있다
  assert.equal(Save.load(st).tutorialDone, true);
  assert.equal(Save.hasSave(st), true);
  assert.deepEqual(Save.records(st), {});
});

test('용량 초과(큰 저장만 안 들어감): 작은 초기화 저장은 그대로 써진다', () => {
  const st = played(store());
  const m = st._m, limit = 60;
  st.setItem = (k, v) => { if (String(v).length > limit) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } m.set(k, String(v)); };
  assert.equal(Save.clear(st), true);
  assert.equal(Save.status(st), 'ok');
  assert.deepEqual(raw(st), { v: 1, mission: null, tutorialDone: true, cityV: 1 });
});

test('쓰기가 자리 부족으로 막힘: 옛 기록을 지워 자리가 나면 초기화 저장이 써진다', () => {
  const st = played(store());
  const m = st._m;
  // 다른 값이 들어 있는 동안엔 못 쓴다(자리가 없음) — 지우면 쓸 수 있다
  st.setItem = (k, v) => { if (m.has(k)) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } m.set(k, String(v)); };
  assert.equal(Save.clear(st), true);
  assert.equal(Save.status(st), 'ok');
  assert.deepEqual(raw(st), { v: 1, mission: null, tutorialDone: true, cityV: 1 });
});

test('쓰기·지우기 모두 막힘(접근 거부): stale — 이 탭은 메모리의 저장본으로, 옛 기록은 다시 읽지 않는다', () => {
  const st = played(store());
  const before = st._m.get(KEY);
  st.fail.set = true; st.fail.remove = true;
  assert.equal(Save.clear(st), false);
  assert.equal(Save.status(st), 'stale');
  assert.equal(st._m.get(KEY), before, 'storage untouched — the old record is physically still there');
  // 같은 탭에서 보이는 것 = 초기화된 상태
  assert.deepEqual(Save.records(st), {});
  assert.equal(Save.load(st).mission, null);
  assert.equal(Save.load(st).tutorialDone, true);
  assert.equal(Save.ending(st), null);
  assert.equal(Save.nextMission(Save.records(st)), 'm1');

  // 막힌 채로 새 진행: 체크포인트·기록·튜토리얼 완료가 메모리의 저장본에 쌓인다(타이틀로 돌아와 '이어하기'를 눌러도 새 진행)
  assert.equal(Save.checkpoint('briefing', newRun, {}, st), false);
  assert.equal(Save.load(st).mission, 'tutorial');
  assert.equal(Save.load(st).screen, 'briefing');
  assert.equal(Save.markTutorialDone(st), false);
  assert.equal(Save.setRecord('tutorial', { cleared: true }, st), false);
  assert.equal(Save.finish(st), false);
  assert.equal(Save.checkpoint('inspect', { mission: 'm1', bag: [{ id: 'n1', key: 'umbrella_open' }], seed: 3 }, {}, st), false);
  assert.deepEqual(Save.records(st), { tutorial: { cleared: true } }, 'only this run’s records');
  assert.equal(Save.load(st).mission, 'm1');
  assert.deepEqual(Save.load(st).bag, [{ id: 'n1', key: 'umbrella_open' }]);
  assert.equal(st._m.get(KEY), before, 'still nothing reached storage');
  assert.equal(Save.status(st), 'stale');

  // 쓰기가 풀림: 다음 저장이 옛 기록을 통째로 바꾼다(합치지 않음)
  st.fail.set = false; st.fail.remove = false;
  assert.equal(Save.setRecord('m1', { cleared: true, firstTry: false, supplements: 1, firstFails: [] }, st), true);
  assert.equal(Save.status(st), 'ok');
  const now = raw(st);
  assert.deepEqual(Object.keys(now.records).sort(), ['m1', 'tutorial']);
  assert.equal(now.records.m1.firstTry, false, 'the new m1 record, not the old one');
  assert.equal(now.mission, 'm1');
  assert.equal(now.ending, undefined);
  assert.equal(now.tutorialDone, true);
  // 그 뒤엔 예전처럼 저장소가 기준
  st._m.set(KEY, JSON.stringify({ v: 1, cityV: 1, mission: null, tutorialDone: true, records: { m2: { cleared: true } } }));
  assert.deepEqual(Object.keys(Save.records(st)), ['m2']);
});

test('밀린 초기화 다시 쓰기(flush): 막혀 있으면 false, 풀리면 저장소의 옛 기록을 바꾼다', () => {
  const st = played(store());
  assert.equal(Save.flush(st), true, 'nothing pending');
  st.fail.set = true; st.fail.remove = true;
  Save.clear(st);
  assert.equal(Save.flush(st), false);
  assert.equal(Save.status(st), 'stale');
  assert.ok(raw(st).records.m1, 'still the old record in storage');
  st.fail.set = false;
  assert.equal(Save.flush(st), true);
  assert.equal(Save.status(st), 'ok');
  assert.deepEqual(raw(st), { v: 1, mission: null, tutorialDone: true, cityV: 1 });
});

test('새로고침: stale인 채로 나가면 옛 기록이 다시 보인다(화면이 그렇게 알린 대로) — 저장이 풀린 뒤라면 새 진행만', () => {
  // ① 끝내 저장이 안 된 채 새로고침
  const a = played(store());
  a.fail.set = true; a.fail.remove = true;
  Save.clear(a);
  Save.checkpoint('briefing', newRun, {}, a);
  const Reloaded = fresh();
  assert.equal(Reloaded.status(a), 'ok', 'a new page knows nothing about the lost reset');
  assert.ok(Reloaded.records(a).m1.cleared, 'the old record is what storage really holds');
  assert.equal(Reloaded.load(a).mission, 'm2');
  // ② 저장이 풀려 한 번이라도 써진 뒤 새로고침
  const b = played(store());
  b.fail.set = true; b.fail.remove = true;
  Save.clear(b);
  b.fail.set = false; b.fail.remove = false;
  Save.checkpoint('briefing', newRun, {}, b);
  const Reloaded2 = fresh();
  assert.deepEqual(Reloaded2.records(b), {});
  assert.equal(Reloaded2.load(b).mission, 'tutorial');
  assert.equal(Reloaded2.load(b).tutorialDone, true);
  // ③ unsaved(옛 기록은 지움)인 채 새로고침: 아무것도 없다 — 옛 기록도 없다
  const c = played(store());
  c.fail.set = true;
  Save.clear(c);
  const Reloaded3 = fresh();
  assert.equal(Reloaded3.load(c), null);
  assert.deepEqual(Reloaded3.records(c), {});
  assert.equal(Reloaded3.hasSave(c), false);
});

test('unsaved 뒤 저장이 풀리면 튜토리얼 완료까지 다시 저장된다', () => {
  const st = played(store());
  st.fail.set = true;
  Save.clear(st);
  assert.equal(raw(st), null);
  st.fail.set = false;
  assert.equal(Save.checkpoint('briefing', { mission: 'm1', bag: [], seed: 2 }, {}, st), true);
  assert.equal(raw(st).tutorialDone, true);
  assert.deepEqual(raw(st).records, {});
  assert.equal(Save.status(st), 'ok');
});

test('밀린 초기화 중에 한 번 더 초기화해도 튜토리얼 완료는 남고 기록은 비어 있다', () => {
  const st = played(store());
  st.fail.set = true; st.fail.remove = true;
  Save.clear(st);
  Save.setRecord('m1', { cleared: true }, st);
  assert.equal(Save.clear(st), false);
  assert.deepEqual(Save.records(st), {});
  assert.equal(Save.load(st).tutorialDone, true);
  st.fail.set = false;
  assert.equal(Save.clear(st), true);
  assert.deepEqual(raw(st), { v: 1, mission: null, tutorialDone: true, cityV: 1 });
});

test('읽기까지 막힘·저장소 없음: 던지지 않고 false, 읽을 옛 기록이 없으니 섞일 것도 없다', () => {
  const st = played(store());
  st.fail.get = true; st.fail.set = true; st.fail.remove = true;
  assert.equal(Save.clear(st), false);
  assert.deepEqual(Save.records(st), {});
  assert.equal(Save.status(st), 'stale', 'cannot confirm the old record is gone');
  assert.equal(Save.checkpoint('briefing', newRun, {}, st), false);
  st.fail.get = false; st.fail.set = false; st.fail.remove = false;
  assert.equal(Save.checkpoint('inspect', newRun, {}, st), true);
  assert.deepEqual(raw(st).records, {}, 'old record replaced once storage works again');
  // 저장소가 아예 없음
  assert.equal(Save.clear(null), false);
  assert.equal(Save.status(null), 'off');
  assert.equal(Save.flush(null), true);
  assert.deepEqual(Save.records(null), {});
});

test('초기화와 상관없는 쓰기 실패는 예전 그대로: 저장소에 있는 것이 기준', () => {
  const st = played(store());
  st.fail.set = true;
  assert.equal(Save.checkpoint('result', { mission: 'm2', bag: [], seed: 7 }, {}, st), false);
  assert.equal(Save.status(st), 'ok');
  assert.equal(Save.load(st).screen, 'inspect', 'the stored checkpoint');
  assert.ok(Save.records(st).m1.cleared);
});

test('저장소마다 따로: 한 저장소의 밀린 초기화가 다른 저장소에 닿지 않는다', () => {
  const a = played(store()), b = played(store());
  a.fail.set = true; a.fail.remove = true;
  Save.clear(a);
  assert.deepEqual(Save.records(a), {});
  assert.ok(Save.records(b).m1.cleared);
  assert.equal(Save.status(b), 'ok');
});
