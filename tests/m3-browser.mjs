// 3 임무 「길 안내 AI」 흐름: 브리핑 → 달리기(구역·도시 배경) → 검수(촬영 날짜·도시 변경 기록, 이름표 고치기 없음) → 감독관
//   → 길 안내 시연(위험이면 멈춤) → 장면 결과 → 정체 공개(첫 판 실수 기록 / 없으면 일반 문장) → 마무리
import assert from 'node:assert/strict';
import { passCity, openGame, shotPath } from './browser.mjs';

const ALL = { station_now: 2, station_rain: 2, market_now: 2, market_old: 1, market_eve_old: 2, river_now: 2, river_night: 2, crossing_now: 2, crossing_rain: 2 };
const NO_NUMBERS = /\d+\s*\/\s*\d+|%|\d+\s*개/;

async function toRun(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor({ state: 'visible' });
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
}
async function fillAndInspect(page, fill) {
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, fill);
  // 보통 1초 안쪽이지만 PC가 바쁘면 10초 넘게 걸린 적이 있다(2026-11-08 측정) — 시간 여유를 둔다
  await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 15000 });
}
async function submit(page) { await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click(); }
async function throughResults(page) {
  const out = [];
  for (let n = 0; n < 12; n++) {
    if (await page.locator('#screen-guide').isVisible()) { await page.locator('#btn-gd-skip').click(); await page.locator('#btn-gd-next').click(); continue; }
    if (!(await page.locator('#screen-result').isVisible()) || !(await page.locator('#screen-result .result-scene').count())) break;
    const s = page.locator('#screen-result .result-scene');
    out.push({ scene: await s.getAttribute('data-scene'), outcome: await s.getAttribute('data-outcome'), text: await page.locator('#screen-result').innerText(), wrong: await page.locator('#screen-result .result-wrong li').count() });
    await page.locator('#btn-next').click();
  }
  return out;
}
// 대화를 한 줄씩 넘기며 모든 대사를 모은다(대화 화면이 끝날 때까지)
async function readDialogue(page) {
  const lines = [];
  for (let n = 0; n < 30 && await page.locator('#screen-story').isVisible(); n++) {
    lines.push(await page.locator('#screen-story .dialog-text').innerText());
    await page.locator('#screen-story .dialog').click();
  }
  return lines;
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const w = viewport.width;
  // A) 처음부터 끝까지(기록 없음 → 정체 공개는 일반 문장)
  {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m3' });
    try {
      // 도입 대화 2줄째 = 택배 기사(2표정 시트 courier, 걱정 = 2칸)
      await page.locator('#screen-story .dialog').click();
      const cp = page.locator('#screen-story .character-portrait');
      assert.equal(await cp.getAttribute('data-character'), 'courier');
      assert.equal(await cp.locator('img').evaluate((i) => i.style.transform), 'translateX(-25%)');
      await page.waitForFunction(() => { const i = document.querySelector('#screen-story .character-portrait img'); return i && i.complete && i.naturalWidth === 1024; });
      await page.screenshot({ path: shotPath('m3-courier-worried-' + w) });
      await page.locator('#btn-skip').click();
      await page.locator('#screen-briefing').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#screen-briefing .brief-scene').count(), 4);
      assert.equal(await page.locator('#screen-briefing .legend li').count(), 4, 'four places');
      const rl = await page.evaluate(() => DR.Missions.m3.story.recordLine);
      const bt = await page.locator('#screen-briefing').innerText();
      assert.ok(!bt.includes(rl.firstTry) && !bt.includes(rl.supplemented), 'no record line without m2 record');
      await page.screenshot({ path: shotPath('m3-briefing-' + w), fullPage: true });
      await page.locator('#btn-run').click();
      await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
      await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
      assert.equal(await page.locator('.zone-cell').count(), 4, 'zones');
      assert.equal(await page.evaluate(() => DR.Run.peek().scenery.theme), 'city');
      // 빛의 다리 낮 버전(2026-11-07): 낮 하늘 그림, 구역마다 색조, 비는 학교 앞(S4)만, 시장 골목(S2)은 저녁빛
      assert.equal((await page.evaluate(() => DR.Run.peek().world)).time, 'day');
      assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('#run-stage .rw-sky')).backgroundImage.includes('bg-sky-day.webp')));
      const rains = {}, tints = {};
      for (const [i, id] of (await page.evaluate(() => DR.Run.course().zones.map((z) => z.id))).entries()) {
        await page.evaluate((id) => { const z = DR.Run.course().zones.find((x) => x.id === id); while (DR.Run.peek().runnerZ < z.start + 1) DR.Run.step(0.05); }, id);
        rains[id] = (await page.evaluate(() => DR.Run.peek().world)).rain;
        tints[id] = await page.evaluate(() => getComputedStyle(document.querySelector('#run-stage .rw-tint')).backgroundColor);
        await page.screenshot({ path: shotPath('bridge-m3-' + id + '-' + w) });
        if (i === 1) await page.screenshot({ path: shotPath('m3-run-' + w) });
      }
      assert.deepEqual(rains, { S1: false, S2: false, S3: false, S4: true });
      assert.notEqual(tints.S2, tints.S1, 'market keeps its evening light');
      await page.evaluate(() => DR.Run.setPaused(false));
      await fillAndInspect(page, { ...ALL, o_station: 1 });
      // 도시 변경 기록 판(장소 4줄) + 크게 보기: 촬영 날짜·그 장소 기록, 이름표 버튼 없음
      assert.equal(await page.locator('#change-log li').count(), 4);
      assert.match(await page.locator('#change-log').innerText(), /2015년 뒤로 바뀐 것 없음/);
      await page.locator('#inspect-grid .bag-card[data-key="market_old"] .bag-open').first().click();
      const zoom = page.locator('#inspect-zoom');
      assert.match(await zoom.locator('.zoom-date').innerText(), /^촬영: 20(1[6-9]|20)년 \d{1,2}월$/);
      assert.match(await zoom.locator('.zoom-log').innerText(), /시장 골목.*2015년 뒤로 바뀐 것 없음/);
      assert.equal(await zoom.locator('[data-relabel]').count(), 0, 'no relabel in m3');
      await page.screenshot({ path: shotPath('m3-zoom-' + w) });
      await page.keyboard.press('Escape');
      await page.locator('#inspect-grid .bag-card[data-key="o_station"] .bag-open').click();
      assert.match(await page.locator('#inspect-zoom .zoom-log').innerText(), /2024년 8월/);
      assert.equal(await page.locator('#inspect-grid .bag-card[data-key="o_station"] .bag-label').innerText(), '역 앞 사거리', 'outdated photo shows only its place label');
      await page.keyboard.press('Escape');
      await page.screenshot({ path: shotPath('m3-inspect-' + w), fullPage: true });
      await submit(page);
      // 길 안내 시연
      await page.locator('#screen-guide').waitFor({ state: 'visible' });
      assert.ok((await page.locator('#screen-guide').innerText()).includes('그럼, 실제로 길을 물어보자.'));
      if (w < 500) assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'guide fits 390');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: shotPath('m3-guide-mid-' + w) });
      await page.locator('#btn-gd-skip').click();
      assert.equal(await page.locator('#screen-guide .gd-item').count(), 8);
      assert.equal(await page.locator('#screen-guide .gd-item[data-correct="true"]').count(), 8, 'one outdated photo is harmless on first submit');
      assert.ok(!NO_NUMBERS.test(await page.locator('#screen-guide').innerText()), 'no numbers');
      await page.screenshot({ path: shotPath('m3-guide-end-' + w), fullPage: true });
      await page.locator('#btn-gd-next').click();
      const res = await throughResults(page);
      assert.deepEqual(res.map((r) => r.outcome), ['pass', 'pass', 'pass', 'pass']);
      // 정체 공개 장면 그림(reveal.bg): 대화창 뒤에 서서히 깔린다. 폰에서도 선배(그림 오른쪽)가 보이게 오른쪽 기준으로 자름
      await page.locator('#screen-story.has-bg .story-bg.on').waitFor({ state: 'attached', timeout: 4000 });
      assert.match(await page.locator('#screen-story .story-bg').getAttribute('src'), /assets\/story\/reveal-senior\.webp$/);
      assert.ok(await page.evaluate(() => document.querySelector('#screen-story .story-bg').naturalWidth === 1600));
      await page.waitForTimeout(700);
      await page.screenshot({ path: shotPath('m3-reveal-' + w) });
      // 정체 공개(기록 없음 → 일반 문장)
      const lines = await readDialogue(page);
      assert.equal(await page.locator('#screen-story.has-bg').count(), 0, 'outro dialogue has no backdrop');
      const rv = await page.evaluate(() => DR.Missions.m3.story.reveal);
      assert.ok(lines.some((l) => /그 불꽃, 나였어/.test(l)), 'reveal');
      assert.ok(lines.includes(rv.withoutRecord.text), 'general line without a record');
      await passCity(page);
      await readDialogue(page);
      await page.locator('#screen-outro').waitFor({ state: 'visible' });
      assert.ok((await page.locator('#screen-outro').innerText()).includes('길 안내 AI 완료'));
      assert.equal(await page.locator('#btn-next-mission').count(), 1, 'm3 chains to m4');
      assert.equal(await page.evaluate(() => DR.App.records.m3.cleared), true);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
}

// B) 철거 전 육교 2장 → 시연에서 안내 멈춤 → S4 위험, 보충 준비 안내는 '빼자'(고칠 수 없음)
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m3' });
  try {
    await toRun(page);
    await fillAndInspect(page, { ...ALL, o_crossing: 2 });
    await page.evaluate(() => { DR.config.conveyor.step = 0.05; });
    await submit(page);
    await page.locator('#screen-guide').waitFor({ state: 'visible' });
    await page.locator('#gd-stop').waitFor({ state: 'visible', timeout: 8000 });
    const t = await page.locator('#gd-stop').innerText();
    assert.ok(t.includes('안내 멈춰! 거기엔 이제 육교가 없어.') && t.includes('나도 같이 책임질게'), t);
    assert.equal((await page.locator('#btn-gd-resume').innerText()).trim(), '계속 돌리기');
    await page.screenshot({ path: shotPath('m3-guide-stop-1280') });
    await page.locator('#btn-gd-resume').click();
    await page.locator('#btn-gd-next').waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('#btn-gd-next').click();
    const res = await throughResults(page);
    const s4 = res.find((r) => r.scene === 'S4');
    assert.equal(s4.outcome, 'danger');
    assert.ok(s4.text.includes('옛 학교 앞 사진이 섞여 들어갔다. 육교가 철거되기 전에 찍은 사진이다.'));
    assert.ok(s4.wrong >= 1, 'wrong guide answers listed');
    await page.screenshot({ path: shotPath('m3-result-S4-1280'), fullPage: true });
    await page.locator('#screen-prep').waitFor({ state: 'visible' });
    assert.equal((await page.locator('#prep-failed li[data-scene="S4"] .prep-contam').innerText()).trim(), '엉뚱한 사진이 섞여 있다. 사진을 보고 찾아서 빼자.');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// C) 옛 날짜 카드를 전부 빼면 시장 골목이 실패(원칙 2) — "부족했다"와 "2장 / 필요 3장"
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m3' });
  try {
    await toRun(page);
    await fillAndInspect(page, ALL);
    for (const k of ['market_old', 'market_eve_old']) {
      while (await page.locator(`#inspect-grid .bag-card[data-key="${k}"]`).count()) await page.locator(`#inspect-grid .bag-card[data-key="${k}"] .btn-remove`).first().click();
    }
    await submit(page);
    const res = await throughResults(page);
    const s2 = res.find((r) => r.scene === 'S2');
    assert.equal(s2.outcome, 'inconvenience');
    assert.ok(s2.text.includes('우리가 넣은 데이터에는 시장 골목 사진이 부족했다.'), s2.text);
    assert.ok(s2.text.includes('2장 / 필요 3장'));
    assert.ok(s2.text.includes('우리가 넣은 데이터에는 저녁 시장 골목 사진이 없었다.'));
    assert.ok(res.filter((r) => r.scene !== 'S2').every((r) => r.outcome === 'pass'));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// D) 정체 공개: 1 임무 첫 판 실수 기록이 있으면 그 장면 이름을 '누구나 하는 실수'로 + 2 임무 기록 한 줄
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m3' });
  try {
    await page.evaluate(() => {
      DR.App.records.m1 = { cleared: true, passed: true, firstTry: false, supplements: 1, firstFails: [{ scene: 'S1', title: '우산', kind: 'inconvenience' }] };
      DR.App.records.m2 = { cleared: true, passed: true, firstTry: true, supplements: 0, firstFails: [] };
    });
    await toRun(page);
    await fillAndInspect(page, ALL);
    await submit(page);
    await throughResults(page);
    const lines = await readDialogue(page);
    assert.ok(lines.includes("네 첫 번째 임무 첫 판 기록도 봤어. '우산' 장면을 놓쳤더라. 탓하려는 게 아냐, 누구나 그래. 사람이 모은 데이터엔 늘 빈틈이 있어."), lines.join('\n'));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
{
  // 2 임무 기록이 있으면 3 임무 브리핑에 한 줄(임무 고르기로 들어와도 저장된 기록이면)
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 } });
  try {
    await page.evaluate(() => { DR.App.records.m2 = { cleared: true, passed: true, firstTry: false, supplements: 1, firstFails: [] }; });
    // 임무 카드 썸네일 = Codex 그림(mission-m1·m2와 같은 자리), 글은 게임이 얹는다
    const thumb = page.locator('#btn-m3 .mc-thumb');
    assert.match(await thumb.getAttribute('src'), /^assets\/title\/mission-m3\.webp$/);
    await page.waitForFunction(() => { const i = document.querySelector('#btn-m3 .mc-thumb'); return i.complete && i.naturalWidth === 640; });
    assert.equal(await page.locator('#btn-m3 .mc-hook').innerText(), '몇 년 전 사진으로 길을 알려 준다면?');
    // 연습·1 임무도 같은 화풍의 Codex 썸네일(2026-11-07)
    assert.equal(await page.locator('#btn-practice .mc-thumb').getAttribute('src'), 'assets/title/mission-practice.webp');
    assert.equal(await page.locator('#btn-m1 .mc-thumb').getAttribute('src'), 'assets/title/mission-m1.webp');
    await page.waitForFunction(() => ['#btn-practice', '#btn-m1'].every((s) => { const i = document.querySelector(s + ' .mc-thumb'); return i.complete && i.naturalWidth === 640; }));
    await page.locator('#title-missions').scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('m3-mission-card-1280') });
    await page.locator('#btn-m3').click();
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    const rl = await page.evaluate(() => DR.Missions.m3.story.recordLine);
    assert.ok((await page.locator('#screen-briefing').innerText()).includes(rl.supplemented));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
// 리뷰 반영: 시연 문구는 원인을 단정하지 않는다 · 3 임무 달리기 첫 가짜 안내는 날짜 쪽 · '처음부터'는 메모리 기록도 비운다
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m3' });
  try {
    await toRun(page);
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); for (let i = 0; i < 20000 && !DR.Run.peek().fakeHintShown; i++) DR.Run.step(0.02); });
    assert.equal(await page.locator('#run-hint').innerText(), await page.evaluate(() => DR.Missions.m3.fakeHint));
    await page.evaluate(() => DR.Run.setPaused(false));
    await fillAndInspect(page, { ...ALL, market_old: 0, market_eve_old: 0 });
    // 시장 줄은 '예전 사진' 표시 없이 한 종류
    assert.doesNotMatch(await page.locator('#inspect-scenes').innerText(), /예전|옛 사진/);
    await submit(page);
    await page.locator('#btn-gd-skip').click();
    const t = await page.locator('#screen-guide').innerText();
    assert.doesNotMatch(t, /옛 거리를 기준으로/, 'neutral status');
    assert.doesNotMatch(t, /지금은:/);
    assert.match(t, /빨간 테두리는 우리 AI가 잘못 안내한 질문이다/);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=flood' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      const rec = { cleared: true, passed: true, firstTry: false, supplements: 1, firstFails: [{ scene: 'S1', title: '낮 주택가 골목 침수', kind: 'danger' }] };
      DR.App.records.m1 = rec; DR.Save.setRecord('m1', rec); DR.App.go('title');
    });
    await page.locator('#btn-fresh').click();
    await page.locator('dialog.modal button', { hasText: '처음부터' }).click();
    assert.deepEqual(await page.evaluate(() => DR.App.records), {}, 'in-memory records cleared with the save');
    assert.deepEqual(await page.evaluate(() => DR.Save.records()), {});
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('PASS m3');
