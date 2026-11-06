// 사용자 지시서 '사소한 문제 9가지'(2026-11-02) — 대화 넘기기·단서 글 한 번·프로필 이름·장면 순서·두 장면 공통·
// 임무 완료 요약·숨은 화면 정리·달리기 화소 비율 상한
import assert from 'node:assert/strict';
import { passCity, openGame } from './browser.mjs';

const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };
const hint = (page) => page.locator('#screen-story .dialog-hint').innerText();

// 1·3) 프로필: 고른 주인공 이름 · 화면 아무 곳 → 떠오르는 중이면 문장 완성, 다 보이면 다음 / 대화: 아무 곳이나 → 다음, 건너뛰기는 그대로
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 } });
  try {
    await page.locator('#hero-pick [data-hero="daon"]').click();
    await page.locator('#btn-start').click();
    await page.locator('#screen-profile').waitFor({ state: 'visible' });
    assert.doesNotMatch(await page.locator('#screen-profile').innerText(), /가칭/);
    for (let i = 0; i < 4; i++) await page.locator('#btn-opening-next').click();
    assert.match(await page.locator('.opening-info').innerText(), /다온 · 고2/);
    assert.match(await page.locator('#screen-profile').innerText(), /다온 오늘만 통과하면/);
    await page.evaluate(() => DR.App.startMission('m2')); // 대화창 조작 확인(오프닝은 대화창을 쓰지 않는다)
    await page.locator('#screen-story').waitFor({ state: 'visible' });
    assert.match(await hint(page), /^1 \//);
    await page.mouse.click(20, 20); // 대화창 밖
    assert.match(await hint(page), /^2 \//, 'click anywhere advances the dialogue');
    // 주인공 대사 이름표도 고른 주인공
    const names = await page.evaluate(() => DR.UI.speakerName('runner'));
    assert.equal(names, '다온');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 2·4·5·6·8) 1 임무
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=flood' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    // 4) 브리핑 장면 순서 = 달리기 구역 순서(S2 → S4 → S3 → S1)
    const order = await page.locator('#screen-briefing .brief-scene').evaluateAll((els) => els.map((e) => e.dataset.scene));
    assert.deepEqual(order, ['S2', 'S4', 'S3', 'S1']);
    assert.equal(await page.locator('#screen-briefing .brief-scene[data-scene="S4"]').getAttribute('data-emphasis'), 'low');
    // 8) 숨은 화면: 지나간 화면의 DOM은 비우고, 정적 화면은 aria-hidden
    assert.equal(await page.locator('#screen-story').evaluate((e) => e.innerHTML.trim()), '', 'story DOM cleared after leaving');
    assert.equal(await page.locator('#screen-title').getAttribute('aria-hidden'), 'true');
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    // 9) 달리기 화소 비율 상한
    assert.ok(await page.evaluate(() => DR.Run.peek().pixelRatio <= DR.config.maxPixelRatio));
    await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, { ...ALL2, night_wet: 4, q_neon: 1 });
    await page.locator('#screen-inspect').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#screen-briefing').evaluate((e) => e.innerHTML.trim()), '', 'briefing DOM cleared');
    assert.equal(await page.locator('#screen-run').getAttribute('aria-hidden'), 'true');
    assert.ok(await page.evaluate(() => document.querySelectorAll('[id="btn-skip"]').length <= 1), 'no duplicate ids from hidden screens');
    // 4) 장면별 모아 보기도 구역 순서 · 5) 두 장면에 쓰는 종류에 '(두 장면 공통)'
    const sceneOrder = await page.locator('#inspect-scenes .scene-sum').evaluateAll((els) => els.map((e) => e.dataset.scene));
    assert.deepEqual(sceneOrder, ['S2', 'S4', 'S3', 'S1']);
    assert.match(await page.locator('#inspect-scenes [data-scene="S3"] [data-combo="S3_night_wet"]').innerText(), /\(두 장면 공통\)/);
    assert.match(await page.locator('#inspect-scenes [data-scene="S4"] [data-combo="S4_night_wet"]').innerText(), /\(두 장면 공통\)/);
    assert.doesNotMatch(await page.locator('#inspect-scenes [data-scene="S2"]').innerText(), /두 장면 공통/);
    // 2) 단서 카드 글은 한 번만(캡션) — 그림 칸에는 글을 그리지 않는다
    await page.locator('#inspect-grid .bag-card[data-key="q_neon"] .bag-open').click();
    const clue = await page.evaluate(() => {
      const m = DR.Missions.flood;
      const a = DR.CardArt.clue(m, 'q_neon', 1, 256).toDataURL(), b = DR.CardArt.clue(m, 'q_muddy', 0, 256).toDataURL(); // 둘 다 수위 센서, 문구만 다름
      return { same: a === b, captions: [...document.querySelectorAll('#inspect-zoom .clue figcaption')].map((f) => f.textContent) };
    });
    assert.equal(clue.same, true, 'sensor clue art has no text in it');
    assert.equal(clue.captions.length, 2);
    await page.keyboard.press('Escape');
    // 결과도 구역 순서
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await page.locator('#screen-result .result-scene').waitFor();
    assert.equal(await page.locator('#screen-result .result-scene').getAttribute('data-scene'), 'S2', 'results start with the first zone');
    assert.equal(await page.locator('#screen-inspect').evaluate((e) => e.innerHTML.trim()), '', 'inspect DOM cleared');
    for (let i = 0; i < 4; i++) await page.locator('#btn-next').click();
    // 6) 임무 완료 요약
    await page.locator('#btn-skip').click(); await passCity(page); await page.locator('#btn-skip').click();
    await page.locator('#screen-outro').waitFor({ state: 'visible' });
    const sum = await page.locator('#outro-summary').innerText();
    assert.match(sum, /첫 제출에서 놓친 장면: 없음/);
    assert.match(sum, /보충 달리기: 0번/);
    assert.doesNotMatch(sum, /이름표/, 'm1 has no relabelling');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 6) 2 임무 요약: 놓친 장면 이름 · 보충 횟수 · 고친 이름표 수
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.App.debugFill({ can_drink: 2, can_tin: 0, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2, f_receipt: 1 }); DR.Run.finishNow(); DR.config.maxSupplements = 0; });
    await page.locator('#screen-inspect').waitFor({ state: 'visible' });
    await page.locator('#inspect-grid .bag-card[data-key="f_receipt"] .bag-open').click();
    await page.locator('#inspect-zoom [data-relabel="trash"]').click();
    await page.keyboard.press('Escape');
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await page.locator('#screen-conveyor').waitFor({ state: 'visible' });
    await page.locator('#btn-cv-skip').click(); await page.locator('#btn-cv-next').click();
    for (let i = 0; i < 4; i++) await page.locator('#btn-next').click();
    await page.locator('#btn-skip').click(); await passCity(page); await page.locator('#btn-skip').click();
    await page.locator('#screen-outro').waitFor({ state: 'visible' });
    const sum = await page.locator('#outro-summary').innerText();
    assert.match(sum, /첫 제출에서 놓친 장면: 음료 캔과 통조림 캔/);
    assert.match(sum, /보충 달리기: 0번/);
    assert.match(sum, /고친 이름표: 1장/);
    assert.equal(await page.evaluate(() => DR.App.records.m2.fixedLabels), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('PASS polish');
