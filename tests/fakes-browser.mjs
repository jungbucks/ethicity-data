// 가짜 카드(spec §3): 달리기 — 같은 연출·첫 가짜에만 안내 한 줄·잡으면 가방에 / 검수·결과·보충 — 오염 문구·다시 제출
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const HINT = '그림이랑 이름표가 맞는지 봐!';
const stepUntil = (page, src, max = 8000) => page.evaluate(([src, max]) => {
  const f = new Function('p', 'items', 'cfg', src);
  for (let i = 0; i < max; i++) { const p = DR.Run.peek(); if (f(p, DR.Run.course().items, DR.config)) return true; DR.Run.step(0.02); }
  return false;
}, [src, max]);
const nextFake = (n) => `const fs = items.filter(i => i.kind==='card' && i.fakeId); const f = fs[${n}]; return !!f && f.z - p.runnerZ <= cfg.baseSpeed * cfg.catchLead * 2;`;

// 1) 첫 가짜에만 안내 한 줄
{
  const { browser, page, errors } = await openGame({ query: '?run=m1' });
  try {
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
    assert.equal(await page.evaluate(() => DR.Run.peek().fakeHintShown), false);
    assert.ok(await stepUntil(page, `return p.fakeHintShown;`), 'hint flag set');
    const at = await page.evaluate(() => {
      const p = DR.Run.peek(), f = DR.Run.course().items.find((i) => i.kind === 'card' && i.fakeId);
      return { d: f.z - p.runnerZ, limit: Math.max(p.speed, DR.config.baseSpeed) * DR.config.catchLead * 2 + 1 };
    });
    assert.ok(at.d > 0 && at.d <= at.limit, 'hint when the first fake comes near ' + JSON.stringify(at));
    assert.ok(await page.locator('#run-hint').isVisible(), 'hint visible');
    assert.equal(await page.locator('#run-hint').innerText(), HINT);
    // 두 번째 가짜에서는 다시 뜨지 않는다
    await page.evaluate(() => { document.getElementById('run-hint').textContent = 'X'; });
    assert.ok(await stepUntil(page, nextFake(1)), 'second fake near');
    await page.evaluate(() => { for (let i = 0; i < 30; i++) DR.Run.step(0.02); });
    assert.notEqual(await page.locator('#run-hint').innerText(), HINT, 'hint only once');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 2) 가짜도 보통 카드처럼 잡힌다(가방에 fakeId)
{
  const { browser, page, errors } = await openGame({ query: '?run=m1' });
  try {
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
    // 같은 레인 앞쪽에 다른 카드가 없는 가짜를 고른다
    const fake = await page.evaluate(() => {
      const items = DR.Run.course().items;
      return items.find((f) => f.kind === 'card' && f.fakeId &&
        !items.some((o) => o !== f && o.kind !== 'fire' && o.lane === f.lane && o.z < f.z && f.z - o.z < 20));
    });
    assert.ok(fake, 'a clear fake');
    assert.ok(await stepUntil(page, `return ${fake.z} - p.runnerZ < 25;`), 'approach');
    // 레인 이동이 안 먹으면 무한 반복 대신 실패(시계를 멈춘 채 키가 들어가야 함)
    for (let p = await page.evaluate(() => DR.Run.peek()), n = 0; p.lane !== fake.lane; p = await page.evaluate(() => DR.Run.peek()), n++) {
      assert.ok(n < 4, 'lane keys move the runner while the clock is frozen');
      await page.keyboard.press(p.lane < fake.lane ? 'ArrowRight' : 'ArrowLeft');
      await page.evaluate(() => DR.Run.step(0.02));
    }
    assert.ok(await stepUntil(page, `return ${fake.z} - p.runnerZ < p.speed * cfg.catchLead * 0.5;`), 'in window');
    await page.keyboard.press('Space');
    await page.evaluate(() => { for (let i = 0; i < 5; i++) DR.Run.step(0.02); DR.Run.finishNow(); });
    await page.waitForFunction(() => window.__runResult, null, { timeout: 4000 });
    const grabbed = await page.evaluate(() => window.__runResult.grabbed);
    assert.ok(grabbed.some((g) => g.uid === fake.uid && g.fakeId === fake.fakeId), JSON.stringify(grabbed));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 3) debugFill로 가짜를 넣으면 검수 격자에 보인다
{
  const { browser, page, errors } = await openGame({ query: '?start=m1' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.App.debugFill({ f_pool: 2 }); DR.Run.finishNow(); });
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 4000 });
    assert.equal(await page.locator('#inspect-grid .bag-card[data-key="f_pool"]').count(), 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// ---------- 검수·결과·보충(spec §3.3·§3.5) ----------
const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };
const POOL = "우리가 넣은 데이터에 수영장 사진이 '깊은 침수'로 섞여 들어갔다.";
const FOUNTAIN = "우리가 넣은 데이터에 분수 광장 사진이 '얕은 침수'로 섞여 들어갔다.";
async function toInspect(page, counts) {
  await page.locator('#btn-skip').click();
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, counts);
  await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 4000 });
}
async function readResults(page) {
  const out = [];
  while (await page.locator('#screen-result .result-scene').count()) {
    const s = page.locator('#screen-result .result-scene');
    out.push({ scene: await s.getAttribute('data-scene'), outcome: await s.getAttribute('data-outcome'), contam: await page.locator('#screen-result p.contam').allInnerTexts() });
    await page.locator('#btn-next').click();
  }
  return out;
}
// 빈칸 2칸만 남는 28장: 흔한 카드 + 수영장 1 + 분수 1
const FULL = { ...ALL2, day_deep: 5, day_shallow: 5, night_wet: 4, f_pool: 1, f_fountain: 1 };

for (const viewport of [{ width: 1366, height: 900 }, { width: 375, height: 812 }]) {
  // contaminated scene → resubmit without run
  const { browser, page, errors } = await openGame({ viewport, query: '?start=m1' });
  try {
    await toInspect(page, FULL);
    // 장면 요약엔 조합 줄 아이콘(img)도 있다 — 카드 그림 줄(.scene-thumbs)만 센다
    assert.equal(await page.locator('#inspect-scenes [data-scene="S1"] .scene-thumbs img').count(), 12, 'S1 shows its cards and both fakes');
    await page.locator('#btn-submit').click();
    await page.locator('#btn-confirm').click();
    const res = await readResults(page);
    assert.deepEqual(res.map((r) => r.outcome), ['inconvenience', 'pass', 'pass', 'pass']);
    assert.deepEqual(res[0].contam, [POOL, FOUNTAIN]);
    assert.deepEqual(res[1].contam, []);
    // 보충 준비: 모자란 조합 없음 → 다시 제출(빈칸 조건 없음)
    assert.ok(await page.locator('#screen-prep').isVisible(), 'prep');
    assert.equal((await page.locator('#btn-supplement').innerText()).trim(), '다시 제출');
    assert.ok(await page.locator('#btn-supplement').isEnabled(), 'no slot condition');
    for (const k of ['f_pool', 'f_fountain']) await page.locator('#prep-grid .bag-card[data-key="' + k + '"] .btn-remove').click();
    await page.locator('#btn-supplement').click();
    assert.ok(await page.locator('#screen-supervisor').isVisible(), 'straight to supervisor');
    assert.equal(await page.evaluate(() => DR.Run.peek().running), false, 'no run');
    await page.locator('#btn-confirm').click();
    assert.ok((await readResults(page)).every((r) => r.outcome === 'pass'), 'all pass after resubmit');
    assert.equal(await page.evaluate(() => DR.App.state.supplements), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// resubmit still counts: 다시 제출로 보충을 다 쓰면 마무리로
{
  const { browser, page, errors } = await openGame({ query: '?start=m1' });
  try {
    await toInspect(page, FULL);
    await page.locator('#btn-submit').click();
    await page.locator('#btn-confirm').click();
    for (let n = 0; n < 2; n++) {
      await readResults(page);
      assert.equal((await page.locator('#btn-supplement').innerText()).trim(), '다시 제출');
      await page.locator('#btn-supplement').click();
      await page.locator('#btn-confirm').click();
    }
    await readResults(page);
    assert.equal(await page.evaluate(() => DR.App.state.supplements), 2);
    assert.ok(await page.locator('#screen-story').isVisible(), 'senior after max supplements');
    assert.equal(await page.locator('#screen-prep').isVisible(), false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// needs run when short: 모자란 조합이 있으면 기존 보충 달리기
{
  const { browser, page, errors } = await openGame({ query: '?start=m1' });
  try {
    await toInspect(page, { ...ALL2, day_deep: 0, f_pool: 2 });
    await page.locator('#btn-submit').click();
    await page.locator('#btn-confirm').click();
    const res = await readResults(page);
    assert.equal(res[0].outcome, 'danger');
    assert.deepEqual(res[0].contam, [POOL]);
    assert.equal((await page.locator('#btn-supplement').innerText()).trim(), '보충 달리기 출발');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

console.log('PASS fakes');
