import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';
for (const [width, height] of [[1280, 800], [900, 800], [667, 375]]) {
  const { browser, page, errors } = await openGame({ query: '?run=m1', viewport: { width, height } });
  try {
    await page.waitForFunction(() => DR.Run.peek().running);
    await page.evaluate(() => DR.Run.setPaused(true));
    await page.keyboard.press('Space');
    assert.match(await page.locator('#hud-bag').getAttribute('class'), /empty-grab/);
    const target = await page.evaluate(() => {
      const it = DR.Run.course().items.find(x => x.kind === 'card');
      while (DR.Catch.phase(it, DR.Run.peek().runnerZ, DR.Run.peek().speed, DR.config) !== 'active') DR.Run.step(.02);
      return it;
    });
    let lane = await page.evaluate(() => DR.Run.peek().lane);
    while (lane !== target.lane) { await page.keyboard.press(lane < target.lane ? 'ArrowRight' : 'ArrowLeft'); lane = await page.evaluate(() => DR.Run.peek().lane); }
    await page.evaluate(() => DR.Run.step(.001));
    assert.equal(await page.locator('.catch-active').count(), 1);
    const card = page.locator(`.run-card[data-uid="${target.uid}"]`);
    assert.match(await card.innerText(), /Space/);
    const bounds = await card.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    const badgeBounds = await card.locator('.catch-badge').boundingBox(); assert.ok(badgeBounds.y >= 0 && badgeBounds.y + badgeBounds.height <= height);
    await page.screenshot({ path: shotPath('readability-' + width) });
    await page.keyboard.press('Space'); await page.evaluate(() => DR.Run.step(.02));
    assert.equal(await page.locator('.caught-flight').count(), 1);
    assert.match(await page.locator('.catch-notice').innerText(), /^\+ /);
    assert.equal(await page.evaluate(() => DR.Run.peek().bagCount), 1);
    assert.match(await page.locator('.zone-cell.current .zone-count').innerText(), /이번 1장/);
    assert.doesNotMatch(await page.locator('#hud-bag').getAttribute('class'), /empty-grab/);
    await page.evaluate(() => { for (let i=0;i<8;i++) DR.Run.step(.05); DR.Run.step(.049); });
    const flight = await page.locator('.caught-flight').boundingBox(), bag = await page.locator('#hud-bag').boundingBox();
    assert.ok(Math.abs(flight.x + flight.width/2 - bag.x - bag.width/2) < 6);
    assert.ok(Math.abs(flight.y + flight.height/2 - bag.y - bag.height/2) < 6, 'flight reaches actual bag center');
    for (const [id, expected] of [['f_pool', '낮 · 침수(깊음)'], ['f_fountain', '낮 · 침수(얕음)'], ['f_fridge', '밤 · 정상(젖음)'], ['q_neon', '판단 필요'], ['q_muddy', '판단 필요'], ['q_clean', '판단 필요']]) {
      await page.evaluate(id => {
        const item = { uid: 'c0', kind: 'card', lane: 1, z: 9 };
        item[id.startsWith('f_') ? 'fakeId' : 'ambiguousId'] = id;
        DR.Run.start(document.getElementById('run-stage'), { mission: DR.Missions.m1, bag: [], bagMax: 30, course: { length: 100, items: [item] } });
        DR.Run.setPaused(true);
      }, id);
      assert.equal(await page.locator('.run-card-label').innerText(), expected);
      assert.equal(await page.locator('.catch-active').count(), 1);
      if (width === 900 && id.startsWith('f_')) await page.screenshot({ path: shotPath('readable-' + id) });
    }
    await page.evaluate(() => {
      DR.Run.start(document.getElementById('run-stage'), { mission: DR.Missions.m1, bag: [], bagMax: 30, course: { length: 100, items: [{ uid: 'f0', kind: 'fire', lane: 1, z: 15 }] } });
      DR.Run.setPaused(true); DR.Run.step(.02);
    });
    assert.equal(await page.locator('.fire-warning:visible').innerText(), '! 불');
    await page.screenshot({ path: shotPath('danger-' + width) });
    await page.evaluate(() => { while (DR.Run.peek().hp === 3) DR.Run.step(.02); });
    assert.equal(await page.locator('.damage-flash:visible').innerText(), '불에 맞음');
    assert.equal(await page.evaluate(() => DR.Run.peek().hp), 2);
    assert.deepEqual(errors, []);
    console.log('PASS readable cards, active badge, empty press, flight', width);
  } finally { await browser.close(); }
}
