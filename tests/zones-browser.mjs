import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';
for (const width of [1280, 900]) {
  const { browser, page, errors } = await openGame({ query: '?run=m1', viewport: { width, height: 800 } });
  try {
    await page.waitForFunction(() => DR.Run.peek().running);
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
    assert.equal(await page.locator('.zone-cell').count(), 4);
    assert.doesNotMatch(await page.locator('#hud-progress').innerText(), /\d+\s*\/\s*\d+/);
    for (const id of ['S2', 'S4', 'S3', 'S1']) {
      await page.evaluate(id => {
        const zone = DR.Run.course().zones.find(z => z.id === id);
        while (DR.Run.peek().runnerZ < zone.start + 1) DR.Run.step(.05);
      }, id);
      assert.equal(await page.locator('.zone-cell.current').getAttribute('data-scene'), id);
      assert.match(await page.locator('.zone-sign:visible').innerText(), /구역/);
      const rects = await page.locator('.zone-cell').evaluateAll(els => els.map(e => { const r=e.getBoundingClientRect();return { x:r.x,right:r.right,scroll:e.scrollWidth,w:e.clientWidth }; }));
      assert.ok(rects.every(r => r.x >= 0 && r.right <= width && r.scroll <= r.w));
      await page.screenshot({ path: shotPath('zone-' + id + '-' + width) });
    }
    await page.evaluate(() => {
      DR.App.state = { needRevealed: true };
      const course = DR.Stream.build(DR.Missions.m1, DR.config, { seed: 1102, focusCounts: { night_deep: 2 } });
      DR.Run.start(document.getElementById('run-stage'), { mission: DR.Missions.m1, course, bag: [{key:'night_wet'}], bagMax:30 }); DR.Run.setPaused(true);
    });
    assert.match(await page.locator('#hud-progress').innerText(), /\d+\/\d+/);
    await page.screenshot({ path: shotPath('zone-supplement-' + width) });
    await page.evaluate(() => {
      const course = DR.Stream.build(DR.Missions.m1, DR.config, { seed:1101 });
      DR.Run.start(document.getElementById('run-stage'), { mission:DR.Missions.m1,course,bag:[],bagMax:30 }); DR.Run.setPaused(true);
    });
    assert.doesNotMatch(await page.locator('#hud-progress').innerText(), /\d+\/\d+/, 'revealed flag alone does not show need in main run');
    assert.deepEqual(errors, []); console.log('PASS four scenes, signs, bars, hidden needs', width);
  } finally { await browser.close(); }
}
