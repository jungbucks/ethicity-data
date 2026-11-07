// 첫 시험 흐름: 타이틀 → 오프닝 → 브리핑(수집 목록 없음) → 달리기 → 검수·시연 → 부족 → 다시 → 합격 → 시험관 → 1 임무 대화
import assert from 'node:assert/strict';
import { openGame, passExam, shotPath } from './browser.mjs';

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
    // 오프닝: 첫 장면부터 버튼을 바로 누를 수 있고, 그림이 없어도 글과 버튼으로 끝까지 간다
    assert.ok(await visible('profile'), 'opening after start');
    const open = await page.evaluate(() => DR.Prologue.opening);
    assert.match(await page.locator('#screen-profile .opening-lead').innerText(), /안내 AI가 말했다/);
    assert.equal(await page.locator('#btn-opening-next').isEnabled(), true, 'first action available right away');
    for (const b of open.beats) {
      assert.equal(await page.locator('#screen-profile .opening').getAttribute('data-beat'), b.id);
      if (b.id === 'split') assert.equal(await page.locator('.split-tag b').innerText(), '고양이');
      if (b.id === 'gate') assert.match(await page.locator('.opening-info').innerText(), /고2 · 오늘: 러너 자격시험/);
      if (b.img) { await page.waitForFunction(() => { const i = document.querySelector('.opening-art img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }); if (viewport.width === 375 || b.id === 'gate') await page.screenshot({ path: shotPath('opening-' + b.id + '-' + viewport.width) }); }
      await page.locator('#btn-opening-next').click();
    }
    assert.ok(await visible('briefing'), 'briefing');
    assert.equal(await page.locator('#screen-briefing .brief-scene').count(), 1);
    const brief = await page.locator('#screen-briefing').innerText();
    assert.ok(brief.includes(tut.story.guideBrief.slice(0, 10)), 'guide brief');
    assert.ok(!/\d+\s*장|필요/.test(brief), 'no collection list');
    if (viewport.width === 375) await page.screenshot({ path: shotPath('briefing-375') });
    await page.locator('#btn-run').click();
    await page.locator('#btn-goal-start').click(); // 실기 미션 안내(runner-browser가 내용을 본다)
    await page.waitForFunction(() => DR.App.screen === 'run');

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
    await finishWith({ dog: 7 });
    assert.ok(await visible('inspect'), 'inspect after the run');
    await page.locator('#btn-submit').click();
    assert.ok(await visible('result'), 'demo after fail');
    assert.match(await page.locator('#screen-result').innerText(), /고양이 사진 5장이 더 필요해/);
    await page.locator('#btn-retry').click();
    assert.ok(await visible('run'), 'run again');
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => DR.Run.peek().bagCount), 0, 'bag emptied');

    await finishWith({ dog: 5, cat: 5 });
    await passExam(page);
    assert.ok(await visible('story'), 'examiner outro');
    assert.ok((await page.locator('#screen-story').innerText()).includes('개 5장, 고양이 5장'), 'examiner line');
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
