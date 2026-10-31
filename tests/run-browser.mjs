// 3D 달리기: 시작·레인 이동·잡기·키 반복 무시·벽 감속·dt 상한·크기 변경·종료
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const { browser, page, errors } = await openGame({ query: '?run=m1' });
const peek = () => page.evaluate(() => DR.Run.peek());
// 일시정지 상태에서 조건이 맞을 때까지 step으로 진행(벽에 안 부딪히게 하려면 avoidWalls)
const stepUntil = (fnSrc, max = 4000) => page.evaluate(([src, max]) => {
  const f = new Function('p', 'items', 'cfg', src);
  for (let i = 0; i < max; i++) {
    const p = DR.Run.peek();
    if (f(p, DR.Run.course().items, DR.config)) return true;
    DR.Run.step(0.02);
  }
  return false;
}, [fnSrc, max]);

try {
  await page.waitForFunction(() => window.DR && DR.Run && DR.Run.peek().running, null, { timeout: 8000 });
  assert.equal(await page.locator('#run-stage canvas').count(), 1, 'one canvas');
  await page.evaluate(() => DR.Run.setPaused(true));

  // 레인 이동
  assert.equal((await peek()).lane, 1);
  await page.keyboard.press('ArrowRight');
  assert.equal((await peek()).lane, 2);
  await page.keyboard.press('KeyA'); await page.keyboard.press('KeyA');
  assert.equal((await peek()).lane, 0);
  await page.keyboard.press('KeyD');

  // 잡기: 다음 카드가 판정 구간에 들어올 때까지 진행 → 그 레인으로 → Space
  const findActive = `const c = items.find(i => i.kind==='card' && !DR.Run.isTaken(i.uid) && i.z - p.runnerZ > 0 && i.z - p.runnerZ <= p.speed*cfg.catchLead*0.6); if (c) { window.__target = c; return true; } return false;`;
  assert.ok(await stepUntil(findActive), 'reach an active card');
  let target = await page.evaluate(() => window.__target);
  for (let p = await peek(); p.lane !== target.lane; p = await peek()) await page.keyboard.press(p.lane < target.lane ? 'ArrowRight' : 'ArrowLeft');
  await page.keyboard.press('Space');
  await page.evaluate(() => DR.Run.step(0.016));
  assert.equal((await peek()).bagCount, 1, 'grabbed one');
  assert.match(await page.locator('#hud-bag').innerText(), /1\s*\/\s*30/);

  // 키 반복 무시: 반복 keydown은 잡기 시도가 아니다
  assert.ok(await stepUntil(findActive), 'reach another active card');
  target = await page.evaluate(() => window.__target);
  for (let p = await peek(); p.lane !== target.lane; p = await peek()) await page.keyboard.press(p.lane < target.lane ? 'ArrowRight' : 'ArrowLeft');
  const before = (await peek()).bagCount;
  await page.evaluate(() => { for (let i = 0; i < 5; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', repeat: true })); DR.Run.step(0.016); });
  assert.equal((await peek()).bagCount, before, 'repeat ignored');
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' })); DR.Run.step(0.016); });
  assert.equal((await peek()).bagCount, before + 1, 'fresh press grabs ' + JSON.stringify({ target, p: await peek(), taken: await page.evaluate((u) => DR.Run.isTaken(u), target.uid) }));

  // 벽: 앞의 벽 레인으로 옮겨 통과 → 감속
  assert.ok(await stepUntil(`const w = items.find(i => i.kind==='wall' && i.z - p.runnerZ > 1 && i.z - p.runnerZ < 6); if (w) { window.__wall = w; return true; } return false;`), 'reach a wall');
  const wall = await page.evaluate(() => window.__wall);
  for (let p = await peek(); p.lane !== wall.lane; p = await peek()) await page.keyboard.press(p.lane < wall.lane ? 'ArrowRight' : 'ArrowLeft');
  assert.ok(await stepUntil(`return p.runnerZ > ${wall.z} + 0.5;`), 'pass wall');
  const hit = await peek();
  assert.ok(hit.slowedUntil > hit.t, 'slowed');
  assert.ok(hit.speed < (await page.evaluate(() => DR.config.baseSpeed)), 'speed dropped');

  // dt 상한
  const dz = await page.evaluate(() => { const z0 = DR.Run.peek().runnerZ; DR.Run.step(5); return { dz: DR.Run.peek().runnerZ - z0, max: DR.config.baseSpeed * (1 + DR.config.speedRamp) * DR.config.maxDt }; });
  assert.ok(dz.dz <= dz.max + 1e-6, `dt clamp ${dz.dz} > ${dz.max}`);

  // 크기 변경(회전) 중에도 이어서 달린다
  await page.evaluate(() => DR.Run.setPaused(false));
  await page.waitForTimeout(400);
  await page.screenshot({ path: shotPath('run-1366') });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  const cv = await page.evaluate(() => { const c = document.querySelector('#run-stage canvas'); return { cw: c.clientWidth, w: c.width }; });
  assert.equal(cv.cw, 375, 'css width follows');
  assert.ok(cv.w >= 375, 'drawing buffer follows');
  assert.ok((await peek()).running, 'still running');
  await page.screenshot({ path: shotPath('run-375') });

  // 종료
  await page.evaluate(() => DR.Run.finishNow());
  const res = await page.evaluate(() => window.__runResult);
  assert.ok(res && Array.isArray(res.grabbed), 'onEnd called');
  assert.equal(res.grabbed.length, before + 1);
  assert.equal((await peek()).running, false);
  assert.deepEqual(errors, []);
  console.log('PASS run');
} finally { await browser.close(); }
