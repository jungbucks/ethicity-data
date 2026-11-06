// 2026-11-06 새 1 임무 분실물 센터: 접힌 우산만 부족 → 그 물건만 보류 → 보충 → 목록 복귀 / 여섯 모습 충족 → 2 임무 / 375px·키보드
import assert from 'node:assert/strict';
import { openGame, passCity, shotPath } from './browser.mjs';

const ALL3 = { umbrella_open: 3, umbrella_folded: 3, wallet_closed: 3, wallet_open: 3, phone_front: 3, phone_back: 3 };
const start = async (page) => {
  await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor();
  await page.waitForFunction(() => DR.CardArt.photosReady());
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
};
const fill = (page, c) => page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, c);
const submit = async (page) => {
  await page.locator('#screen-inspect').waitFor({ state: 'visible' });
  await page.locator('#btn-submit').click();
  await page.locator('#btn-confirm').click();
};
const skipConveyor = async (page) => {
  await page.locator('#screen-conveyor').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('#btn-cv-skip').click();
  await page.locator('#btn-cv-next').click();
};

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  const { browser, page, errors } = await openGame({ viewport, query: '?start=m1' });
  try {
    assert.match(await page.locator('#screen-story').innerText(), /왜 목록에 없어요/);
    await start(page);
    // 달리는 카드: 이름표는 종류, 사진은 그 모습
    await page.waitForFunction(() => document.querySelectorAll('.run-card:not([hidden]) img').length >= 1, null, { timeout: 30000 });
    const c = await page.evaluate(() => [...document.querySelectorAll('.run-card')].map((e) => ({ label: e.querySelector('.run-card-label').textContent, photo: e.querySelector('img').dataset.photo })));
    c.forEach((x) => { assert.ok(['우산', '지갑', '스마트폰'].includes(x.label), JSON.stringify(x)); assert.match(x.photo, /^(umbrella|wallet|phone)-/); });
    await page.screenshot({ path: shotPath('lost-run-' + viewport.width) });
    // 접힌 우산만 부족
    await fill(page, { ...ALL3, umbrella_folded: 1, umbrella_open: 6 });
    await page.locator('#screen-inspect').waitFor({ state: 'visible' });
    const ins = await page.locator('#screen-inspect').innerText();
    assert.doesNotMatch(ins, /접힌|펼친|뒷면/, '첫 검수는 모습을 글로 알려 주지 않는다');
    await page.screenshot({ path: shotPath('lost-inspect-' + viewport.width), fullPage: true });
    await submit(page);
    await skipConveyor(page);
    await page.locator('#screen-result .result-scene').waitFor({ timeout: 40000 });
    const first = page.locator('#screen-result .result-scene');
    assert.equal(await first.getAttribute('data-scene'), 'S1');
    assert.equal(await first.getAttribute('data-outcome'), 'inconvenience');
    const r = await page.locator('#screen-result').innerText();
    assert.match(r, /분류 보류로 남은 물건/); assert.match(r, /접힌 우산 · 제출한 자료 1장/); assert.doesNotMatch(r, /펼친 우산 · 제출한 자료/, '펼친 우산은 보류 아님');
    await page.screenshot({ path: shotPath('lost-result-' + viewport.width), fullPage: true });
    await page.locator('#btn-next').click();
    assert.equal(await page.locator('#screen-result .result-scene').getAttribute('data-outcome'), 'pass', '지갑은 통과');
    await page.locator('#btn-next').click(); await page.locator('#btn-next').click();
    // 보충: 접힌 우산을 더 가져와 다시 시연
    await page.locator('#screen-prep').waitFor({ state: 'visible', timeout: 8000 });
    assert.match(await page.locator('#screen-prep').innerText(), /접힌 우산/);
    await page.locator('#btn-supplement').click();
    await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 8000 });
    await fill(page, { umbrella_folded: 2 });
    await submit(page);
    await skipConveyor(page);
    await page.locator('#screen-result .result-scene').waitFor({ timeout: 40000 });
    for (let i = 0; i < 3; i++) {
      assert.equal(await page.locator('#screen-result .result-scene').getAttribute('data-outcome'), 'pass', 'scene ' + i);
      if (i === 2) assert.match(await page.locator('#screen-result').innerText(), /이제 우산 칸에 떠요/);
      await page.locator('#btn-next').click();
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log('ok folded umbrella only', viewport.width);
  } finally { await browser.close(); }
}

// 여섯 모습 충족 → 첫 판 통과 → 2 임무로
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await start(page);
    await fill(page, ALL3);
    await submit(page);
    await skipConveyor(page);
    await page.locator('#screen-result .result-scene').waitFor({ timeout: 40000 });
    for (let i = 0; i < 3; i++) await page.locator('#btn-next').click();
    for (let i = 0; i < 6 && !(await page.locator('#screen-outro').isVisible()); i++) { await page.waitForTimeout(200); if (await page.locator('#btn-skip').count()) await page.locator('#btn-skip').click(); await passCity(page); }
    await page.locator('#screen-outro').waitFor({ state: 'visible', timeout: 8000 });
    assert.equal(await page.evaluate(() => DR.App.cityCount()), 1, '도시 칸 하나');
    await page.locator('#screen-outro .btn-primary').first().click();
    await page.locator('#screen-story').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.evaluate(() => DR.App.state.mission), 'm2');
    assert.deepEqual(errors, []);
    console.log('ok six shapes → m2');
  } finally { await browser.close(); }
}
console.log('PASS lost');
