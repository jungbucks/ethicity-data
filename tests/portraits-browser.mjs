import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';
for (const width of [1280, 375]) {
  const { browser, page, errors } = await openGame({ viewport: { width, height: 800 } });
  try {
    // 시작 화면 다시 꾸미기: AI 봇은 '달릴 주인공' 묶음 밖의 안내 역할(#title-guide)
    await page.waitForFunction(() => [...document.querySelectorAll('#hero-pick img, #title-guide img')].length === 3 && [...document.querySelectorAll('#hero-pick img, #title-guide img')].every(i => i.complete && i.naturalWidth === 1024));
    assert.deepEqual(await page.locator('#hero-pick img').evaluateAll(imgs => imgs.map(i => i.alt)), ['온유', '다온']);
    assert.equal(await page.locator('#title-guide img').getAttribute('alt'), 'AI 봇');
    // 모바일 시작 화면은 달리는 장면이 위로 올라가 '달릴 주인공'이 아래쪽 — 가로로 넘치지 않고, 스크롤하면 다 보이면 된다
    await page.locator('#hero-pick').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#hero-pick').evaluate(e => e.getBoundingClientRect().right <= innerWidth && e.getBoundingClientRect().bottom <= innerHeight));
    await page.locator('[data-hero="daon"]').click();
    assert.equal(await page.evaluate(() => DR.Save.hero()), 'daon');
    await page.screenshot({ path: shotPath('portraits-title-' + width) });
    await page.locator('#btn-start').click();
    assert.equal(await page.locator('#screen-profile .character-portrait').getAttribute('data-character'), 'daon');
    const mapping = await page.evaluate(() => ['runner','peer','guide','bot'].map(id => { const p=DR.UI.portrait(id,72); return [id,p.dataset.character,p.querySelector('img').style.transform]; }));
    assert.deepEqual(mapping.map(x=>x[1]), ['daon','onyu','robot','robot']);
    assert.equal(mapping[2][2], 'translateX(-75%)');
    await page.evaluate(() => DR.UI.dialogue([{who:'guide',text:'러너, 준비됐나요?'}], function(){}));
    await page.waitForFunction(() => [...document.querySelectorAll('#screen-story img')].every(i=>i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: shotPath('portraits-bot-' + width) });
    assert.deepEqual(errors, []); console.log('PASS official portraits, selection, dialogue', width);
  } finally { await browser.close(); }
}
