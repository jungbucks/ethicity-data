// 부팅: file://로 열려 타이틀이 보이고 데이터·three.js가 로드되는지
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const { browser, page, errors } = await openGame();
try {
  await page.locator('#btn-start').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await page.evaluate(() => typeof DR.Missions.m1), 'object');
  assert.equal(await page.evaluate(() => typeof DR.Missions.tutorial), 'object');
  assert.equal(await page.evaluate(() => typeof THREE), 'object');
  // 임무 고르기(팀원이 앞을 다시 하지 않게): 처음부터 + 1 임무 + 2 임무
  assert.equal(await page.locator('#title-missions button').count(), 2, 'mission picker');
  assert.ok(await page.locator('#btn-m1').isVisible() && await page.locator('#btn-m2').isVisible());
  await page.locator('#btn-m2').click();
  await page.locator('#screen-story').waitFor({ state: 'visible', timeout: 4000 });
  const first = await page.evaluate(() => DR.Missions.m2.story.intro[0].text);
  assert.ok((await page.locator('#screen-story').innerText()).includes(first), 'm2 intro');
  assert.equal(await page.evaluate(() => DR.App.state.mission), 'm2');
  assert.deepEqual(errors, []);
  console.log('PASS boot');
} finally { await browser.close(); }
