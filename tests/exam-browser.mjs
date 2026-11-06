// 2026-11-06 첫 시험: 이름표 틀린 카드 → 검수에서 고치기 → 시연 / 연습 카드 / 부족+오류 / 키보드·375px / 옛 저장
import assert from 'node:assert/strict';
import { openGame, passCity, shotPath } from './browser.mjs';

const toRun = async (page) => {
  await page.locator('#btn-practice').click();
  await page.locator('#btn-skip').click(); // 오프닝
  await page.locator('#btn-run').click();
  await page.locator('#btn-goal-start').click();
  await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 8000 });
};
// 이름표 틀린 카드(개 사진 → 고양이 이름표)를 진짜로 담은 가방: 개 4장 + 그 카드 + 고양이 5장
const takeFake = (page) => page.evaluate(() => {
  const items = DR.App.course.items, f = items.find((i) => i.fakeId === 'f_dog_as_cat');
  DR.App.debugFill({ dog: 4, cat: 5 }); DR.Run.debugTake(f.uid); DR.Run.finishNow();
  return f.uid;
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  const { browser, page, errors } = await openGame({ viewport });
  try {
    await toRun(page);
    const uid = await takeFake(page);
    // 검수: 경고·오답 수 없이 사진과 이름표만
    await page.locator('#screen-inspect').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.exam-card').count(), 10);
    assert.equal(await page.locator('#exam-drill').count(), 0, '틀린 카드를 가져왔으면 연습 카드 없음');
    assert.doesNotMatch(await page.locator('#screen-inspect').innerText(), /틀린|오답|\d장이 잘못/);
    assert.equal(await page.locator(`.exam-card[data-id="${uid}"] .exam-tag`).innerText(), '고양이');
    await page.screenshot({ path: shotPath('exam-inspect-' + viewport.width) });
    // 그대로 제출 → 시연: 사진은 개, AI는 고양이
    await page.locator('#btn-submit').click();
    await page.locator('#exam-pairs').waitFor();
    assert.equal(await page.locator('.exam-pair.wrong').count(), 1);
    assert.match(await page.locator('.exam-pair.wrong').innerText(), /AI: 고양이입니다/);
    assert.match(await page.locator('#screen-result').innerText(), /이 사진은 개인데, 고양이라고 가르쳤네/);
    assert.match(await page.locator('#exam-points').innerText(), /시험용 자료 점검/);
    assert.match(await page.locator('#exam-note').innerText(), /단순화된 시뮬레이션/);
    assert.equal(await page.locator('#btn-retry').count(), 0, '이름표만 틀리면 다시 달리지 않는다');
    await page.screenshot({ path: shotPath('exam-demo-' + viewport.width) });
    // 고치기 → 키보드로 카드 열고 이름표 선택 → 같은 사진 다시 시연
    await page.locator('#btn-fix').click();
    await page.locator(`.exam-card[data-id="${uid}"]`).focus();
    await page.keyboard.press('Enter');
    await page.locator('dialog.modal').waitFor();
    assert.match(await page.locator('#exam-first-hint').innerText(), /사진 속 동물과 이름표가 같은지 봐/);
    assert.match(await page.locator('#exam-now').innerText(), /고양이/);
    if (viewport.width === 375) await page.screenshot({ path: shotPath('exam-card-375') });
    await page.locator('#btn-label-dog').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction((u) => document.activeElement && document.activeElement.dataset.id === u, uid);
    assert.equal(await page.locator(`.exam-card[data-id="${uid}"] .bag-fixed`).innerText(), '고침');
    await page.locator('#btn-submit').click();
    await page.locator('.exam-pair.fixed').waitFor();
    assert.match(await page.locator('.exam-pair.fixed').innerText(), /AI: 개입니다/);
    assert.equal(await page.evaluate(() => DR.App.state.bag.length), 10, '가방 유지');
    await page.locator('#btn-next').click();
    await page.locator('#screen-story').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '가로 넘침 없음');
    assert.deepEqual(errors, []);
    console.log('ok fake card fixed', viewport.width);
  } finally { await browser.close(); }
}

// 틀린 카드를 안 가져옴 → 연습 카드(가방 밖). 고친 뒤 시연, 합격 판정에 안 들어감
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 } });
  try {
    await toRun(page);
    await page.evaluate(() => { DR.App.debugFill({ dog: 5, cat: 5 }); DR.Run.finishNow(); });
    await page.locator('#exam-drill').waitFor();
    assert.equal(await page.locator('#exam-grid .exam-card').count(), 10, '연습 카드는 가방 격자 밖');
    await page.locator('#btn-submit').click();
    await page.locator('.exam-pair.wrong').waitFor();
    assert.match(await page.locator('#exam-check').innerText(), /이름표가 맞는 카드 10 \/ 10장/, '연습 카드는 점검 수에 없음');
    await page.locator('#btn-fix').click();
    await page.locator('#exam-drill .exam-card').click();
    await page.locator('#btn-label-dog').click();
    await page.locator('#btn-submit').click();
    await page.locator('.exam-pair.fixed').waitFor();
    await page.locator('#btn-next').waitFor();
    assert.deepEqual(errors, []);
    console.log('ok drill card');
  } finally { await browser.close(); }
}

// 부족 + 이름표 오류 → 잘못된 쌍 먼저, 부족 안내, 다시 수집은 가방을 비운다고 알림 / 이름표를 바꿔도 사진 수는 그대로
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 } });
  try {
    await toRun(page);
    await page.evaluate(() => { const f = DR.App.course.items.find((i) => i.fakeId === 'f_dog_as_cat'); DR.App.debugFill({ dog: 5, cat: 2 }); DR.Run.debugTake(f.uid); DR.Run.finishNow(); });
    await page.locator('#btn-submit').click();
    await page.locator('.exam-pair.wrong').waitFor();
    const t = await page.locator('#screen-result').innerText();
    assert.ok(t.indexOf('가르쳤네') < t.indexOf('더 필요해'), '오류를 먼저');
    assert.match(t, /고양이 사진 3장이 더 필요해/);
    assert.match(await page.locator('#exam-retry-note').innerText(), /가방을 비우고/);
    assert.match(await page.locator('#exam-check').innerText(), /개 사진 6 \/ 5장/, '이름표가 고양이여도 사진은 개');
    await page.locator('#btn-retry').click();
    await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => DR.App.state.bag.length === 0 || DR.Run.peek().bagCount === 0), true);
    assert.deepEqual(errors, []);
    console.log('ok short and mislabeled');
  } finally { await browser.close(); }
}

// 옛 튜토리얼 저장 → 시험 시작으로, 옛 침수 도중 저장 → 새 1 임무 브리핑(다른 기록 유지)
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 } });
  try {
    await page.evaluate(() => { DR.Save.setRecord('m2', { cleared: true, passed: true }); DR.Save.checkpoint('inspect', { mission: 'm1', bag: [{ id: 'c1', key: 'day_deep' }], supplements: 1, firstTry: false, seed: 1101, needRevealed: true, firstFails: [{ scene: 'S1', title: '낮 주택가 골목', kind: 'danger' }] }, {}); });
    await page.reload();
    await page.locator('#btn-continue').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible', timeout: 5000 });
    const st = await page.evaluate(() => ({ bag: DR.App.state.bag.length, need: DR.App.state.needRevealed, rec: DR.Save.records ? !!DR.Save.records().m2 : true }));
    assert.deepEqual(st, { bag: 0, need: false, rec: true });
    assert.match(await page.locator('#screen-briefing').innerText(), /오늘 접수대에 들어온 물건/);
    assert.deepEqual(errors, []);
    console.log('ok old flood save');
  } finally { await browser.close(); }
}
console.log('PASS exam');
