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

// [3] 2 임무도 구역: 상단 구역 이름·이번 N장, 구역마다 선별장 배경(하늘색·분류함 색)이 바뀐다
for (const width of [1280, 390]) {
  const { browser, page, errors } = await openGame({ query: '?run=m2', viewport: { width, height: width < 500 ? 844 : 800 } });
  try {
    await page.waitForFunction(() => DR.Run.peek().running);
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
    assert.equal(await page.locator('.zone-cell').count(), 4);
    assert.match(await page.locator('#hud-progress').innerText(), /캔[\s\S]*페트·비닐[\s\S]*종이·영수증[\s\S]*건전지/);
    const skies = [];
    for (const id of ['S1', 'S2', 'S3', 'S4']) {
      await page.evaluate((id) => {
        const zone = DR.Run.course().zones.find((z) => z.id === id);
        while (DR.Run.peek().runnerZ < zone.start + 1) DR.Run.step(0.05);
      }, id);
      assert.equal(await page.locator('.zone-cell.current').getAttribute('data-scene'), id);
      assert.match(await page.locator('.zone-cell.current .zone-count').innerText(), /^이번 \d+장$/);
      assert.match(await page.locator('.zone-sign:visible').innerText(), /구역/);
      const sc = await page.evaluate(() => DR.Run.peek().scenery);
      assert.equal(sc.theme, 'sorting'); assert.equal(sc.zone, id);
      skies.push(sc.sky);
      const rects = await page.locator('.zone-cell').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, right: r.right, scroll: e.scrollWidth, w: e.clientWidth }; }));
      assert.ok(rects.every((r) => r.x >= 0 && r.right <= width && r.scroll <= r.w), 'zone cells fit ' + width);
      await page.screenshot({ path: shotPath('m2-zone-' + id + '-' + width) });
    }
    assert.equal(new Set(skies).size, 4, 'background changes per zone');
    assert.deepEqual(errors, []); console.log('PASS m2 zones', width);
  } finally { await browser.close(); }
}
