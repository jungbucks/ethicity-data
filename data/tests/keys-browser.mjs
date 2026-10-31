// Space 연타·꾹 누르기로 교육 화면(브리핑·튜토리얼 결과)을 건너뛰지 않는다
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

// 1) 대화를 Space로 넘긴 뒤 한 번 더 눌러도 브리핑에 머문다
{
  const { browser, page, errors } = await openGame({ query: '?start=m1' });
  try {
    const n = await page.evaluate(() => DR.Missions.m1.story.intro.length);
    for (let i = 0; i < n; i++) await page.keyboard.press('Space');
    assert.ok(await page.locator('#screen-briefing').isVisible(), 'briefing after dialogue');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    assert.ok(await page.locator('#screen-briefing').isVisible(), 'Space/Enter must not start the run');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 2) 달리기가 끝난 직후 Space를 눌러도 튜토리얼 결과에 머문다
{
  const { browser, page, errors } = await openGame();
  try {
    await page.locator('#btn-start').click();
    await page.locator('#btn-skip').click(); // 프롤로그
    await page.locator('#btn-skip').click(); // 튜토리얼 대화
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.App.debugFill({ dog: 8 }); DR.Run.finishNow(); });
    await page.locator('#screen-result').waitFor();
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    assert.ok(await page.locator('#screen-result').isVisible(), 'result must stay');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('PASS keys');
