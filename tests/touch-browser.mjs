// 터치: 스와이프 = 레인 이동, 탭 = 잡기. 브라우저 스크롤 제스처와 겹치지 않는다(콘솔 경고·오류 없음).
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const { browser, page, errors } = await openGame({ query: '?run=m1', viewport: { width: 390, height: 844 }, hasTouch: true });
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
