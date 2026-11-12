// '처음부터'가 저장되지 않을 때(리뷰 2026-11-12): 사실대로 알리고, 새 진행에 옛 기록이 섞이지 않는다 — 단위 검사는 reset.test.mjs
//   A stale(쓰기·지우기 막힘): 안내 → 같은 탭은 새 진행 → 저장이 풀리면 옛 기록이 바뀜 / B 막힌 채 새로고침 = 옛 기록이 다시 보임(안내한 대로)
//   C unsaved(쓰기만 막힘): 옛 기록은 지워짐 → 안내 → 새로고침 = 처음 화면 / D 정상: 안내 없음
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const KEY = 'ethicity.data.save';
const OLD = { v: 1, cityV: 1, mission: null, tutorialDone: true, records: { tutorial: { cleared: true }, m1: { cleared: true, firstTry: true, supplements: 0, firstFails: [] } } };

// 옛 기록을 심고, 막을 동작(mode: 'stale' | 'unsaved' | '')을 정해 다시 연다. 막기는 페이지가 뜨기 전에(addInitScript) 건다
async function open(mode, viewport) {
  const g = await openGame({ viewport: viewport || { width: 1280, height: 800 } });
  await g.page.emulateMedia({ reducedMotion: 'reduce' });
  await g.page.addInitScript(() => {
    let mode = '';
    try { mode = sessionStorage.getItem('__block') || ''; } catch (e) { /* 무시 */ }
    const P = Storage.prototype, set = P.setItem, remove = P.removeItem;
    window.__unblock = () => { P.setItem = set; P.removeItem = remove; };
    if (!mode) return;
    P.setItem = function () { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
    if (mode === 'stale') P.removeItem = function () { throw new Error('SecurityError'); };
  });
  await g.page.evaluate(([k, v, m]) => { localStorage.setItem(k, JSON.stringify(v)); if (m) sessionStorage.setItem('__block', m); else sessionStorage.removeItem('__block'); }, [KEY, OLD, mode]);
  await g.page.reload();
  await g.page.locator('#btn-fresh').waitFor({ state: 'visible', timeout: 30000 });
  return g;
}
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
async function reset(page) {
  await page.locator('#btn-fresh').click();
  await page.getByRole('button', { name: '튜토리얼 건너뛰기' }).click();
}

/* A·B stale */
{
  const { browser, page, errors } = await open('stale');
  try {
    assert.equal(await page.locator('#btn-resume-next').innerText(), '두 번째 임무부터 이어하기');
    assert.equal(await page.locator('#mc-m1-status').innerText(), '완료');
    await reset(page);
    const note = page.locator('#reset-fail');
    await note.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('dialog[open] h2').innerText(), '예전 기록을 지우지 못했어요');
    assert.match(await note.innerText(), /이 탭에서는 처음부터 새로 해요.*이 기기에는 예전 기록이 남아 있어서.*새로고침하면 예전 기록이 다시 보여요/);
    assert.doesNotMatch(await note.innerText(), /지워졌|지웠어요/);
    assert.equal(await page.locator('dialog[open]').count(), 1, 'the confirm dialog is gone');
    await page.screenshot({ path: shotPath('reset-fail-stale-1280') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'no sideways scroll');
    await page.screenshot({ path: shotPath('reset-fail-stale-390') });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#btn-reset-fail-go').click();
    await page.waitForFunction(() => DR.App.state && DR.App.state.mission === 'm1', null, { timeout: 5000 });
    // 새 진행: 메모리도 저장 모듈도 비어 있다. 저장소엔 옛 기록 그대로
    assert.deepEqual(await page.evaluate(() => DR.App.records), {});
    assert.deepEqual(await page.evaluate(() => DR.Save.records()), {});
    assert.equal(await page.evaluate(() => DR.Save.status()), 'stale');
    assert.ok((await stored(page)).records.m1.cleared, 'storage still holds the old record');
    // 같은 탭에서 타이틀로: 옛 완료 표시가 없다, 튜토리얼 완료는 남아 첫 번째 임무부터
    await page.evaluate(() => { DR.Save.checkpoint('briefing', DR.App.state, {}); DR.App.go('title'); });
    assert.equal(await page.locator('#mc-m1-status').innerText(), '진행 중');
    assert.equal(await page.locator('#mc-practice-status').innerText(), '완료');
    assert.equal(await page.locator('#title-progress').innerText(), '첫 번째 임무 · 브리핑부터');
    await page.screenshot({ path: shotPath('reset-fail-title-1280') });
    // 저장이 풀림 → 다음 저장이 옛 기록을 통째로 바꾼다
    await page.evaluate(() => { window.__unblock(); DR.Save.checkpoint('briefing', DR.App.state, {}); });
    const now = await stored(page);
    assert.deepEqual(now.records, {}, 'old m1 record replaced, not merged');
    assert.equal(now.mission, 'm1'); assert.equal(now.tutorialDone, true);
    assert.equal(await page.evaluate(() => DR.Save.status()), 'ok');
    // 새로고침(이제 저장됨): 새 진행만
    await page.evaluate(() => sessionStorage.removeItem('__block'));
    await page.reload();
    await page.locator('#btn-continue').waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await page.locator('#mc-m1-status').innerText(), '진행 중');
    assert.deepEqual(await page.evaluate(() => DR.App.records), {});
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
{
  // B 끝내 저장이 안 된 채 새로고침: 안내한 대로 옛 기록이 다시 보인다
  const { browser, page, errors } = await open('stale');
  try {
    await reset(page);
    await page.locator('#btn-reset-fail-go').click();
    await page.waitForFunction(() => DR.App.state && DR.App.state.mission === 'm1', null, { timeout: 5000 });
    await page.reload();
    await page.locator('#btn-resume-next').waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await page.locator('#btn-resume-next').innerText(), '두 번째 임무부터 이어하기');
    assert.equal(await page.locator('#mc-m1-status').innerText(), '완료');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

/* C unsaved */
{
  const { browser, page, errors } = await open('unsaved');
  try {
    await reset(page);
    const note = page.locator('#reset-fail');
    await note.waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('dialog[open] h2').innerText(), '지금은 저장이 안 돼요');
    assert.match(await note.innerText(), /예전 기록은 지웠어요.*새 진행이 저장되지 않아서.*이 탭을 닫으면 처음으로 돌아가요/);
    assert.equal(await stored(page), null, 'the old record is really gone');
    await page.screenshot({ path: shotPath('reset-fail-unsaved-1280') });
    await page.keyboard.press('Escape'); // Esc로 닫아도 고른 대로 시작한다
    await page.waitForFunction(() => DR.App.state && DR.App.state.mission === 'm1', null, { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => DR.Save.records()), {});
    await page.reload();
    await page.locator('#btn-start').waitFor({ state: 'visible', timeout: 30000 });
    assert.deepEqual(await page.evaluate(() => DR.App.records), {});
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

/* D 정상 */
{
  const { browser, page, errors } = await open('');
  try {
    await reset(page);
    await page.waitForFunction(() => DR.App.state && DR.App.state.mission === 'm1', null, { timeout: 5000 });
    assert.equal(await page.locator('#reset-fail').count(), 0, 'no notice when the reset was saved');
    assert.deepEqual(await stored(page), { v: 1, mission: null, tutorialDone: true, cityV: 1 });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('reset-browser ok');
