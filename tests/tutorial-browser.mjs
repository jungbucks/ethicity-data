// 튜토리얼 흐름: 타이틀 → 대화 → 브리핑(수집 목록 없음) → 달리기 → 귀여운 실패 → 다시 → 통과 → 시험관 → 1 임무 대화
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

for (const viewport of [{ width: 1366, height: 900 }, { width: 375, height: 812 }]) {
  const { browser, page, errors } = await openGame({ viewport });
  const visible = (id) => page.locator('#screen-' + id).isVisible();
  const finishWith = async (counts) => {
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, counts);
  };
  try {
    const tut = await page.evaluate(() => DR.Missions.tutorial);
    await page.locator('#btn-start').click();
    // 프롤로그: 러너 프로필 + 독백
    assert.ok(await visible('profile'), 'profile after start');
    const pro = await page.evaluate(() => DR.Prologue);
    assert.ok((await page.locator('#screen-profile').innerText()).includes(pro.lines[0]), 'first monologue line');
    assert.ok((await page.locator('#screen-profile .profile-card').innerText()).includes('러너 자격 시험'), 'profile card');
    const nLines = pro.lines.length;
    // 줄이 떠오르는 중에 누르면 그 줄을 다 보이게만 하고(클릭을 버리지 않음), 다 보이면 다음 — 줄마다 최대 두 번
    for (let i = 0; i < nLines * 2 + 2 && await visible('profile'); i++) await page.locator('#screen-profile .mono').click();
    assert.ok(await visible('story'), 'story after prologue');
    assert.match(await page.locator('#screen-story').innerText(), new RegExp(tut.story.intro[0].text.slice(0, 8)));
    await page.locator('#btn-skip').click();

    assert.ok(await visible('briefing'), 'briefing');
    assert.equal(await page.locator('#screen-briefing .brief-scene').count(), 1);
    const brief = await page.locator('#screen-briefing').innerText();
    assert.ok(brief.includes(tut.story.guideBrief.slice(0, 10)), 'guide brief');
    assert.ok(!/\d+\s*장|필요/.test(brief), 'no collection list');
    if (viewport.width === 375) await page.screenshot({ path: shotPath('briefing-375') });
    await page.locator('#btn-run').click();

    assert.ok(await visible('run'), 'run');
    // 달리는 카드 그림 = 개·고양이 사진(카드 번호 % 8, 개 → d01~d08 · 고양이 → c01~c08), 이름표는 코드가 얹음
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelectorAll('.run-card:not([hidden]) img').length >= 2, null, { timeout: 30000 });
    const runCards = await page.evaluate(() => [...document.querySelectorAll('.run-card')].map((c) => {
      const it = DR.App.course.items.find((i) => i.uid === c.dataset.uid);
      return { key: it.key, n: +it.uid.slice(1), photo: c.querySelector('img').dataset.photo, label: c.querySelector('.run-card-label').textContent };
    }));
    for (const c of runCards) {
      assert.equal(c.photo, (c.key === 'dog' ? 'd0' : 'c0') + (c.n % 8 + 1), 'run card photo ' + JSON.stringify(c));
      assert.ok(c.label.length > 0, 'label drawn on top');
    }
    await page.screenshot({ path: shotPath('run-tutorial-' + viewport.width) });
    await finishWith({ dog: 8 });
    assert.ok(await visible('result'), 'result after fail');
    assert.ok((await page.locator('#screen-result').innerText()).includes(tut.story.fail[0].text.slice(0, 8)), 'cute fail');
    await page.locator('#btn-retry').click();
    assert.ok(await visible('run'), 'run again');
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => DR.Run.peek().bagCount), 0, 'bag emptied');

    await finishWith({ dog: 3, cat: 3 });
    assert.ok(await visible('result'), 'result after pass');
    assert.equal(await page.locator('#btn-retry').count(), 0);
    await page.locator('#btn-next').click();
    assert.ok(await visible('story'), 'examiner outro');
    assert.ok((await page.locator('#screen-story').innerText()).includes('데이터 판단은'), 'examiner line');
    await page.locator('#btn-skip').click();
    // 도시 복구 0 → 1/5(마무리 대화 뒤, 1 임무 도입 전)
    assert.ok(await visible('city'), 'city screen after the tutorial');
    assert.match(await page.locator('#city-line').innerText(), /^도시 1\/5 — 데이터 러너가 처음 길을 냈다$/);
    await page.waitForFunction(() => document.querySelectorAll('#screen-city .city-dots i.on').length === 1);
    await page.screenshot({ path: shotPath('city-tutorial-' + viewport.width) });
    await page.locator('#btn-city-next').click();
    const m1 = await page.evaluate(() => DR.Missions.m1.story.intro[0].text);
    assert.ok(await visible('story'), 'm1 intro');
    assert.ok((await page.locator('#screen-story').innerText()).includes(m1.slice(0, 10)), 'm1 first line');
    if (viewport.width === 375) await page.screenshot({ path: shotPath('story-375') });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('PASS tutorial');
