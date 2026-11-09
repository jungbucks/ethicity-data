// 보충 달리기 누적 목표 + 동기 자리(교사 피드백 2026-11-09, docs/feedback/2026-11-09-m4-supplement-compare.md)
//   4 임무: 흘려 쓴 인공지능 1장만 + 아주 흘린 글씨 0장 → 결판 못 읽음 → 동기 4장 예약 → 보충 준비 '가방 4칸은 동기…' →
//   달리기 패널 '흘려 쓴 인공지능 1/2장' → 1장 잡으면 '2/2장 ✓' · 다 찬 자료(동기 카드로 찬 줄 포함)는 뒤에/한 줄로 · 가방 옆 '동기 자리 4칸'
//   1 임무: 보충 패널이 모습 이름으로(결과 뒤라 hideShapes와 겹치지 않음)
import assert from 'node:assert/strict';
import { openGame, passChapter, shotPath } from './browser.mjs';

const MIN = { neat_data: 1, neat_algo: 1, neat_ai: 1, neat_ml: 1, cur_ai: 2, cur_algo: 2, alt_ai: 2, alt_data: 2, alt_ml: 2, scrawl_ml: 2 };
const step = (page, n = 3) => page.evaluate((n) => { for (let i = 0; i < n; i++) DR.Run.step(0.02); }, n);

async function toPrep(page) {
  for (let n = 0; n < 40 && !(await page.locator('#screen-prep').isVisible()); n++) {
    if (await page.locator('#screen-result .result-scene').isVisible()) await page.locator('#btn-next').click();
    else if (await page.locator('#screen-story').isVisible()) await page.locator('#screen-story .dialog').click();
    else await page.waitForTimeout(200);
  }
  await page.locator('#screen-prep').waitFor({ state: 'visible', timeout: 4000 });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const w = viewport.width;
  const { browser, page, errors } = await openGame({ viewport, query: '?start=m4', hasTouch: w < 500 });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    // 첫 달리기엔 누적 패널·동기 자리 없음
    assert.equal(await page.locator('#run-need').count(), 0);
    assert.equal(await page.locator('#hud-peer').count(), 0);
    await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, { ...MIN, cur_ai: 1, scrawl_ml: 0 });
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 4000 });
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await page.locator('#screen-grade').waitFor({ state: 'visible' });
    await page.locator('#btn-gr-skip').click(); await page.locator('#btn-gr-next').click();
    await toPrep(page);
    // 보충 준비: 동기 자리 한 줄(4칸) + 가방 칸 셈
    const slots = await page.locator('#prep-slots').innerText();
    assert.match(slots, /^가방 4칸은 동기가 가져올 답안 자리예요\. 지금 가방 \d+장 · 동기 자리 4칸 · 빈칸 \d+칸\(모두 30칸\)\.$/);
    await page.screenshot({ path: shotPath('supp-prep-peer-' + w), fullPage: true });
    await page.locator('#btn-supplement').click();
    await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => DR.Run.setPaused(true));
    await step(page);
    // 가방 옆 동기 자리
    assert.equal((await page.locator('#hud-peer').innerText()).trim(), w > 650 ? '동기 자리 4칸' : '+4칸');
    // HUD가 한 줄(일시정지 버튼이 가방과 같은 줄) — 동기 자리가 HUD를 밀어내지 않는다
    const hudRow = await page.evaluate(() => [document.getElementById('hud-bag'), document.getElementById('btn-pause')].map((e) => Math.round(e.getBoundingClientRect().top)));
    assert.ok(Math.abs(hudRow[0] - hudRow[1]) < 12, 'one HUD row ' + hudRow);
    // 패널은 구역 칸 아래(가려지지 않음)
    const zb = await page.evaluate(() => document.getElementById('hud').getBoundingClientRect().bottom);
    assert.ok((await page.locator('#run-need').boundingBox()).y >= zb, 'panel below hud');
    assert.equal(await page.locator('#hud-peer').getAttribute('aria-label'), '가방 4칸은 동기가 가져올 답안 자리예요');
    assert.equal(await page.evaluate(() => DR.Run.peek().bagMax), 26);
    // 누적 패널: 모자란 줄 = 흘려 쓴 인공지능 1/2장(가방 1장 포함) 하나
    const shortItems = page.locator('#run-need .run-need-short .run-need-item');
    assert.equal(await shortItems.count(), 1);
    assert.equal((await shortItems.first().innerText()).replace(/\s+/g, ' ').trim(), '흘려 쓴 인공지능 1/2장');
    assert.equal(await page.locator('#run-need-peer').innerText(), '가방 4칸은 동기가 가져올 답안 자리예요');
    // 구역 칸 = 이번에 모은 것만(누적은 패널)
    for (const t of await page.locator('.zone-count').allInnerTexts()) assert.match(t, /^이번 \d+장$/);
    if (w > 650) {
      const done = await page.locator('#run-need .run-need-done').innerText();
      assert.match(done, /✓ 또박또박 쓴 답안/);
      assert.match(done, /✓ 아주 흘려 쓴 머신러닝 \(동기 카드로\)/);
      assert.equal(await page.locator('.run-need-donesum').isVisible(), false);
    } else {
      assert.equal(await page.locator('#run-need .run-need-done').isVisible(), false);
      assert.match(await page.locator('.run-need-donesum').innerText(), /^다 찬 자료 \d+개는 더 안 담아도 돼요$/);
    }
    // 패널·동기 자리가 화면 안
    const box = await page.locator('#run-need').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= w && box.y >= 0, JSON.stringify(box));
    await page.screenshot({ path: shotPath('supp-need-before-' + w) });
    // 흘려 쓴 인공지능 1장을 잡으면 2/2장 ✓
    await page.evaluate(() => DR.App.debugFill({ cur_ai: 1 }));
    await step(page);
    assert.equal((await shortItems.first().innerText()).replace(/\s+/g, ' ').trim(), '흘려 쓴 인공지능 2/2장 ✓');
    assert.match(await shortItems.first().getAttribute('class'), /\bdone\b/);
    assert.equal(await page.locator('.run-need-head').innerText(), '다 모았어요! 결승선까지 달려요');
    // 잡기 알림이 패널을 가리지 않는다(좁은 화면은 패널 아래, 넓은 화면은 오른쪽)
    const nb = await page.locator('#run-need').boundingBox(), cb = await page.locator('.catch-notice').boundingBox();
    assert.ok(cb.y >= nb.y + nb.height || cb.x >= nb.x + nb.width, 'notice clear of panel ' + JSON.stringify([nb, cb]));
    await page.screenshot({ path: shotPath('supp-need-after-' + w) });
    // "?" 카드는 세지 않고 따로
    const hasQ = await page.evaluate(() => DR.Run.course().items.some((i) => i.ambiguousId && !DR.Run.isTaken(i.uid)));
    if (hasQ) {
      await page.evaluate(() => { const it = DR.Run.course().items.find((i) => i.ambiguousId && !DR.Run.isTaken(i.uid)); DR.Run.debugTake(it.uid); });
      await step(page);
      assert.match(await page.locator('.run-need-unknown').innerText(), /^"\?" 카드 1장 · 검수에서 정하기$/);
    }
    await page.evaluate(() => { DR.Run.setPaused(false); DR.Run.finishNow(); });
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 4000 });
    // 달리기를 떠나면 동기 자리 표시도 사라진다
    assert.equal(await page.locator('#hud-peer').count(), 0);
    console.log('ok m4 supplement', w);

    // 이어서 끝까지 → 임무 완료 화면: 같은 답안지 전후 비교(교사 피드백 2026-11-09)
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await page.locator('#screen-grade').waitFor({ state: 'visible' });
    await page.locator('#btn-gr-skip').click(); await page.locator('#btn-gr-next').click();
    for (let n = 0; n < 80 && !(await page.locator('#screen-outro').isVisible()); n++) {
      if (await page.locator('#screen-result .result-scene').isVisible()) await page.locator('#btn-next').click();
      else if (await page.locator('#screen-city').isVisible()) { await page.waitForTimeout(400); await page.keyboard.press('Enter'); await page.locator('#btn-city-next').click(); }
      else if (await page.locator('#screen-chapter').isVisible()) await passChapter(page);
      else if (await page.locator('#screen-story').isVisible()) await page.locator('#screen-story .dialog').click();
      else await page.waitForTimeout(200);
    }
    await page.locator('#screen-outro').waitFor({ state: 'visible', timeout: 4000 });
    const rows = page.locator('#outro-compare tbody tr');
    const ids = await rows.evaluateAll((t) => t.map((r) => r.dataset.id + ':' + r.dataset.kind));
    assert.deepEqual(ids, ['gr4:changed', 'gr11:changed', 'gr1:control']);
    const gr4 = page.locator('#outro-compare tr[data-id="gr4"] td');
    assert.equal(await gr4.count(), 4);
    assert.equal(await gr4.nth(1).innerText(), '✕ 알고리즘으로 읽음');
    assert.equal(await gr4.nth(2).innerText(), '흘려 쓴 인공지능 1장 → 2장');
    assert.equal(await gr4.nth(3).innerText(), '○ 인공지능으로 읽음');
    assert.equal(await page.locator('#outro-compare tr[data-id="gr11"] td').nth(2).innerText(), '아주 흘려 쓴 머신러닝 0장 → 2장(동기 카드 2장)');
    assert.equal(await page.locator('#outro-compare tr[data-id="gr4"] img').evaluate((i) => i.naturalWidth > 0), true);
    assert.equal(await page.locator('.cmp-human').innerText(), '같은 답안지인데 결과가 바뀌었다. 어떤 자료를 고칠지는 AI가 아니라 사람이 정했다.');
    // 좁은 화면 = 카드(머리줄 숨김), 넓은 화면 = 표 머리줄. 가로로 넘치지 않음
    assert.equal(await page.locator('#outro-compare thead').isVisible(), w > 520);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll');
    await page.locator('#outro-compare').scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('supp-compare-' + w), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('ok m4 compare', w);
  } finally { await browser.close(); }
}

// 1 임무: 접힌 우산만 부족 → 보충 패널은 모습 이름(결과 뒤)
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor();
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.App.debugFill({ umbrella_open: 3, umbrella_folded: 1, wallet_closed: 3, wallet_open: 3, phone_front: 3, phone_back: 3 }); DR.Run.finishNow(); });
    await page.locator('#screen-inspect').waitFor({ state: 'visible' });
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await page.locator('#screen-conveyor').waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('#btn-cv-skip').click(); await page.locator('#btn-cv-next').click();
    await toPrep(page);
    assert.equal(await page.locator('#prep-slots').count(), 0, 'no peer outside m4');
    await page.locator('#btn-supplement').click();
    await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => DR.Run.setPaused(true));
    await step(page);
    const items = page.locator('#run-need .run-need-short .run-need-item');
    assert.equal(await items.count(), 1);
    assert.equal((await items.first().innerText()).replace(/\s+/g, ' ').trim(), '접힌 우산 1/3장');
    assert.equal(await page.locator('#hud-peer').count(), 0);
    assert.match(await page.locator('#run-need .run-need-done').innerText(), /✓ 펼친 우산/);
    assert.deepEqual(errors, []);
    console.log('ok m1 supplement');
  } finally { await browser.close(); }
}
