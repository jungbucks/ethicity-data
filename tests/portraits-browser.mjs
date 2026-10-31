import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';
for (const width of [1280, 375]) {
  const { browser, page, errors } = await openGame({ viewport: { width, height: 800 } });
  try {
    await page.waitForFunction(() => [...document.querySelectorAll('#hero-pick img')].length === 3 && [...document.querySelectorAll('#hero-pick img')].every(i => i.complete && i.naturalWidth === 1024));
    assert.deepEqual(await page.locator('#hero-pick img').evaluateAll(imgs => imgs.map(i => i.alt)), ['온유', '다온', 'AI 봇']);
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
