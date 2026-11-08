// 4 임무 「채점 AI」 흐름: 브리핑 → 달리기(시험장 배경·구역 대사) → 검수(숫자 버튼) → 감독관 → 채점 시연(위험이면 멈춤)
//   → 장면 결과 → 결판(선배 답안) ─ 못 읽음 → 동기 합류(NEW 4장 / 마지막 보충은 고정) → … → 결판 "읽네"
//   → 도시 재연결 5/5 → 의뢰인 → 해커의 이후 → 마무리(토론 질문)
import assert from 'node:assert/strict';
import { openGame, passChapter, shotPath } from './browser.mjs';

const MIN = { neat_1: 1, neat_2: 1, neat_3: 1, neat_4: 1, neat_5: 1, flag_1: 2, loop_3: 2, angular_2: 2, round_5: 1, table_4: 2, slant_1: 2 };
const NO_NUMBERS = /%|\d+\s*개/;
// 도시 복구 그림(assets/city/city-n.webp)은 아직 없다 → <img> 오류(파일 없음) 콘솔 줄은 예상된 것. 그 밖의 오류는 없어야 한다
const ONLY = process.env.M4_ONLY || 'ABCDEF';
const real = (errors) => errors.filter((e) => !/__missing__/.test(e)); // C는 결판 배경 그림을 일부러 없는 파일로

async function toRun(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor({ state: 'visible' });
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
}
async function fillAndInspect(page, fill) {
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, fill);
  await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 4000 });
}
async function submit(page) { await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click(); }
async function skipGrade(page) {
  await page.locator('#screen-grade').waitFor({ state: 'visible' });
  await page.locator('#btn-gr-skip').click();
  await page.locator('#btn-gr-next').click();
}
async function throughResults(page) {
  const out = [];
  for (let n = 0; n < 8 && await page.locator('#screen-result .result-scene').isVisible(); n++) {
    const s = page.locator('#screen-result .result-scene');
    out.push({ scene: await s.getAttribute('data-scene'), outcome: await s.getAttribute('data-outcome'), text: await page.locator('#screen-result').innerText() });
    await page.locator('#btn-next').click();
  }
  return out;
}
async function readDialogue(page) {
  const lines = [];
  for (let n = 0; n < 30 && await page.locator('#screen-story').isVisible(); n++) {
    lines.push(await page.locator('#screen-story .dialog-text').innerText());
    await page.locator('#screen-story .dialog').click();
  }
  return lines;
}
// 대화를 넘기다 text가 나오면 멈춘다(그 줄이 보이는 채로)
async function dialogueUntil(page, re) {
  for (let n = 0; n < 30; n++) {
    const t = await page.locator('#screen-story .dialog-text').innerText();
    if (re.test(t)) return t;
    await page.locator('#screen-story .dialog').click();
  }
  throw new Error('line not found: ' + re);
}
async function toPrepAndRun(page, fill) {
  await page.locator('#screen-prep').waitFor({ state: 'visible' });
  const peer = await page.locator('#prep-peer').innerText();
  const resubmit = (await page.locator('#btn-supplement').innerText()).trim() === '다시 제출';
  await page.locator('#btn-supplement').click();
  // 동기 카드만으로 모자란 게 없으면 달리지 않고 다시 제출(검수에서 동기 카드를 먼저 본다)
  if (!resubmit) {
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    toPrepAndRun.bagMax = await page.evaluate(() => DR.Run.peek().bagMax);
    await page.evaluate((c) => { if (c) DR.App.debugFill(c); DR.Run.finishNow(); }, fill || null);
  }
  await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 4000 });
  return peer;
}
async function ending(page, w, shots) {
  // 도시 재연결 5/5(그림이 없으면 점 5칸 + 문구)
  await page.locator('#screen-city').waitFor({ state: 'visible' });
  assert.match(await page.locator('#city-line').innerText(), /^도시 5\/5 — 채점 AI까지, 도시가 다시 이어졌다$/);
  await page.waitForTimeout(900);
  assert.equal(await page.locator('#screen-city .city-dots i.on').count(), 5);
  // 그림이 아직 없으면 그림 자리를 숨기고 점 5칸 + 문구(그림이 들어오면 그림이 보인다)
  const hasArt = await page.evaluate(() => { const i = document.querySelector('#screen-city .city-after'); return !!(i && i.complete && i.naturalWidth); });
  assert.equal(await page.locator('#city-art').isHidden(), !hasArt);
  if (shots) await page.screenshot({ path: shotPath('city-m4-' + w) });
  await page.locator('#btn-city-next').click();
  // 챕터 끝(2026-11-08): 재연결 뒤·의뢰인 대사 전 — 내용은 chapter-browser
  assert.equal(await passChapter(page), true, 'chapter end after the reconnect');
  const lines = [];
  for (let n = 0; n < 12 && await page.locator('#screen-story').isVisible(); n++) {
    const t = await page.locator('#screen-story .dialog-text').innerText();
    lines.push(t);
    if (shots && t === '…알아.') {
      await page.locator('#screen-story .story-bg.on').waitFor({ state: 'attached', timeout: 4000 });
      assert.match(await page.locator('#screen-story .story-bg').getAttribute('src'), /assets\/story\/senior-after\.webp$/);
      await page.waitForTimeout(700);
      await page.screenshot({ path: shotPath('m4-after-' + w) });
    }
    await page.locator('#screen-story .dialog').click();
  }
  // 마무리 대화 → 엔딩 카드(토론 질문)
  for (let n = 0; n < 8 && await page.locator('#screen-story').isVisible(); n++) await page.locator('#screen-story .dialog').click();
  await page.locator('#screen-outro').waitFor({ state: 'visible' });
  const out = await page.locator('#screen-outro').innerText();
  assert.ok(out.includes('채점 AI 완료') && out.includes('도시가 다시 이어졌다'));
  assert.equal(await page.locator('#outro-questions li').count(), 2);
  assert.equal(await page.locator('#btn-next-mission').count(), 0, 'last mission');
  if (shots) await page.screenshot({ path: shotPath('m4-outro-' + w), fullPage: true });
  assert.equal(await page.evaluate(() => DR.App.records.m4.cleared), true);
  return lines;
}

// A) 첫 판에 크게 기운 1을 뺌 → 채점 멈춤 → S4 위험 → 결판 "또 지웠잖아" → 동기 합류(NEW 4장) → 보충 → 결판 "읽네" → 5/5 → 이후 → 마무리
for (const viewport of ONLY.includes('A') ? [{ width: 1280, height: 800 }, { width: 390, height: 844 }] : []) {
  const w = viewport.width;
  const { browser, page, errors } = await openGame({ viewport, query: '?start=m4', hasTouch: w < 500 });
  try {
    // 도입 2줄째 = 채점 담당 선생님(2표정 시트 grader, 걱정 = 2칸)
    await page.locator('#screen-story .dialog').click();
    const cp = page.locator('#screen-story .character-portrait');
    assert.equal(await cp.getAttribute('data-character'), 'grader');
    assert.equal(await cp.locator('img').evaluate((i) => i.style.transform), 'translateX(-25%)');
    await page.waitForFunction(() => { const i = document.querySelector('#screen-story .character-portrait img'); return i && i.complete && i.naturalWidth > 0; });
    await page.screenshot({ path: shotPath('m4-grader-' + w) });
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#screen-briefing .brief-scene').count(), 4);
    assert.equal(await page.locator('#screen-briefing .legend li').count(), 5, 'choice numbers 1~5');
    assert.match(await page.locator('#screen-briefing').innerText(), /이 시험의 선택지는 1~5번/);
    await page.screenshot({ path: shotPath('m4-briefing-' + w), fullPage: true });
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
    assert.equal(await page.locator('.zone-cell').count(), 4, 'zones');
    assert.equal(await page.evaluate(() => DR.Run.peek().scenery.theme), 'exam');
    // 구역 진입 대사(선배): S2에 들어서면 한 줄
    await page.evaluate(() => { const z = DR.Run.course().zones[1]; for (let i = 0; i < 20000 && DR.Run.peek().linesShown.indexOf('S2') < 0; i++) DR.Run.step(0.02); });
    assert.match(await page.locator('#run-hint').innerText(), /^선배: 1을 7로 읽는 기계야/);
    await page.screenshot({ path: shotPath('m4-run-' + w) });
    await page.evaluate(() => DR.Run.setPaused(false));
    await fillAndInspect(page, { ...MIN, slant_1: 0, neat_1: 0, x_17: 1 });
    // 7이 붙은 카드: 지금 이름표 = 7(선택지에 없는 번호), 1~5 버튼 중 눌린 것 없음
    assert.match(await page.locator('#inspect-grid .bag-card[data-key="x_17"] .bag-label').innerText(), /^7번\(선택지에 없는 번호\)$/);
    await page.locator('#inspect-grid .bag-card[data-key="x_17"] .bag-open').click();
    const zoom = page.locator('#inspect-zoom');
    assert.equal(await zoom.locator('[data-relabel]').count(), 5);
    assert.equal(await zoom.locator('[data-relabel][aria-pressed="true"]').count(), 0, 'no number pressed for 7');
    const tops = await zoom.locator('[data-relabel]').evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, 'five buttons in one row');
    await page.screenshot({ path: shotPath('m4-zoom-' + w) });
    await page.keyboard.press('Escape');
    await page.screenshot({ path: shotPath('m4-inspect-' + w), fullPage: true });
    await page.evaluate(() => { DR.config.conveyor.step = 0.05; });
    await submit(page);
    // 채점 시연: 크게 기운 1이 7로 읽혀 ✕ → 감독관 멈춤
    await page.locator('#screen-grade').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#screen-grade').innerText()).includes('그럼, 실제로 채점해 보자.'));
    await page.locator('#gr-stop').waitFor({ state: 'visible', timeout: 10000 });
    const stopText = await page.locator('#gr-stop').innerText();
    assert.ok(stopText.includes('잠깐, 이건 사람이 다시 보자.') && stopText.includes('나도 같이 책임질게'), stopText);
    await page.screenshot({ path: shotPath('m4-grade-stop-' + w) });
    await page.locator('#btn-gr-resume').click();
    await page.locator('#btn-gr-next').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#screen-grade .gr-item').count(), 13);
    const slant = page.locator('#screen-grade .gr-item[data-id="gr11"]');
    assert.equal(await slant.getAttribute('data-correct'), 'false');
    assert.match(await slant.innerText(), /AI가 읽은 번호: 7/);
    assert.equal(await page.locator('#screen-grade .gr-item[data-id="gr3"]').getAttribute('data-correct'), 'true', 'real wrong answer ✕ is right');
    assert.ok(!NO_NUMBERS.test(await page.locator('#screen-grade').innerText()), 'no % in grading');
    if (w < 500) assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'grade fits 390');
    await page.screenshot({ path: shotPath('m4-grade-end-' + w), fullPage: true });
    await page.locator('#btn-gr-next').click();
    const res = await throughResults(page);
    assert.deepEqual(res.map((r) => r.outcome), ['inconvenience', 'pass', 'pass', 'danger']);
    assert.ok(res[3].text.includes('7로 읽었다') && res[3].text.includes('있지도 않은 번호'), res[3].text);
    // 결판: 배경 그림 + 선배 답안(빈 자리 → 7 · ✕)
    await page.locator('#screen-story.has-bg .story-bg.on').waitFor({ state: 'attached', timeout: 4000 });
    assert.match(await page.locator('#screen-story .story-bg').getAttribute('src'), /assets\/story\/showdown-senior\.webp$/);
    assert.match(await page.locator('#screen-story .dialog-text').innerText(), /새빛 진학 평가 때 내 답안이야/);
    assert.equal(await page.locator('#screen-story .story-sheet').getAttribute('data-read'), 'null');
    await dialogueUntil(page, /^봐, 또 지웠잖아\.$/);
    assert.equal(await page.locator('#screen-story .story-sheet').getAttribute('data-read'), 'false');
    assert.match(await page.locator('#screen-story .story-sheet-read').innerText(), /7 — 선택지에 없는 번호 · ✕/);
    await page.waitForTimeout(700);
    await page.screenshot({ path: shotPath('m4-showdown-' + w) });
    const join = await readDialogue(page);
    assert.ok(join.some((t) => /이상한 건 빼자/.test(t) && /모아 뒀어/.test(t)), 'peer joins');
    // 보충 준비: 동기 카드 4장이 보충 뒤에 들어온다는 안내(뺄 수 있음)
    const peerNote = await toPrepAndRun(page, { neat_1: 1 });
    assert.equal(toPrepAndRun.bagMax, 26, 'run keeps 4 slots for the peer cards');
    assert.match(peerNote, /4장/); assert.match(peerNote, /넣을지는 검수에서 정한다/);
    assert.equal(await page.locator('#inspect-grid .bag-card[data-peer="joined"]').count(), 4);
    assert.equal(await page.locator('#inspect-grid .bag-card[data-peer="joined"].is-new').count(), 4, 'NEW');
    assert.equal(await page.locator('#inspect-grid .bag-card[data-peer="joined"] .btn-remove').count(), 4, 'removable');
    await submit(page);
    await skipGrade(page);
    const res2 = await throughResults(page);
    assert.ok(res2.every((r) => r.outcome === 'pass'), JSON.stringify(res2.map((r) => r.outcome)));
    await dialogueUntil(page, /읽네/);
    assert.equal(await page.locator('#screen-story .story-sheet').getAttribute('data-read'), 'true');
    await page.screenshot({ path: shotPath('m4-showdown-pass-' + w) });
    await readDialogue(page);
    const lines = await ending(page, w, true);
    assert.ok(lines.includes('오늘은 맞게 쓴 답에 ✕가 하나도 안 찍혔어요.'));
    assert.ok(!lines.some((t) => /챙겨 왔어/.test(t)), 'peer already joined — no box line');
    assert.deepEqual(real(errors), []);
  } finally { await browser.close(); }
}

// B) 첫 판 통과 길: 결판 "읽네" 바로 → 동기 "나도 이거 챙겨 왔어"
if (ONLY.includes('B')) {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m4' });
  try {
    await toRun(page);
    await fillAndInspect(page, MIN);
    await submit(page);
    await skipGrade(page);
    assert.equal(await page.locator('#screen-grade .gr-item[data-correct="false"]').count(), 0);
    const res = await throughResults(page);
    assert.ok(res.every((r) => r.outcome === 'pass'));
    const sd = await readDialogue(page);
    assert.ok(sd.some((t) => /읽네/.test(t)) && sd.some((t) => /다음 사람은 지워지지 않아/.test(t)));
    const lines = await ending(page, 1280, false);
    assert.ok(lines.includes('나도 이거 챙겨 왔어. 다음엔 처음부터 넣을게.'), lines.join('\n'));
    assert.deepEqual(real(errors), []);
  } finally { await browser.close(); }
}

if (ONLY.includes('C')) // C) 동기 카드를 빼고 다시 못 읽음 → 마지막 보충은 고정("동기와 함께 넣음") → 결판 통과. 결판 배경 그림이 없어도 흐름은 그대로
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m4' });
  try {
    await page.evaluate(() => { DR.Missions.m4.story.showdown.bg = 'assets/story/__missing__.webp'; });
    await toRun(page);
    await fillAndInspect(page, { ...MIN, slant_1: 0, table_4: 0 });
    await submit(page);
    await skipGrade(page);
    await throughResults(page);
    await readDialogue(page);
    await toPrepAndRun(page);
    // 동기 카드(뺄 수 있음)를 모두 뺀다
    while (await page.locator('#inspect-grid .bag-card[data-peer] .btn-remove').count()) await page.locator('#inspect-grid .bag-card[data-peer] .btn-remove').first().click();
    await submit(page);
    await skipGrade(page);
    await throughResults(page);
    const sd = await readDialogue(page);
    assert.ok(sd.includes('봐, 또 지웠잖아.'));
    assert.ok(sd.includes('이번엔 내가 같이 책임질게. 이건 꼭 넣자.'), sd.join('\n'));
    assert.ok(!sd.some((t) => /1 임무 때부터/.test(t)), 'peer joins only once');
    const peerNote = await toPrepAndRun(page);
    assert.match(peerNote, /동기와 함께 넣는다/);
    assert.equal(await page.locator('#inspect-grid .bag-card[data-peer="fixed"]').count(), 4);
    assert.equal(await page.locator('#inspect-grid .bag-card[data-peer="fixed"] .btn-remove').count(), 0, 'cannot remove');
    assert.equal((await page.locator('#inspect-grid .bag-card[data-peer="fixed"] .bag-peer-fixed').first().innerText()).trim(), '동기와 함께 넣음');
    await page.locator('#inspect-grid .bag-card[data-peer="fixed"] .bag-open').first().click();
    assert.equal(await page.locator('#inspect-zoom [data-relabel]').count(), 0, 'cannot relabel');
    await page.keyboard.press('Escape');
    await page.screenshot({ path: shotPath('m4-peer-fixed-1280'), fullPage: true });
    await submit(page);
    await skipGrade(page);
    await throughResults(page);
    const sd2 = await readDialogue(page);
    assert.ok(sd2.some((t) => /읽네/.test(t)));
    assert.equal(await page.locator('#screen-story.has-bg').count(), 0);
    await ending(page, 1280, false);
    assert.deepEqual(real(errors), []);
  } finally { await browser.close(); }
}

// D) 375px: 이름표 고치기 버튼 5개 한 줄, "?" 카드 = 번호 5개 한 줄 + "넣지 않기" 둘째 줄
if (ONLY.includes('D')) {
  const { browser, page, errors } = await openGame({ viewport: { width: 375, height: 740 }, query: '?start=m4', hasTouch: true });
  try {
    await toRun(page);
    await fillAndInspect(page, { ...MIN, x_38: 1, q_25: 1 });
    await page.locator('#inspect-grid .bag-card[data-key="x_38"] .bag-open').click();
    const zoom = page.locator('#inspect-zoom');
    const boxes = await zoom.locator('[data-relabel]').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { top: Math.round(r.top), w: r.width, h: r.height, right: r.right }; }));
    assert.equal(boxes.length, 5);
    assert.equal(new Set(boxes.map((b) => b.top)).size, 1, 'one row at 375px');
    assert.ok(boxes.every((b) => b.w >= 48 && b.h >= 44), JSON.stringify(boxes));
    assert.ok(boxes.every((b) => b.right <= 375), 'inside the screen');
    await page.screenshot({ path: shotPath('m4-relabel-375') });
    await page.locator('#inspect-zoom [data-relabel="3"]').click();
    assert.equal(await page.locator('#inspect-zoom [data-relabel="3"]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#inspect-grid .bag-card[data-key="x_38"]').innerText(), /고침/);
    await page.locator('#inspect-grid .bag-card[data-key="q_25"] .bag-open').click();
    const q = await page.locator('#inspect-zoom [data-label]').evaluateAll((bs) => bs.map((b) => ({ id: b.dataset.label, top: Math.round(b.getBoundingClientRect().top) })));
    const nums = q.filter((b) => b.id !== 'none'), none = q.find((b) => b.id === 'none');
    assert.equal(nums.length, 5); assert.equal(new Set(nums.map((b) => b.top)).size, 1, '"?" numbers in one row');
    assert.ok(none.top > nums[0].top, '"넣지 않기" on its own row');
    assert.equal(await page.locator('#inspect-zoom .clue').count(), 2);
    await page.screenshot({ path: shotPath('m4-question-375'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 375), 'no horizontal scroll');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// E) 타이틀: "도시 n/5" 배지(기록 계산), 4 임무 카드 썸네일
for (const viewport of ONLY.includes('E') ? [{ width: 1280, height: 800 }, { width: 375, height: 760 }] : []) {
  const { browser, page, errors } = await openGame({ viewport });
  try {
    const badge = page.locator('#title-city');
    assert.equal(await badge.getAttribute('role'), 'img');
    assert.equal(await badge.getAttribute('aria-label'), '도시 복구 5칸 중 0칸');
    assert.equal(await badge.evaluate((b) => getComputedStyle(b).pointerEvents), 'none');
    await page.evaluate(() => {
      DR.App.records.tutorial = { cleared: true }; DR.App.records.m1 = { cleared: true }; DR.App.records.m3 = { cleared: true };
      DR.App.go('title');
    });
    assert.equal(await badge.getAttribute('aria-label'), '도시 복구 5칸 중 3칸');
    assert.equal(await page.locator('#title-city .city-dots i.on').count(), 3);
    assert.equal((await page.locator('#title-city .title-city-text').innerText()).trim(), '도시 3/5');
    const b = await badge.boundingBox();
    assert.ok(Math.abs(b.x - 16) < 2 && Math.abs(b.y - 16) < 2, JSON.stringify(b));
    // 다른 버튼·주인공 고르기·임무 카드와 겹치지 않는다
    const hit = await page.evaluate(() => {
      const r = document.getElementById('title-city').getBoundingClientRect();
      return [...document.querySelectorAll('#screen-title button, #title-guide, #screen-title h1, .title-kicker')].filter((e) => {
        const o = e.getBoundingClientRect();
        return o.width && !(o.right <= r.left || o.left >= r.right || o.bottom <= r.top || o.top >= r.bottom);
      }).map((e) => e.id || e.className);
    });
    assert.deepEqual(hit, [], 'badge overlaps nothing');
    const thumb = page.locator('#btn-m4 .mc-thumb');
    assert.match(await thumb.getAttribute('src'), /^assets\/title\/mission-m4\.webp$/);
    await page.waitForFunction(() => { const i = document.querySelector('#btn-m4 .mc-thumb'); return i.complete && i.naturalWidth === 640; });
    assert.equal(await page.locator('#btn-m4 .mc-hook').innerText(), '맞게 쓴 답에 ✕가 찍힌다면?');
    await page.screenshot({ path: shotPath('title-city-' + viewport.width) });
    await page.locator('#title-missions').scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('m4-mission-card-' + viewport.width) });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
// F) 크게 기운 1은 있는데 표 안 답만 없음 → 결판도 장면 결과와 같은 말("답 없음 · 사람 채점", 7이 아니다 — 리뷰 I2)
if (ONLY.includes('F')) {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m4' });
  try {
    await toRun(page);
    await fillAndInspect(page, { ...MIN, table_4: 0 });
    await submit(page);
    await skipGrade(page);
    const res = await throughResults(page);
    assert.equal(res.find((r) => r.scene === 'S4').outcome, 'inconvenience');
    const t = await dialogueUntil(page, /채점 결과/);
    assert.match(t, /표 끝 칸의 답을 찾지 못함 · 사람 채점/);
    assert.equal(await page.locator('#screen-story .story-sheet').getAttribute('data-read'), 'hold');
    assert.match(await page.locator('#screen-story .story-sheet-read').innerText(), /답 없음/);
    await page.screenshot({ path: shotPath('m4-showdown-hold-1280') });
    const rest = await readDialogue(page);
    assert.ok(rest.includes('봐, 또 지웠잖아.'));
    // 보충 준비: 표 안 답은 동기 카드로 채워진다고 보인다(리뷰 M4)
    await page.locator('#screen-prep').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#prep-failed').innerText()).includes('동기 카드로 채워짐'));
    assert.deepEqual(real(errors), []);
  } finally { await browser.close(); }
}
console.log('PASS m4');
