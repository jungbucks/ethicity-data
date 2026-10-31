// 주인공 3D 모델: 타이틀에서 온유·다온을 고르면(ethicity.data.hero) 달리기에 그 모델이 서고, 다리가 흔들린다
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const { browser, page, errors } = await openGame();
try {
  await page.locator('#hero-pick').waitFor({ state: 'visible', timeout: 5000 });
  const pressed = () => page.$$eval('#hero-pick [data-hero]', (bs) => bs.map((b) => b.dataset.hero + ':' + b.getAttribute('aria-pressed')));
  assert.deepEqual(await pressed(), ['onyu:true', 'daon:false'], '처음엔 온유');
  await page.click('#hero-pick [data-hero=daon]');
  assert.deepEqual(await pressed(), ['onyu:false', 'daon:true']);
  assert.equal(await page.evaluate(() => localStorage.getItem('ethicity.data.hero')), 'daon');

  // 같은 브라우저 저장소로 바로 달리기 진입 → 다온 모델
  await page.goto(page.url().replace(/[?#].*$/, '') + '?run=m1');
  await page.waitForFunction(() => window.DR && DR.Run && DR.Run.peek().running, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const a = await page.evaluate(() => DR.Run.peek());
  assert.equal(a.hero, 'daon', '달리기 주인공 = 다온 모델');
  await page.waitForTimeout(300);
  const b = await page.evaluate(() => DR.Run.peek());
  assert.notEqual(a.legSwing, b.legSwing, '다리가 흔들린다');
  await page.screenshot({ path: shotPath('run-hero-daon') });
  assert.deepEqual(errors, []);
  console.log('PASS hero');
} finally { await browser.close(); }
