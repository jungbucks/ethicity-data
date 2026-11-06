// 2 임무 「분리배출 분류 AI」 흐름(spec §5): 이름표 고치기(검수·보충 준비) · 컨베이어 실제 분류 · 임무 잇기
import assert from 'node:assert/strict';
import { passCity, openGame, shotPath } from './browser.mjs';

const M2_ALL2 = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };

async function toInspect(page, fill) {
  await page.locator('#btn-skip').click();
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, fill);
  await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 4000 });
}
async function submitAndConfirm(page) {
  await page.locator('#btn-submit').click();
  await page.locator('#btn-confirm').click();
}
// 컨베이어(있으면 건너뛰기) → 장면 결과를 끝까지 넘긴다. [{scene, outcome, text, wrong}]
async function throughResults(page) {
  const out = [];
  for (let n = 0; n < 20; n++) {
    if (await page.locator('#screen-conveyor').isVisible()) {
      await page.locator('#btn-cv-skip').click();
      await page.locator('#btn-cv-next').click();
      continue;
    }
    if (!(await page.locator('#screen-result .result-scene').count()) || !(await page.locator('#screen-result').isVisible())) break;
    const s = page.locator('#screen-result .result-scene');
    out.push({ scene: await s.getAttribute('data-scene'), outcome: await s.getAttribute('data-outcome'), text: await page.locator('#screen-result').innerText(), wrong: await page.locator('#screen-result .result-wrong img').count() });
    await page.locator('#btn-next').click();
  }
  return out;
}
const comboCount = (page, id) => page.locator(`#inspect-scenes [data-combo="${id}"] .combo-count`).innerText();

for (const viewport of [{ width: 1366, height: 900 }, { width: 375, height: 812 }]) {
  const small = viewport.width < 500;

  // 1부 — 검수에서 이름표 고치기
  {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m2' });
    try {
      await toInspect(page, { ...M2_ALL2, f_receipt: 1 });
      const receipt = page.locator('#inspect-grid .bag-card[data-key="f_receipt"]');
      assert.equal(await receipt.locator('.bag-label').innerText(), '종이', 'fake shows its attached label');
      assert.equal(await comboCount(page, 'S3_trash_misc'), '현재 2장');
      await receipt.locator('.bag-open').click();
      const zoom = page.locator('#inspect-zoom');
      assert.equal(await zoom.locator('[data-relabel]').count(), 7, 'seven label buttons');
      assert.equal(await zoom.locator('[data-relabel="paper"]').getAttribute('aria-pressed'), 'true');
      await zoom.locator('[data-relabel="trash"]').click();
      assert.equal(await page.locator('#inspect-zoom [data-relabel="trash"]').getAttribute('aria-pressed'), 'true', 'zoom stays open on the fixed card');
      assert.ok(await receipt.evaluate((e) => e.classList.contains('fixed')), 'fixed mark');
      assert.equal(await receipt.locator('.bag-fixed').innerText(), '고침');
      assert.equal(await receipt.locator('.bag-label').innerText(), '일반쓰레기');
      assert.equal(await comboCount(page, 'S3_trash_misc'), '현재 3장', 'counted as 일반쓰레기');
      if (small) await page.screenshot({ path: shotPath('relabel-375') });
      // relabel back clears fixed
      await page.locator('#inspect-zoom [data-relabel="paper"]').click();
      assert.ok(!(await receipt.evaluate((e) => e.classList.contains('fixed'))), 'back to original clears fixed');
      assert.equal(await receipt.locator('.bag-fixed').count(), 0);
      assert.equal(await comboCount(page, 'S3_trash_misc'), '현재 2장');
      assert.equal(await page.evaluate(() => DR.App.state.bag.find((c) => c.fakeId === 'f_receipt').label), undefined, 'label key removed');
      await page.keyboard.press('Escape');
      // 보통 카드도 같은 버튼(가짜만 버튼이 있으면 그 자체가 정답 단서)
      await page.locator('#inspect-grid .bag-card[data-key="can_drink"] .bag-open').first().click();
      assert.equal(await page.locator('#inspect-zoom [data-relabel]').count(), 7, 'ordinary card has buttons too');
      assert.equal(await page.locator('#inspect-zoom [data-relabel="can"]').getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#inspect-zoom').count(), 0, 'zoom closed');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }

  // 1부 — 1 임무 크게 보기에는 이름표 버튼 없음
  if (!small) {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=flood' });
    try {
      await toInspect(page, { day_deep: 2 });
      await page.locator('#inspect-grid .bag-card .bag-open').first().click();
      assert.equal(await page.locator('#inspect-zoom').count(), 1);
      assert.equal(await page.locator('#inspect-zoom [data-relabel]').count(), 0, 'no relabel in m1');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }

  // 1부 — 보충 준비에서도 고칠 수 있다: 이름표만 고치면 되는 경우 달리지 않고 다시 제출
  {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m2' });
    try {
      await toInspect(page, { ...M2_ALL2, trash_misc: 0, f_receipt: 2 });
      await submitAndConfirm(page);
      const res = await throughResults(page);
      assert.equal(res.find((r) => r.scene === 'S3').outcome, 'inconvenience');
      await page.locator('#screen-prep').waitFor({ state: 'visible', timeout: 4000 });
      assert.equal(await page.locator('#btn-supplement').innerText(), '보충 달리기 출발', 'trash is short before the fix');
      for (let i = 0; i < 2; i++) {
        await page.locator('#prep-grid .bag-card[data-key="f_receipt"]:not(.fixed) .bag-open').first().click();
        await page.locator('#prep-zoom [data-relabel="trash"]').click();
        await page.keyboard.press('Escape');
      }
      assert.equal(await page.locator('#prep-grid .bag-card.fixed').count(), 2);
      assert.equal(await page.locator('#btn-supplement').innerText(), '다시 제출', 'nothing short after fixing labels');
      assert.ok(await page.locator('#btn-supplement').isEnabled());
      await page.locator('#btn-supplement').click();
      await page.locator('#btn-confirm').click();
      const res2 = await throughResults(page);
      assert.ok(res2.length === 4 && res2.every((r) => r.outcome === 'pass'), JSON.stringify(res2.map((r) => r.outcome)));
      assert.equal(await page.evaluate(() => DR.App.state.supplements), 1);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
}
// 2부 — 컨베이어 실제 분류(spec §5.5)
const CV_N = 14; // missions/m2.js conveyor 물건 수(missions.test가 10~14로 고정)
const NO_NUMBERS = /\d+\s*\/\s*\d+|%|\d+\s*개/;
async function toConveyor(page, fill, step) {
  await toInspect(page, fill);
  if (step) await page.evaluate((s) => { DR.config.conveyor.step = s; }, step);
  await submitAndConfirm(page);
  await page.locator('#screen-conveyor').waitFor({ state: 'visible', timeout: 4000 });
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  const small = viewport.width < 500;
  // all pass flow
  {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=m2' });
    try {
      await toConveyor(page, M2_ALL2);
      const txt = await page.locator('#screen-conveyor').innerText();
      assert.ok(txt.includes('그럼, 실제로 돌려 보자.'), 'supervisor intro');
      assert.equal(await page.locator('#screen-conveyor .cv-bin').count(), 7, 'seven bins');
      if (small) assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 375 && document.getElementById('screen-conveyor').scrollWidth <= 375), 'conveyor fits 375');
      await page.locator('#btn-cv-skip').click();
      assert.equal(await page.locator('#screen-conveyor .cv-bin .cv-item').count(), CV_N, 'all placed after skip');
      assert.equal(await page.locator('#screen-conveyor .cv-item[data-correct="true"]').count(), CV_N, 'all correct');
      assert.ok(!NO_NUMBERS.test(await page.locator('#screen-conveyor').innerText()), 'no numbers');
      await page.screenshot({ path: shotPath('conveyor-end-' + viewport.width) });
      await page.locator('#btn-cv-next').click();
      const res = await throughResults(page);
      assert.deepEqual(res.map((r) => r.outcome), ['pass', 'pass', 'pass', 'pass']);
      assert.ok(res.every((r) => r.wrong === 0), 'no wrong items on pass pages');
      const senior = await page.evaluate(() => DR.Missions.m2.story.senior[0].text);
      assert.ok((await page.locator('#screen-story').innerText()).includes(senior), 'senior at the end');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
}

// receipt to paper
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await toConveyor(page, { ...M2_ALL2, f_receipt: 2 });
    await page.locator('#btn-cv-skip').click();
    const receipt = page.locator('#screen-conveyor .cv-item[data-id="cv7"]');
    assert.equal(await receipt.getAttribute('data-bin'), 'paper');
    assert.equal(await receipt.getAttribute('data-correct'), 'false');
    assert.equal(await page.locator('#screen-conveyor .cv-bin[data-bin="paper"] .cv-item[data-id="cv7"]').count(), 1, 'sits in the paper bin');
    await page.locator('#btn-cv-next').click();
    const res = await throughResults(page);
    const s3 = res.find((r) => r.scene === 'S3');
    assert.equal(s3.outcome, 'inconvenience');
    assert.ok(s3.wrong >= 1, 'wrong item thumbnail on S3');
    assert.ok(s3.text.includes("영수증 사진이 '종이'로"), 'receipt line');
    assert.ok(res.filter((r) => r.scene !== 'S3').every((r) => r.wrong === 0));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// emergency stop → resume → end (2배속)
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await toConveyor(page, { ...M2_ALL2, battery_aa: 0 }, 0.05);
    await page.locator('#btn-cv-fast').click();
    assert.equal(await page.locator('#btn-cv-fast').getAttribute('aria-pressed'), 'true');
    await page.locator('#cv-stop').waitFor({ state: 'visible', timeout: 6000 });
    const stopText = await page.locator('#cv-stop').innerText();
    assert.ok(stopText.includes('비상 정지') && stopText.includes('나도 같이 책임질게'), stopText);
    await page.screenshot({ path: shotPath('conveyor-stop-1280') });
    assert.equal((await page.locator('#btn-cv-resume').innerText()).trim(), '계속 돌리기');
    await page.locator('#btn-cv-resume').click();
    await page.locator('#btn-cv-next').waitFor({ state: 'visible', timeout: 6000 });
    assert.equal(await page.locator('#screen-conveyor .cv-bin .cv-item').count(), CV_N);
    assert.ok(!(await page.locator('#cv-stop').isVisible()));
    const bad = await page.locator('#screen-conveyor .cv-item[data-correct="false"]').evaluateAll((els) => els.map((e) => e.dataset.id));
    assert.ok(bad.includes('cv12'), 'battery S4 wrong');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// skip during stop — done only once
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await toConveyor(page, { ...M2_ALL2, battery_aa: 0 }, 0.05);
    await page.evaluate(() => { const o = DR.UI.result; window.__rc = 0; DR.UI.result = function () { window.__rc++; return o.apply(this, arguments); }; });
    await page.locator('#cv-stop').waitFor({ state: 'visible', timeout: 6000 });
    await page.locator('#btn-cv-skip').click();
    assert.ok(!(await page.locator('#cv-stop').isVisible()), 'stop closed by skip');
    assert.equal(await page.locator('#screen-conveyor .cv-bin .cv-item').count(), CV_N);
    // 정지 창 없이 끝나도 책임 대사는 끝 화면에 남는다
    assert.ok((await page.locator('#screen-conveyor').innerText()).includes('나도 같이 책임질게'));
    await page.evaluate(() => { const b = document.getElementById('btn-cv-next'); b.click(); b.click(); });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__rc), 1, 'done once');
    assert.equal(await page.locator('#screen-result .result-scene').getAttribute('data-scene'), 'S1');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// reduced motion — 열자마자 다 분류된 함
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toConveyor(page, { ...M2_ALL2, battery_aa: 0 });
    assert.equal(await page.locator('#screen-conveyor .cv-bin .cv-item').count(), CV_N, 'all in bins at once');
    assert.ok(await page.locator('#btn-cv-next').isVisible());
    assert.ok(!(await page.locator('#cv-stop').isVisible()));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 3부 — 임무 고르기·1→2 임무 잇기·기록 한 줄(spec §5.1·§6)
const briefText = (page) => page.locator('#screen-briefing').innerText();
async function finishFromSenior(page) {
  await page.locator('#btn-skip').click(); // 선배 대사
  await passCity(page); // 도시 복구(칸이 늘었을 때만)
  await page.locator('#btn-skip').click(); // 마무리 대사
  await page.locator('#screen-outro').waitFor({ state: 'visible', timeout: 4000 });
}

// m2 direct entry — 1 임무 기록이 없으면 기본 브리핑
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 } });
  try {
    await page.locator('#btn-m2').click();
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    const rl = await page.evaluate(() => DR.Missions.m2.story.recordLine);
    const t = await briefText(page);
    assert.ok(!t.includes(rl.firstTry) && !t.includes(rl.supplemented), 'no record line without m1 record');
    assert.equal(await page.locator('#screen-briefing .brief-scene').count(), 4);
    assert.equal(await page.locator('#screen-briefing .legend li').count(), 7, 'seven bins in legend');
    await page.screenshot({ path: shotPath('m2-briefing-1280') });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// m1 to m2 — 1 임무 첫 판 통과 → 마무리 [다음 임무로] → 2 임무 브리핑에 기록 한 줄
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=flood' });
  try {
    const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };
    await toInspect(page, ALL2);
    await submitAndConfirm(page);
    const res = await throughResults(page);
    assert.ok(res.every((r) => r.outcome === 'pass'));
    await finishFromSenior(page);
    assert.ok((await page.locator('#screen-outro').innerText()).includes('침수 판별 AI 완료'), 'kicker names the mission');
    assert.deepEqual(await page.evaluate(() => DR.App.records.flood), { cleared: true, passed: true, firstTry: true, supplements: 0, firstFails: [], fixedLabels: 0 });
    assert.deepEqual(await page.evaluate(() => DR.Save.records().flood.cleared), true, 'record saved');
    await page.evaluate(() => { DR.App.records.m1 = DR.App.records.flood; }); // 2 임무 브리핑 한 줄은 1 임무(next가 m2인 첫 임무) 기록을 읽는다
    assert.ok(await page.locator('#btn-again').isVisible(), 'title button too');
    await page.locator('#btn-next-mission').click();
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    const rl = await page.evaluate(() => DR.Missions.m2.story.recordLine);
    assert.ok((await briefText(page)).includes(rl.firstTry), 'record line (first try)');
    assert.equal(await page.evaluate(() => DR.App.state.mission), 'm2');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// m2 replay — 2 임무를 끝내고 타이틀 → 다시 2 임무: 가방 비고 보충 0, 실패 장면 기록
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await toInspect(page, { ...M2_ALL2, can_tin: 0 });
    await page.evaluate(() => { DR.config.maxSupplements = 0; }); // 실패해도 바로 마무리
    await submitAndConfirm(page);
    await throughResults(page);
    await finishFromSenior(page);
    assert.equal(await page.locator('#btn-next-mission').count(), 1, 'm2 chains to m3');
    const rec = await page.evaluate(() => DR.App.records.m2);
    assert.equal(rec.firstTry, false);
    assert.deepEqual(rec.firstFails, [{ scene: 'S1', title: '음료 캔과 통조림 캔', kind: 'inconvenience' }]);
    await page.locator('#btn-again').click();
    await page.locator('#screen-title').waitFor({ state: 'visible' });
    await page.locator('#btn-m2').click();
    await page.locator('#screen-story').waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(() => ({ bag: DR.App.state.bag.length, s: DR.App.state.supplements, m: DR.App.state.mission })), { bag: 0, s: 0, m: 'm2' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// [2] 건전지 이름표만 맞게 고치고 1장뿐 → 비상 정지·결과가 원인을 개수 부족으로 설명, '없었다'와 '1장'이 같이 나오지 않음
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await toInspect(page, { ...M2_ALL2, battery_aa: 0, f_battery: 1 });
    await page.locator('#inspect-grid .bag-card[data-key="f_battery"] .bag-open').click();
    await page.locator('#inspect-zoom [data-relabel="battery"]').click();
    await page.keyboard.press('Escape');
    await page.evaluate(() => { DR.config.conveyor.step = 0.05; });
    await submitAndConfirm(page);
    await page.locator('#screen-conveyor').waitFor({ state: 'visible' });
    await page.locator('#cv-stop').waitFor({ state: 'visible', timeout: 8000 });
    const NOTE = '이름표는 맞게 고쳤지만, 건전지 사진이 1장뿐이라 AI가 건전지를 배우지 못했다.';
    assert.ok((await page.locator('#cv-stop').innerText()).includes(NOTE), 'stop explains the count');
    await page.screenshot({ path: shotPath('m2-fixed-short-stop-1280') });
    // 잘못 가는 건전지 물건은 학생이 고친 카드와 다른 그림
    const same = await page.evaluate(() => {
      const fixed = DR.App.state.bag.find((c) => c.fakeId === 'f_battery');
      const v = parseInt(String(fixed.id).replace(/\D/g, ''), 10) % 3 || 0;
      const mine = DR.CardArt.card(DR.Missions.m2, 'f_battery', v, 160).toDataURL();
      return [...document.querySelectorAll('#screen-conveyor .cv-item[data-correct="false"] img')].some((i) => i.src === mine);
    });
    assert.equal(same, false);
    await page.locator('#btn-cv-resume').click();
    await page.locator('#btn-cv-next').waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('#btn-cv-next').click();
    const res = await throughResults(page);
    const s4 = res.find((r) => r.scene === 'S4');
    assert.equal(s4.outcome, 'danger');
    assert.ok(s4.text.includes(NOTE), 'result explains the count');
    assert.ok(s4.text.includes('우리가 넣은 데이터에는 건전지가 부족했다.'), s4.text);
    assert.ok(s4.text.includes('이번 가방: 건전지 1장 / 필요 2장'));
    for (const r of res) assert.ok(!(/없었다/.test(r.text) && /이번 가방: .* 1장 /.test(r.text)), 'no 없었다 with 1장: ' + r.scene);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 리뷰 I2 — 저장된 진행이 있으면 임무 고르기 전에 확인(취소하면 저장 그대로)
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=flood' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    await page.evaluate(() => DR.App.go('title'));
    assert.equal(await page.locator('#btn-continue').count(), 1, 'save exists');
    await page.locator('#btn-m2').click();
    const dlg = page.locator('dialog.modal');
    await dlg.waitFor({ state: 'visible', timeout: 3000 });
    assert.ok((await dlg.innerText()).includes('저장된 진행'), 'asks before overwriting');
    await dlg.locator('button', { hasText: '취소' }).click();
    assert.equal(await page.evaluate(() => DR.App.screen), 'title');
    assert.equal(await page.evaluate(() => DR.Save.load().mission), 'flood', 'save kept on cancel');
    await page.locator('#btn-m2').click();
    await page.locator('dialog.modal button', { hasText: '2 임무 시작' }).click();
    await page.locator('#screen-story').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => DR.App.state.mission), 'm2');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

console.log('PASS m2');
