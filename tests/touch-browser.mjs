// 터치: 스와이프 = 레인 이동, 탭 = 잡기. 브라우저 스크롤 제스처와 겹치지 않는다(콘솔 경고·오류 없음).
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const { browser, page, errors } = await openGame({ query: '?run=flood', viewport: { width: 390, height: 844 }, hasTouch: true });
const warnings = [];
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
try {
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate(() => DR.Run.setPaused(true));
  const cdp = await page.context().newCDPSession(page);
  const touch = async (points) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
    for (const p of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  // 오른쪽으로 밀기 → 레인 2
  await touch([{ x: 150, y: 500 }, { x: 180, y: 502 }, { x: 220, y: 504 }, { x: 260, y: 505 }]);
  assert.equal(await page.evaluate(() => DR.Run.peek().lane), 2, 'swipe right');
  // 손가락을 떼기 전에, 문턱(30px)을 넘는 순간 옮긴다(2026-11-10) — 길게 밀어도 한 칸, 뗄 때 잡기로 치지 않음
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 260, y: 500 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 240, y: 501 }] });
  assert.equal(await page.evaluate(() => DR.Run.peek().lane), 2, 'below threshold: no move yet');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 225, y: 502 }] });
  // 브라우저는 touchmove를 다음 프레임에 묶어 보낸다 → 손가락을 떼지 않은 채 기다린다(떼어야만 옮겨지면 여기서 시간 초과)
  await page.waitForFunction(() => DR.Run.peek().lane === 1, null, { timeout: 3000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 503 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.evaluate(() => DR.Run.peek().lane), 1, 'one swipe = one lane');
  await touch([{ x: 150, y: 500 }, { x: 200, y: 502 }]);
  assert.equal(await page.evaluate(() => DR.Run.peek().lane), 2, 'back to lane 2');
  // 아래로 긁기 → 아무 일 없음(새로고침 제스처 아님)
  await touch([{ x: 200, y: 300 }, { x: 200, y: 400 }, { x: 200, y: 520 }]);
  assert.equal(await page.evaluate(() => DR.Run.peek().lane), 2, 'vertical drag ignored');
  // 탭 → 잡기 입력
  await touch([{ x: 200, y: 500 }]);
  assert.ok(await page.evaluate(() => DR.Run.peek().t >= 0), 'still alive');
  const style = await page.evaluate(() => ({ ta: getComputedStyle(document.getElementById('run-stage')).touchAction, ob: getComputedStyle(document.body).overscrollBehaviorY }));
  assert.equal(style.ta, 'none', 'touch-action none on stage');
  assert.equal(style.ob, 'none', 'no pull-to-refresh');
  assert.deepEqual(warnings.filter((w) => /cancel|scroll/i.test(w)), [], 'no ignored-cancel warnings');
  assert.deepEqual(errors, []);
  console.log('PASS touch');
} finally { await browser.close(); }
