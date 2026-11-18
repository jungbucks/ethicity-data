// 첫 튜토리얼 합격 직후 새로고침(리뷰 2026-11-18 #5) — 합격 대화·도시 복구·1 임무 도입 어디서 새로고침해도 튜토리얼을 다시 시키지 않는다.
//   원래 결함: 합격 기록(tutorialDone·records.tutorial)은 합격 순간에 쓰는데, 저장의 진행은 1 임무 브리핑 체크포인트 전까지
//   '튜토리얼 · 브리핑'으로 남아 → 타이틀 [이어하기]가 끝낸 튜토리얼 브리핑으로 돌려보냈다.
//   고침: 합격을 확정할 때 다음 재개 지점(진행 비움 → '첫 번째 임무부터 이어하기')을 함께 쓴다(DR.Save.passTutorial).
//   연습으로 다시 한 튜토리얼은 저장된 본 이야기 진행을 덮어쓰지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { boot, store, titleOffer, KEY } from './app-flow-helper.mjs';
const require = createRequire(import.meta.url);
const Save = require('../js/save.js');

/* ---------- 저장 API ---------- */
test('passTutorial: 튜토리얼 체크포인트 → 진행 비움 + 완료 + 기록 (다음 = 첫 번째 임무)', () => {
  const st = store();
  Save.checkpoint('briefing', { mission: 'tutorial', bag: [], seed: 3 }, {}, st);
  assert.equal(Save.passTutorial(st), true);
  const s = Save.load(st);
  assert.equal(s.mission, null, '튜토리얼 브리핑 체크포인트가 남으면 이어하기가 튜토리얼로 돌아간다');
  assert.equal(s.tutorialDone, true);
  assert.deepEqual(Save.records(st).tutorial, { cleared: true });
  assert.equal(Save.hasSave(st), true);
  assert.equal(Save.nextMission(Save.records(st)), 'm1');
});

test('passTutorial: 다른 임무 진행(연습으로 다시 함)·기록·뒤 활동은 그대로', () => {
  const st = store();
  Save.markTutorialDone(st);
  Save.setRecord('m1', { cleared: true, firstTry: true, supplements: 0, firstFails: [] }, st);
  Save.checkpoint('inspect', { mission: 'm2', bag: [{ id: 'c1', key: 'can_drink' }], supplements: 1, seed: 7 }, {}, st);
  Save.setEnding({ mission: 'm1', step: 2, city: null, peer: 'none', compare: null }, st);
  const before = JSON.parse(st._m.get(KEY));
  assert.equal(Save.passTutorial(st), true);
  const after = JSON.parse(st._m.get(KEY));
  const s = Save.load(st);
  assert.equal(s.mission, 'm2'); assert.equal(s.screen, 'inspect'); assert.equal(s.supplements, 1); assert.equal(s.seed, 7);
  assert.deepEqual(s.bag, [{ id: 'c1', key: 'can_drink' }]);
  assert.deepEqual(Save.records(st).m1, before.records.m1);
  assert.deepEqual(Save.records(st).tutorial, { cleared: true });
  assert.deepEqual(after.ending, before.ending);
});

test('passTutorial: 저장이 없을 때도 완료·기록만 쓴다(진행 없음)', () => {
  const st = store();
  assert.equal(Save.passTutorial(st), true);
  assert.equal(Save.load(st).mission, null);
  assert.equal(Save.load(st).tutorialDone, true);
  assert.deepEqual(Save.records(st), { tutorial: { cleared: true } });
});

/* ---------- 실제 흐름(app.js) ---------- */
// 첫 튜토리얼을 합격 대화 앞까지: 오프닝 → 브리핑 → 실기 안내 → 달리기 → 검수 → 시연 [다음]
function toPassDialogue(g) {
  g.ui.briefing[1]();          // 브리핑 [출발]
  g.ui.tutorialGoal[1]();      // 실기 미션 안내 → 달리기(가짜: 바로 끝)
  g.ui.examInspect[3]();       // 검수 [제출]
  g.ui.examDemo[3].onNext();   // 시연 → 합격
}

test('첫 합격: 합격 대화·도시 복구·1 임무 도입 중 새로고침해도 튜토리얼로 돌아가지 않는다', () => {
  const st = store();
  const g = boot(st);
  g.App.startTutorial();
  assert.equal(titleOffer(g.Save), 'resume:tutorial:briefing', '튜토리얼 도중(합격 전)엔 튜토리얼 브리핑부터 이어 하는 것이 맞다');
  toPassDialogue(g);
  // ① 합격 대화 중
  assert.ok(g.ui.dialogue, '합격 대화');
  assert.equal(titleOffer(boot(st).Save), 'next:m1', '합격 대화 중 새로고침');
  g.ui.dialogue[1]();
  // ② 도시 복구(0 → 1칸) 중
  assert.deepEqual([g.ui.city[0].from, g.ui.city[0].to], [0, 1]);
  assert.equal(titleOffer(boot(st).Save), 'next:m1', '도시 복구 중 새로고침');
  g.ui.dialogue = null;
  g.ui.city[1]();
  // ③ 1 임무 도입 대화 중
  assert.equal(g.App.state.mission, 'm1');
  assert.ok(g.ui.dialogue, '1 임무 도입');
  assert.equal(titleOffer(boot(st).Save), 'next:m1', '1 임무 도입 중 새로고침');
  // 새로고침 뒤 고른 길 = 1 임무 도입부터(튜토리얼 아님), 튜토리얼 완료·도시 1칸 유지
  const r = boot(st);
  assert.equal(r.Save.load().tutorialDone, true);
  assert.equal(r.App.cityCount(), 1);
  // 도입이 끝나면 예전처럼 1 임무 브리핑 체크포인트
  g.ui.dialogue[1]();
  assert.equal(titleOffer(boot(st).Save), 'resume:m1:briefing');
});

test('연습으로 다시 합격: 저장된 본 이야기 진행(2 임무 검수)은 덮어쓰지 않는다', () => {
  const st = store();
  Save.markTutorialDone(st);
  Save.setRecord('tutorial', { cleared: true }, st);
  Save.setRecord('m1', { cleared: true, firstTry: true, supplements: 0, firstFails: [] }, st);
  Save.checkpoint('inspect', { mission: 'm2', bag: [{ id: 'c1', key: 'can_drink' }], seed: 7 }, {}, st);
  const before = st._m.get(KEY);
  const g = boot(st);
  g.App.practiceTutorial();
  toPassDialogue(g);
  assert.equal(titleOffer(boot(st).Save), 'resume:m2:inspect', '연습 합격 대화 중 새로고침');
  g.ui.dialogue[1]();
  assert.equal(g.ui.city, undefined, '이미 센 튜토리얼 칸은 다시 안 뜬다');
  assert.equal(g.App.screen, 'title', '연습 끝 = 타이틀');
  const a = JSON.parse(st._m.get(KEY)), b = JSON.parse(before);
  for (const k of ['mission', 'screen', 'bag', 'seed', 'supplements', 'records', 'tutorialDone']) assert.deepEqual(a[k], b[k], k);
});
