// 챕터 끝(설계 2026-11-08 ②): 다른 용도 요청(메시지) → 개념 질문 → 짧은 생각
//   1 임무: 마지막 대화 뒤·도시 복구 화면 전 / 4 임무: 결판 통과·재연결 5/5 뒤·의뢰인 대사 전
//   다시 고르기(처음·마지막 저장), 입력마다 저장, 새로고침 뒤에도 기록, 다시 깨면 이전 답이 채워짐, 요약에 보임, 1280·390
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const ALL3 = { umbrella_open: 3, umbrella_folded: 3, wallet_closed: 3, wallet_open: 3, phone_front: 3, phone_back: 3 };
const chapterRec = (page, id) => page.evaluate((id) => DR.Save.chapterOf(DR.Save.records(), id), id);

async function m1ToChapter(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor();
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, ALL3);
  await page.locator('#screen-inspect').waitFor({ state: 'visible' });
  await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
  await page.locator('#screen-conveyor').waitFor({ state: 'visible', timeout: 8000 });
  await page.locator('#btn-cv-skip').click(); await page.locator('#btn-cv-next').click();
  await page.locator('#screen-result .result-scene').waitFor({ timeout: 40000 });
  for (let i = 0; i < 3; i++) await page.locator('#btn-next').click();
  // 마지막 대화(선배) — 대화가 끝나면 챕터 끝(도시 복구 화면 전)
  const lines = [];
  for (let n = 0; n < 12 && await page.locator('#screen-story').isVisible(); n++) { lines.push(await page.locator('#screen-story .dialog-text').innerText()); await page.locator('#screen-story .dialog').click(); }
  await page.locator('#screen-chapter').waitFor({ state: 'visible', timeout: 5000 });
  return lines;
}

// A) 1 임무: 자리·다시 고르기·개념·생각·요약·새로고침 — 1280, 390
for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const w = viewport.width;
  const { browser, page, errors } = await openGame({ viewport, query: '?start=m1', hasTouch: w < 500 });
  try {
    const lines = await m1ToChapter(page);
    assert.ok(lines.some((t) => /AI 너무 믿지는 마/.test(t)), 'senior lines came first');
    assert.equal(await page.locator('#screen-city').isVisible(), false, 'before the city screen');
    const ch = page.locator('#screen-chapter');
    assert.equal(await ch.getAttribute('data-step'), '1');
    const t1 = await ch.innerText();
    assert.match(t1, /○○마트 마케팅팀/);
    assert.match(t1, /1\/3/);
    assert.equal(await page.locator('#btn-ch-next').isDisabled(), true, 'choose first');
    // 처음 고른 것: 동의 받기 → 피드백, 다시 골라 거절
    await page.locator('.ch-choice[data-choice="consent"]').click();
    assert.match(await page.locator('#ch-feedback').innerText(), /동의를 묻는 문자도 결국 그 번호를 원래 목적과 다르게 쓰는 일이야/); // 2026-11-12 문장 바꿈(전: "물어볼 수는 있어 …")
    assert.equal(await page.locator('#btn-ch-next').isDisabled(), false);
    await page.locator('.ch-choice[data-choice="refuse"]').click();
    assert.match(await page.locator('#ch-feedback').innerText(), /^맞아/);
    assert.equal(await page.locator('.ch-choice[aria-pressed="true"]').count(), 1);
    let rec = await chapterRec(page, 'm1');
    assert.deepEqual(rec.req, { first: 'consent', last: 'refuse' });
    if (w === 1280) await page.screenshot({ path: shotPath('chapter-request-1280'), fullPage: true });
    else await page.screenshot({ path: shotPath('chapter-request-390'), fullPage: true });
    await page.locator('#btn-ch-next').click();
    // 개념 질문(대표성): 틀린 답 → 피드백, 다시 골라 맞힘
    assert.equal(await ch.getAttribute('data-step'), '2');
    assert.match(await ch.innerText(), /접힌 우산/);
    await page.locator('.ch-concept[data-choice="b"]').click();
    assert.match(await page.locator('#ch-concept-feedback').innerText(), /짐작하지 못해/);
    await page.locator('.ch-concept[data-choice="a"]').click();
    assert.match(await page.locator('#ch-concept-feedback').innerText(), /^맞아/);
    if (w === 390) await page.screenshot({ path: shotPath('chapter-concept-390'), fullPage: true });
    await page.locator('#btn-ch-next').click();
    // 생각 쓰기: 문장 틀, 비워도 넘어감, 입력마다 저장
    assert.equal(await ch.getAttribute('data-step'), '3');
    assert.match(await ch.innerText(), /이 AI를 위해 데이터를 모을 때 나는 ___을 꼭 확인하겠다/);
    assert.equal(await page.locator('#btn-ch-done').isDisabled(), false, 'empty is fine');
    await page.locator('#ch-note').fill('여러 모습을 골고루 모았는지');
    rec = await chapterRec(page, 'm1');
    assert.equal(rec.note, '여러 모습을 골고루 모았는지');
    assert.deepEqual(rec.concept, { first: 'b', last: 'a' });
    await page.screenshot({ path: shotPath('chapter-note-' + w), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
    await page.locator('#btn-ch-done').click();
    // 도시 복구 → 임무 완료 요약에 챕터 끝 답
    await page.locator('#screen-city').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('#btn-city-next').click();
    for (let n = 0; n < 6 && await page.locator('#screen-story').isVisible(); n++) await page.locator('#screen-story .dialog').click();
    await page.locator('#screen-outro').waitFor({ state: 'visible' });
    const sum = await page.locator('#outro-summary').innerText();
    assert.match(sum, /다른 용도 요청: 거절 \(처음엔 동의 받고 보내기\)/);
    assert.match(sum, /개념 질문: 맞힘/);
    assert.match(sum, /내 생각: 여러 모습을 골고루 모았는지/);
    if (w === 1280) await page.screenshot({ path: shotPath('chapter-outro-1280'), fullPage: true });

    if (w === 1280) {
      // 새로고침 뒤에도 기록에 남는다 → 같은 임무를 다시 깨면 이전 답이 채워진 채
      await page.reload();
      assert.equal((await chapterRec(page, 'm1')).note, '여러 모습을 골고루 모았는지');
      await page.evaluate(() => DR.App.startMission('m1'));
      await m1ToChapter(page);
      assert.equal(await page.locator('.ch-choice[data-choice="refuse"]').getAttribute('aria-pressed'), 'true');
      assert.match(await page.locator('#ch-feedback').innerText(), /^맞아/);
      assert.equal(await page.locator('#btn-ch-next').isDisabled(), false);
      await page.locator('.ch-choice[data-choice="erase"]').click();
      assert.deepEqual((await chapterRec(page, 'm1')).req, { first: 'consent', last: 'erase' }, 'first stays, last changes');
      await page.locator('#btn-ch-next').click();
      assert.equal(await page.locator('.ch-concept[data-choice="a"]').getAttribute('aria-pressed'), 'true');
      await page.locator('#btn-ch-next').click();
      assert.equal(await page.locator('#ch-note').inputValue(), '여러 모습을 골고루 모았는지');
      // '처음부터'(기록 지우기) → 빈 값
      await page.evaluate(() => { DR.Save.clear(); DR.App.records = {}; });
      assert.deepEqual(await chapterRec(page, 'm1'), { req: { first: null, last: null }, concept: { first: null, last: null }, note: '' });
    }
    assert.deepEqual(errors, []);
    console.log('ok m1 chapter', w);
  } finally { await browser.close(); }
}

// B) 2·3 임무 화면(보낸 이·문장 길이·좁은 화면) — 흐름은 1 임무와 같은 finishMission 길이라 화면만 직접 연다
{
  const { browser, page, errors } = await openGame({ viewport: { width: 390, height: 844 } });
  try {
    for (const [id, from] of [['m2', '구청 단속 담당'], ['m3', '근처 상점 광고 회사']]) {
      await page.evaluate((id) => { DR.App.state = { mission: id }; DR.UI.chapter(DR.Missions[id], {}, () => { window.__chDone = id; }); }, id);
      await page.locator('#screen-chapter').waitFor({ state: 'visible' });
      assert.match(await page.locator('#screen-chapter').innerText(), new RegExp(from));
      await page.locator('.ch-choice[data-choice="refuse"]').click();
      await page.screenshot({ path: shotPath('chapter-' + id + '-390'), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#btn-ch-next').click();
      await page.locator('.ch-concept').first().click();
      await page.locator('#btn-ch-next').click();
      await page.locator('#btn-ch-done').click();
      assert.equal(await page.evaluate(() => window.__chDone), id);
    }
    assert.deepEqual(errors, []);
    console.log('ok m2 m3 chapter screens');
  } finally { await browser.close(); }
}

// C) 4 임무: 결판 통과 → 재연결 5/5 → 챕터 끝 → 의뢰인(채점 담당 선생님) 대사
{
  const MIN = { neat_data: 1, neat_algo: 1, neat_ai: 1, neat_ml: 1, cur_ai: 2, cur_algo: 2, alt_ai: 2, alt_data: 2, alt_ml: 2, scrawl_ml: 2 };
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m4' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, MIN);
    await page.locator('#screen-inspect').waitFor({ state: 'visible' });
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await page.locator('#screen-grade').waitFor({ state: 'visible' });
    await page.locator('#btn-gr-skip').click(); await page.locator('#btn-gr-next').click();
    for (let n = 0; n < 8 && await page.locator('#screen-result .result-scene').isVisible(); n++) await page.locator('#btn-next').click();
    for (let n = 0; n < 30 && await page.locator('#screen-story').isVisible(); n++) await page.locator('#screen-story .dialog').click();
    await page.locator('#screen-city').waitFor({ state: 'visible' });
    await page.locator('#btn-city-next').click();
    await page.locator('#screen-chapter').waitFor({ state: 'visible' });
    assert.match(await page.locator('#screen-chapter').innerText(), /○○학원/);
    await page.locator('.ch-choice[data-choice="erase"]').click();
    assert.match(await page.locator('#ch-feedback').innerText(), /이름만 지워도 필체·답으로 누군지 알 수 있어/);
    await page.screenshot({ path: shotPath('chapter-m4-1280'), fullPage: true });
    await page.locator('#btn-ch-next').click();
    await page.locator('.ch-concept[data-choice="a"]').click();
    await page.locator('#btn-ch-next').click();
    await page.locator('#btn-ch-done').click();
    await page.locator('#screen-story').waitFor({ state: 'visible' });
    assert.match(await page.locator('#screen-story .dialog-text').innerText(), /오늘은 맞게 쓴 답에/, 'client line right after');
    assert.deepEqual((await chapterRec(page, 'm4')).req, { first: 'erase', last: 'erase' });
    assert.deepEqual(errors, []);
    console.log('ok m4 chapter placement');
  } finally { await browser.close(); }
}
console.log('PASS chapter');
