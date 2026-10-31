// 1 임무 흐름: 검수·감독관·결과(실패 종류)·"?" 미결정·보충(빈칸)·선배·마무리
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };

async function toRun(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
}
async function fillAndFinish(page, counts) {
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, counts);
}
async function submitAndConfirm(page) {
  await page.locator('#btn-submit').click();
  await page.locator('#btn-confirm').click();
}
// 결과 장면을 끝까지 넘기며 [{scene, outcome, text}] 수집
async function readResults(page) {
  const out = [];
  while (await page.locator('#screen-result .result-scene').count()) {
    const s = page.locator('#screen-result .result-scene');
    out.push({ scene: await s.getAttribute('data-scene'), outcome: await s.getAttribute('data-outcome'), text: await page.locator('#screen-result').innerText() });
    await page.locator('#btn-next').click();
  }
  return out;
}

for (const viewport of [{ width: 1366, height: 900 }, { width: 375, height: 812 }]) {
  const big = viewport.width > 500;

  // 시나리오 A — 흔한 카드만
  {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m1' });
    try {
      await page.locator('#btn-skip').click();
      assert.equal(await page.locator('#screen-briefing .brief-scene').count(), 4);
      assert.equal(await page.locator('#screen-briefing .brief-scene').nth(3).getAttribute('data-emphasis'), 'low');
      await page.locator('#btn-run').click();
      await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
      await fillAndFinish(page, { day_deep: 11, day_shallow: 9 });
      assert.ok(await page.locator('#screen-inspect').isVisible(), 'inspect');
      assert.equal(await page.locator('#inspect-grid .bag-card').count(), 20);
      assert.ok(!/\d+\s*\/\s*\d+|%/.test(await page.locator('#inspect-scenes').innerText()), 'no counts in scene summary');
      if (!big) await page.screenshot({ path: shotPath('inspect-375') });
      await page.locator('#btn-submit').click();
      assert.ok(await page.locator('#screen-supervisor').isVisible(), 'supervisor');
      await page.locator('#btn-back').click();
      assert.ok(await page.locator('#screen-inspect').isVisible(), 'back to inspect');
      await submitAndConfirm(page);
      const first = page.locator('#screen-result .result-scene');
      await first.waitFor();
      if (big) await page.screenshot({ path: shotPath('result-1366') });
      const res = await readResults(page);
      // S3 정답은 '젖었을 뿐' — 밤 깊은 침수 예시가 빠져도 길을 막는 불편(m1.js S3_night_deep.fail, judge.test 'S3: …')
      assert.deepEqual(res.map((r) => [r.scene, r.outcome]), [['S1', 'pass'], ['S2', 'inconvenience'], ['S3', 'inconvenience'], ['S4', 'danger']]);
      const resp = await page.evaluate(() => DR.Missions.m1.story.responsibility);
      assert.ok(res[3].text.includes(resp), 'responsibility line on danger');
      assert.ok(res.every((r) => !r.text.includes('%')), 'no percent');
      assert.ok(res[3].text.includes('우리가 넣은 데이터에는'), 'cause line');
      assert.ok(await page.locator('#screen-prep').isVisible(), 'prep after fail');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }

  // 시나리오 B — "?" 카드를 정하지 않고 제출
  {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m1' });
    try {
      await toRun(page);
      await fillAndFinish(page, { ...ALL2, q_neon: 1 });
      assert.ok(await page.locator('#inspect-undecided').isVisible(), 'undecided notice');
      assert.match(await page.locator('#inspect-undecided').innerText(), /1장/);
      // "?" 카드를 열면 단서와 설명표 버튼이 있다
      await page.locator('#inspect-grid .bag-card.ambiguous .bag-open').click();
      assert.ok(await page.locator('#inspect-zoom').isVisible(), 'zoom');
      assert.ok(await page.locator('#inspect-zoom .clue').count() >= 2, 'clues');
      assert.equal(await page.locator('#inspect-zoom [data-label]').count(), 5);
      await page.keyboard.press('Escape');
      assert.ok(!(await page.locator('#inspect-zoom').isVisible()), 'zoom closed');
      await submitAndConfirm(page);
      await page.locator('#screen-result .result-scene').waitFor();
      const j = await page.evaluate(() => DR.App.lastJudge);
      assert.deepEqual(j.mislabeled, []);
      assert.equal(j.allPass, true);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }

  // 시나리오 C — S4만 위험 실패 → 보충
  {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m1' });
    try {
      await toRun(page);
      await fillAndFinish(page, { ...ALL2, night_shallow: 0, night_muddy: 0, day_deep: 11, day_shallow: 9 });
      await submitAndConfirm(page);
      await page.locator('#screen-result .result-scene').waitFor();
      const res = await readResults(page);
      assert.deepEqual(res.map((r) => r.outcome), ['pass', 'pass', 'pass', 'danger']);
      assert.ok(await page.locator('#screen-prep').isVisible(), 'prep');
      assert.ok(await page.locator('#btn-supplement').isDisabled(), 'needs free slots');
      for (let i = 0; i < 6; i++) await page.locator('#prep-grid .bag-card[data-key="day_deep"] .btn-remove').first().click();
      assert.ok(await page.locator('#btn-supplement').isEnabled(), 'enabled after freeing 6');
      await page.locator('#btn-supplement').click();
      await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
      // 부족분(각 2장) × 1.5 = 3장씩 + 흔한 카드 4장
      const focus = await page.evaluate(() => DR.App.course.items.filter((i) => i.kind === 'card' && i.key).map((i) => i.key));
      assert.equal(focus.length, 10);
      for (const k of ['night_shallow', 'night_muddy']) assert.ok(focus.filter((x) => x === k).length >= 3, 'supplement focus ' + k);
      await fillAndFinish(page, { night_shallow: 2, night_muddy: 2 });
      // 보충 뒤에도 검수를 거친다 — 새로 담은 4장에 NEW(app.js prepSupplement → review)
      assert.ok(await page.locator('#screen-inspect').isVisible(), 'inspect after supplement');
      assert.equal(await page.locator('#inspect-grid .bag-card.is-new').count(), 4, 'NEW on fresh cards');
      await page.locator('#btn-submit').click();
      assert.ok(await page.locator('#screen-supervisor').isVisible(), 'supervisor after supplement');
      await page.locator('#btn-confirm').click();
      await page.locator('#screen-result .result-scene').waitFor();
      const res2 = await readResults(page);
      assert.ok(res2.every((r) => r.outcome === 'pass'), 'all pass after supplement');
      const senior = await page.evaluate(() => DR.Missions.m1.story.senior[0].text);
      assert.ok((await page.locator('#screen-story').innerText()).includes(senior), 'senior cameo');
      await page.locator('#btn-skip').click();
      await page.locator('#btn-skip').click();
      assert.ok(await page.locator('#screen-outro').isVisible(), 'outro');
      assert.ok((await page.locator('#screen-outro').innerText()).includes('단순화한 규칙'));
      assert.deepEqual(await page.evaluate(() => DR.App.state.record), { firstTry: false, supplements: 1 });
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
}
console.log('PASS m1');
