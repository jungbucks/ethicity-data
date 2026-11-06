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
    assert.ok(await page.locator('#hero-pick').evaluate(e => e.getBoundingClientRect().right <= innerWidth && e.getBoundingClientRect().bottom <= innerHeight + 1));
    await page.locator('[data-hero="daon"]').click();
    assert.equal(await page.evaluate(() => DR.Save.hero()), 'daon');
    await page.screenshot({ path: shotPath('portraits-title-' + width) });
    const mapping = await page.evaluate(() => ['runner','peer','guide','bot'].map(id => { const p=DR.UI.portrait(id,72); return [id,p.dataset.character,p.querySelector('img').style.transform]; }));
    // 수거봇(bot)은 Codex 새 시트 collector
    assert.deepEqual(mapping.map(x=>x[1]), ['daon','onyu','robot','collector']);
    assert.equal(mapping[2][2], 'translateX(-75%)');
    // 새 인물 초상 6명: 4표정(기본·기쁨·걱정·설명) supervisor·senior·examiner / 2표정(기본·걱정) sorter·client·collector(bot)
    const faces = await page.evaluate(() => [
      ['supervisor', 'explain'], ['supervisor', 'worried'], ['senior', 'happy'], ['examiner', undefined],
      ['sorter', 'worried'], ['sorter', 'happy'], ['client', 'worried'], ['bot', 'worried'], ['bot', 'explain']
    ].map(([who, face]) => { const p = DR.UI.portrait(who, 72, face); return [who, face, p.dataset.character, p.querySelector('img').style.transform, p.querySelector('img').alt]; }));
    assert.deepEqual(faces.map((f) => f[2]), ['supervisor', 'supervisor', 'senior', 'examiner', 'sorter', 'sorter', 'client', 'collector', 'collector']);
    assert.deepEqual(faces.map((f) => f[3]), ['translateX(-75%)', 'translateX(-50%)', 'translateX(-25%)', 'translateX(0%)', 'translateX(-25%)', 'translateX(0%)', 'translateX(-25%)', 'translateX(-25%)', 'translateX(0%)']);
    assert.deepEqual([...new Set(faces.map((f) => f[4]))], ['감독관', '선배', '시험관', '선별장 직원', '도로 관리원', '수거봇']);
    // 택배 기사(courier) = 2표정 시트(기본·걱정), 기쁨은 기본 칸
    const courier = await page.evaluate(() => [undefined, 'worried', 'happy'].map((face) => { const p = DR.UI.portrait('courier', 72, face); return [p.dataset.character, p.querySelector('img').style.transform, p.querySelector('img').alt]; }));
    assert.deepEqual(courier, [['courier', 'translateX(0%)', '택배 기사'], ['courier', 'translateX(-25%)', '택배 기사'], ['courier', 'translateX(0%)', '택배 기사']]);
    await page.evaluate(() => DR.UI.dialogue([{ who: 'supervisor', text: '감독관', face: 'worried' }, { who: 'sorter', text: '선별장', face: 'worried' }], function () {}));
    await page.waitForFunction(() => [...document.querySelectorAll('#screen-story img')].every((i) => i.complete && i.naturalWidth === 1024));
    assert.equal(await page.locator('#screen-story .character-portrait').getAttribute('data-character'), 'supervisor');
    await page.evaluate(() => DR.UI.dialogue([{who:'guide',text:'러너, 준비됐나요?'}], function(){}));
    await page.waitForFunction(() => [...document.querySelectorAll('#screen-story img')].every(i=>i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: shotPath('portraits-bot-' + width) });
    assert.deepEqual(errors, []); console.log('PASS official portraits, selection, dialogue', width);
  } finally { await browser.close(); }
}
