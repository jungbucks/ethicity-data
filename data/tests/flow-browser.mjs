// 1단계(P1~P4) 흐름 확인: 튜토리얼(빈 가방·합격) → m1(일시정지·라벨·되돌리기·S3 결과) → 새로고침 이어하기 → 보충(NEW) → 재제출 → 엔딩 → 타이틀
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };
const { night_deep, ...NO_DEEP } = ALL2;

async function skipTalk(page) { await page.locator('#btn-skip').click(); }
async function waitRun(page) { await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 }); }
async function fillAndFinish(page, counts) { await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, counts); }
async function readResults(page) {
  const out = [];
  while (await page.locator('#screen-result .result-scene').count()) {
    const s = page.locator('#screen-result .result-scene');
    out.push({ scene: await s.getAttribute('data-scene'), outcome: await s.getAttribute('data-outcome'), text: await page.locator('#screen-result').innerText() });
    await page.locator('#btn-next').click();
  }
  return out;
}
const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.data.save') || 'null'));

const { browser, page, errors } = await openGame({ viewport: { width: 1366, height: 900 } });
try {
  // ── 타이틀(저장 없음) → 튜토리얼
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  assert.equal(await page.locator('#title-actions button').count(), 1, 'fresh title: 시작하기 하나');
  await page.locator('#btn-start').click();
  await skipTalk(page); // 프롤로그
  await skipTalk(page); // 시험관 대화
  assert.ok(await page.locator('#screen-briefing .legend li').count() >= 2, 'tutorial legend');
  await page.locator('#btn-run').click();
  await waitRun(page);

  // P1 버그 2: 빈 가방
  await fillAndFinish(page, {});
  let t = await page.locator('#screen-result').innerText();
  assert.match(t, /배운 게 없습니다/);
  assert.match(t, /가방이 비었어/);
  assert.doesNotMatch(t, /한쪽 사진만|부족했다|고양이!/, 'empty bag: only the empty-bag lines');
  // 한쪽만(강아지 2·고양이 0) → "한쪽 사진만 잔뜩"
  await page.locator('#btn-retry').click(); await waitRun(page);
  await fillAndFinish(page, { dog: 2 });
  assert.match(await page.locator('#screen-result').innerText(), /한쪽 사진만 잔뜩/);
  // 둘 다 있지만 모자람 → "한쪽만" 문구 없음
  await page.locator('#btn-retry').click(); await waitRun(page);
  await fillAndFinish(page, { dog: 1, cat: 1 });
  t = await page.locator('#screen-result').innerText();
  assert.doesNotMatch(t, /한쪽 사진만/);
  assert.match(t, /너무 적어/);
  // 합격 → 가방 구성 한 줄
  await page.locator('#btn-retry').click(); await waitRun(page);
  await fillAndFinish(page, { dog: 3, cat: 4 });
  await page.locator('#btn-next').click();
  await page.locator('#screen-story').waitFor();
  const talk = [];
  for (let i = 0; i < 4 && await page.locator('#screen-story').isVisible(); i++) { talk.push(await page.locator('#screen-story').innerText()); await page.locator('#screen-story .dialog').click(); }
  assert.ok(talk.some((x) => /개 3장, 고양이 4장/.test(x)), 'pass count line');
  assert.equal((await save(page)).tutorialDone, true, 'tutorialDone saved');

  // ── m1
  await page.waitForSelector('#btn-skip'); await skipTalk(page);
  await page.locator('#screen-briefing').waitFor();
  assert.equal((await save(page)).screen, 'briefing', 'checkpoint: briefing');
  assert.ok(await page.locator('#screen-briefing .legend li').count() >= 6, 'm1 legend: 낮·밤·라벨 4·?');
  await page.locator('#btn-run').click(); await waitRun(page);

  // P4: 일시정지(P) → 메뉴 → Esc로 계속, 버튼으로 다시
  await page.keyboard.press('p');
  await page.locator('dialog.modal').waitFor();
  assert.equal(await page.evaluate(() => DR.Run.peek().paused), true, 'paused by P');
  assert.equal(await page.locator('dialog.modal button').count(), 3, '계속하기·도움말·처음으로');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !DR.Run.peek().paused, null, { timeout: 3000 }); // dialog close 이벤트는 한 틱 뒤
  await page.locator('#btn-pause').click();
  await page.getByRole('button', { name: '도움말' }).click();
  assert.match(await page.locator('dialog.modal').innerText(), /노이즈 벽/);
  await page.keyboard.press('Escape'); // 도움말 닫기 → 다시 일시정지 메뉴
  await page.getByRole('button', { name: '계속하기' }).waitFor();
  assert.equal(await page.evaluate(() => DR.Run.peek().paused), true, 'still paused after help');
  await page.getByRole('button', { name: '계속하기' }).click();
  await page.waitForFunction(() => !DR.Run.peek().paused, null, { timeout: 3000 });

  await fillAndFinish(page, NO_DEEP);
  await page.locator('#screen-inspect').waitFor();
  assert.equal((await save(page)).screen, 'inspect', 'checkpoint: inspect');
  // P2: 라벨·접근성
  const labels = await page.locator('#inspect-grid .bag-label').allInnerTexts();
  assert.ok(labels.includes('밤 · 정상(젖음)') && labels.includes('낮 · 침수(깊음)'), 'text labels');
  assert.match(await page.locator('#inspect-grid .bag-open').first().getAttribute('aria-label'), /^크게 보기: /);
  assert.match(await page.locator('#inspect-grid .btn-remove').first().getAttribute('aria-label'), /^빼기: /);
  // P3: 조합별 "현재 n장"(필요 장수는 아직 숨김)
  const s3 = await page.locator('#inspect-scenes [data-scene=S3]').innerText();
  assert.match(s3, /밤 · 침수\(깊음\)\s*현재 0장/);
  assert.doesNotMatch(await page.locator('#inspect-scenes').innerText(), /\d+\s*\/\s*\d+장/, 'need hidden before first result');
  // P3: 빼기 → 되돌리기
  const before = await page.locator('#inspect-grid .bag-card').count();
  await page.locator('#inspect-grid .btn-remove').first().click();
  assert.equal(await page.locator('#inspect-grid .bag-card').count(), before - 1);
  await page.getByRole('button', { name: '방금 뺀 카드 되돌리기' }).click();
  assert.equal(await page.locator('#inspect-grid .bag-card').count(), before, 'undo restores');
  await page.screenshot({ path: shotPath('inspect-labels-1366') });

  await page.locator('#btn-submit').click();
  await page.locator('#btn-confirm').click();
  await page.locator('#screen-result .result-scene').waitFor();
  assert.equal((await save(page)).screen, 'result', 'checkpoint: result');
  const res = await readResults(page);
  const r3 = res.find((r) => r.scene === 'S3');
  assert.equal(r3.outcome, 'inconvenience', 'S3 night_deep missing = 불편');
  assert.match(r3.text, /네온 반사를 깊은 물로 착각해 교차로를 막았다/);
  assert.doesNotMatch(r3.text, /안전/);
  assert.match(r3.text, /이번 가방: 밤 · 침수\(깊음\) 0장 \/ 필요 2장/);

  // P3: 보충 준비 — 부족 종류·여유·1장 빼기
  await page.locator('#screen-prep').waitFor();
  assert.equal((await save(page)).screen, 'prep', 'checkpoint: prep');
  assert.match(await page.locator('#prep-failed').innerText(), /밤 · 침수\(깊음\)\s*부족 2장/);
  assert.ok(await page.locator('#prep-summary .kind').count() >= 8, 'kind summary');

  // P4: 새로고침 → 이어하기 → 보충 준비로
  await page.reload();
  assert.equal(await page.locator('#btn-continue').count(), 1, '이어하기');
  assert.equal(await page.locator('#btn-fresh').count(), 1, '처음부터');
  await page.locator('#btn-continue').click();
  await page.locator('#screen-prep').waitFor();
  assert.match(await page.locator('#prep-failed').innerText(), /부족 2장/, 'resumed prep');

  // 보충 달리기 → 검수(NEW) → 재제출 → 전부 통과 → 엔딩
  await page.locator('#btn-supplement').click(); await waitRun(page);
  await fillAndFinish(page, { night_deep: 2 });
  await page.locator('#screen-inspect').waitFor();
  assert.equal(await page.locator('#inspect-grid .badge-new').count(), 2, 'NEW on fresh cards');
  assert.match(await page.locator('#inspect-scenes [data-scene=S3]').innerText(), /밤 · 침수\(깊음\)\s*2 \/ 2장/, 'need revealed after first result');
  await page.locator('#btn-submit').click();
  await page.locator('#btn-confirm').click();
  const res2 = await readResults(page);
  assert.ok(res2.every((r) => r.outcome === 'pass'), 'all pass after supplement');
  // 선배·마무리 대화 → 엔딩 화면 → 타이틀
  for (let i = 0; i < 6 && await page.locator('#screen-story').isVisible(); i++) await page.locator('#screen-story .dialog').click();
  await page.locator('#screen-outro').waitFor();
  await page.locator('#btn-again').click();
  const sv = await save(page);
  assert.equal(sv.mission, null, 'progress cleared at ending');
  assert.equal(sv.tutorialDone, true);
  await page.locator('#btn-start').click();
  await page.getByRole('button', { name: '튜토리얼 건너뛰기' }).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog.modal'), null, { timeout: 3000 }); // Esc로 닫힘
  assert.equal(await page.evaluate(() => localStorage.getItem('ethicity.data.sound')), null, 'sound key not written until toggled');
  assert.deepEqual(errors, []);
  console.log('PASS flow 1단계: 튜토리얼 → m1 → 이어하기 → 보충 → 재제출 → 엔딩 → 타이틀');
} finally { await browser.close(); }
