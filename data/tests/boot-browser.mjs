// 부팅: file://로 열려 타이틀이 보이고 데이터·three.js가 로드되는지
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const { browser, page, errors } = await openGame();
try {
  await page.locator('#btn-start').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await page.evaluate(() => typeof DR.Missions.m1), 'object');
  assert.equal(await page.evaluate(() => typeof DR.Missions.tutorial), 'object');
  assert.equal(await page.evaluate(() => typeof THREE), 'object');
  assert.deepEqual(errors, []);
  console.log('PASS boot');
} finally { await browser.close(); }
