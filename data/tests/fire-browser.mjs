// 불꽃: 경고 → 맞으면 감속·흔들림·HP-1·잠깐 무적 → HP 0이면 "연결이 끊겼다" → 같은 코스 처음부터(가방 비움)
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const stepUntil = (page, src, max = 6000) => page.evaluate(([src, max]) => {
  const f = new Function('p', 'items', 'cfg', src);
  for (let i = 0; i < max; i++) { const p = DR.Run.peek(); if (f(p, DR.Run.course().items, DR.config)) return true; DR.Run.step(0.02); }
  return false;
}, [src, max]);
const findFire = `const f = items.find(i => i.kind==='fire' && i.z - p.runnerZ > 2 && i.z - p.runnerZ < 30); if (f) { window.__fire = f; return true; } return false;`;
async function walkInto(page) {
  assert.ok(await stepUntil(page, findFire), 'a fire ahead');
  const fire = await page.evaluate(() => window.__fire);
  for (let p = await page.evaluate(() => DR.Run.peek()); p.lane !== fire.lane; p = await page.evaluate(() => DR.Run.peek())) await page.keyboard.press(p.lane < fire.lane ? 'ArrowRight' : 'ArrowLeft');
  assert.ok(await stepUntil(page, `return p.warning === '${fire.uid}';`), 'warning before arrival');
  assert.ok(await page.locator('#run-hint').isVisible(), 'first-fire hint');
  assert.ok(await stepUntil(page, `return !p.running || p.runnerZ > ${fire.z} + 0.5;`), 'pass the fire');
  return fire;
}

// 1) 맞으면 HP-1·감속·무적
{
  const { browser, page, errors } = await openGame({ query: '?run=m1' });
  try {
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => DR.Run.setPaused(true));
    const hp0 = await page.evaluate(() => DR.config.hp);
    assert.equal(await page.evaluate(() => DR.Run.peek().hp), hp0);
    assert.equal(await page.locator('#hud-hp .heart.on').count(), hp0);
    await walkInto(page);
    const p = await page.evaluate(() => DR.Run.peek());
    assert.equal(p.hp, hp0 - 1, 'hp down');
    assert.ok(p.slowedUntil > p.t, 'slowed');
    assert.ok(p.invulnUntil > p.t, 'invulnerable for a moment');
    assert.equal(await page.locator('#hud-hp .heart.on').count(), hp0 - 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 2) HP 0 → 연결 끊김 화면 → 같은 코스 처음부터
{
  const { browser, page, errors } = await openGame({ query: '?start=m1' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.Run.setPaused(true); DR.App.debugFill({ day_deep: 2 }); DR.Run.debugSetHp(1); });
    const firstUid = await page.evaluate(() => DR.App.course.items[0].uid + DR.App.course.items.length);
    await walkInto(page);
    await page.locator('#screen-knockout').waitFor({ state: 'visible', timeout: 3000 });
    assert.match(await page.locator('#screen-knockout').innerText(), /연결이 끊겼다/);
    await page.locator('#btn-rerun').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    const p = await page.evaluate(() => DR.Run.peek());
    assert.equal(p.bagCount, 0, 'bag emptied');
    assert.equal(p.hp, await page.evaluate(() => DR.config.hp), 'hp refilled');
    assert.equal(await page.evaluate(() => DR.App.course.items[0].uid + DR.App.course.items.length), firstUid, 'same course');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('PASS fire');
