// WebGL이 꺼진 컴퓨터(리뷰 2026-11-18 #6) — 3D 렌더러를 못 만들면 달리기 화면에서 멈추지 않고, 안내 + 브리핑으로 돌아가기. 저장된 진행은 그대로.
//   원래 결함: js/run3d.js start가 new THREE.WebGLRenderer에서 오류를 던져, 화면은 이미 달리기로 바뀐 채 캔버스 없이 0/0과 조작 아이콘만 남았다.
//   ① run3d: 렌더러 생성이 던지면 start = false, 달리기 상태 없음(stop·peek 안전), 컨테이너에 아무것도 안 붙임
//   ② app.js: Run.start가 false면 DR.UI.no3d(돌아가기) — 튜토리얼·임무 첫 달리기 = 브리핑, 보충 달리기 = 보충 준비. 저장은 바뀌지 않는다
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { boot, store, root, KEY } from './app-flow-helper.mjs';

/* ---------- ① run3d.start ---------- */
function bootRun3d(Renderer) {
  const ctx = { console, Math, JSON, Date, location: { search: '' }, devicePixelRatio: 1, document: { getElementById: () => null, querySelector: () => null } };
  ctx.window = ctx;
  ctx.THREE = { WebGLRenderer: Renderer };
  vm.createContext(ctx);
  for (const f of ['js/config.js', 'js/rng.js', 'missions/tutorial.js', 'js/cards.js', 'js/privacy.js', 'js/glitch.js', 'js/stream.js', 'js/catch.js', 'js/input.js', 'js/run3d.js'])
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  return ctx.DR;
}

test('run3d: WebGL 렌더러 생성이 던지면 start = false, 달리기 상태 없음', () => {
  const DR = bootRun3d(function () { throw new Error('Error creating WebGL context.'); });
  const m = DR.Missions.tutorial;
  const course = DR.Stream.build(m, DR.config, { seed: m.seed });
  const appended = [];
  const container = { appendChild: (c) => appended.push(c), addEventListener() {}, removeEventListener() {} };
  const errs = [], orig = console.error;
  console.error = (...a) => errs.push(a.join(' '));
  let ok;
  try { ok = DR.Run.start(container, { mission: m, course, bag: [], bagMax: m.bag, onEnd() { throw new Error('onEnd must not run'); } }); }
  finally { console.error = orig; }
  assert.equal(ok, false);
  assert.deepEqual(appended, []);
  assert.equal(DR.Run.peek().running, false);
  assert.equal(DR.Run.course(), null);
  assert.doesNotThrow(() => DR.Run.stop());
  assert.ok(errs.some((e) => /WebGL/.test(e)), '원인은 콘솔에 남긴다(교사·개발자용)');
});

/* ---------- ② app.js 흐름 ---------- */
const noGL = (log) => () => { log && log.push('run-fail'); return false; };

test('튜토리얼: 3D를 못 열면 안내 → [돌아가기] = 튜토리얼 브리핑, 저장 그대로', () => {
  const st = store();
  const g = boot(st, { run: noGL() });
  g.App.startTutorial();
  g.ui.briefing[1]();
  const saved = st._m.get(KEY);
  g.ui.tutorialGoal[1]();
  assert.ok(g.ui.no3d, '안내 화면');
  assert.equal(g.ui.examInspect, undefined, '달리기 결과로 넘어가지 않음');
  assert.equal(st._m.get(KEY), saved, '저장 그대로');
  g.ui.briefing = null;
  g.ui.no3d[0]();
  assert.ok(g.ui.briefing, '브리핑으로 돌아감');
  assert.equal(g.ui.briefing[0].id, 'tutorial');
  assert.equal(g.Save.load().mission, 'tutorial');
  assert.equal(g.Save.load().screen, 'briefing');
});

test('1 임무 첫 달리기: 안내 → 1 임무 브리핑, 기록·저장 그대로', () => {
  const st = store();
  const Save = boot(st).Save;
  Save.passTutorial();
  const g = boot(st, { run: noGL() });
  g.App.startMission('m1');
  g.ui.dialogue[1]();                // 도입 대화 끝 → 브리핑(체크포인트)
  const saved = st._m.get(KEY);
  g.ui.briefing[1]();                // [출발] → 3D 실패
  assert.ok(g.ui.no3d);
  assert.equal(st._m.get(KEY), saved);
  g.ui.briefing = null;
  g.ui.no3d[0]();
  assert.equal(g.ui.briefing[0].id, 'm1');
  const s = g.Save.load();
  assert.equal(s.mission, 'm1'); assert.equal(s.screen, 'briefing'); assert.equal(s.tutorialDone, true);
  assert.deepEqual(g.Save.records().tutorial, { cleared: true });
});

test('보충 달리기: 안내 → 보충 준비(보충 횟수 안 늘고 동기 카드 차례 그대로), 저장 그대로', () => {
  const st = store();
  const Save = boot(st).Save;
  Save.passTutorial();
  Save.checkpoint('prep', { mission: 'm4', bag: [], supplements: 0, seed: 5, peer: 'joined', peerPending: true }, {});
  const noTime = (raw) => raw.replace(/"savedAt":\d+/, ''); // 이어하기가 같은 체크포인트를 다시 쓰므로 시각만 달라진다
  const saved = noTime(st._m.get(KEY));
  const g = boot(st, { run: noGL() });
  g.App.resume(g.Save.load());
  assert.equal(noTime(st._m.get(KEY)), saved, '이어하기로 들어온 보충 준비 = 같은 체크포인트');
  assert.ok(g.ui.supplementPrep, '보충 준비');
  const [, , bag, go] = g.ui.supplementPrep;
  go(bag, {});                       // [출발] → 3D 실패
  assert.ok(g.ui.no3d);
  assert.equal(noTime(st._m.get(KEY)), saved, '저장 그대로');
  g.ui.supplementPrep = null;
  g.ui.no3d[0]();
  assert.ok(g.ui.supplementPrep, '보충 준비로 돌아감');
  assert.equal(g.App.state.supplements, 0, '달리지 못한 보충은 세지 않는다');
  assert.equal(g.App.state.peerPending, true, '동기 카드 차례 그대로');
  assert.equal(g.ui.supplementPrep[4].extra.length > 0, true, '동기 카드 다시 예약');
  assert.equal(noTime(st._m.get(KEY)), saved, '다시 들어온 보충 준비 체크포인트도 같은 내용');
});

test('연습(저장 안 함): 안내 → 연습 브리핑, 본 이야기 저장 그대로', () => {
  const st = store();
  const Save = boot(st).Save;
  Save.passTutorial();
  Save.checkpoint('inspect', { mission: 'm2', bag: [{ id: 'c1', key: 'can_drink' }], seed: 7 }, {});
  const saved = st._m.get(KEY);
  const g = boot(st, { run: noGL() });
  g.App.practiceTutorial();
  g.ui.briefing[1](); g.ui.tutorialGoal[1]();
  assert.ok(g.ui.no3d);
  g.ui.briefing = null;
  g.ui.no3d[0]();
  assert.equal(g.ui.briefing[0].id, 'tutorial');
  assert.equal(g.App.state.practice, true);
  assert.equal(st._m.get(KEY), saved);
});

test('정상 환경: Run.start가 true면 안내 없이 달리기 결과로', () => {
  const g = boot(store());
  g.App.startTutorial();
  g.ui.briefing[1](); g.ui.tutorialGoal[1]();
  assert.equal(g.ui.no3d, undefined);
  assert.ok(g.ui.examInspect);
});
