// 외부 리뷰 2026-11-10(review.md) 반영 — 항목별(①은 bare-browser). 실행: node tests/review-browser.mjs [2|3|4|5|6]
//   ② 검수·보충 준비에서 이름표 고치기·빼기/되돌리기·설명표·가리기가 바로 저장된다(새로고침 뒤에도 그대로)
//   ③ 임무 뒤 활동(챕터 끝 1~3단계·마무리)을 하다 나가도 그 자리로 돌아온다 — 완료 기록·도시 복구는 한 번만, 옛 저장은 그대로
//   ④ 4 임무 비교표: 열 이름 '마지막 판정', 새로 틀린 답안지 표시
//   ⑤ 크게 보기: Tab·Shift+Tab이 창 안에서 돌고, 배경은 못 누르고, 닫으면 열었던 카드로 포커스
//   ⑥ 저장이 안 되면 '저장했어' 대신 탭에만 남아 있다고 알린다(입력은 그대로) — 챕터 끝 화면을 바로 연다
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DATA_DIR, openGame, shotPath } from './browser.mjs';

const part = process.argv[2] || 'all';
const on = (n) => part === 'all' || part === String(n);
const INDEX = pathToFileURL(path.join(DATA_DIR, 'index.html')).href;
const VP = { width: 1280, height: 800 };
const saved = (page) => page.evaluate(() => DR.Save.load());
const savedCard = (page, id) => page.evaluate((id) => { const s = DR.Save.load(); return (s && s.bag.find((c) => c.id === id)) || null; }, id);
// 타이틀로 다시 들어오기(새로고침·탭 되살아남과 같은 길 — ?start= 없이)
async function reopen(page) {
  await page.goto(INDEX);
  await page.locator('#title-actions button').first().waitFor({ state: 'visible', timeout: 30000 });
}
async function toInspect(page, fill) {
  await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 30000 });
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, fill);
  await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 60000 });
}
// 제출 → (컨베이어·채점 시연) → 장면 결과 → 대화 … 를 넘겨 want 화면이 뜰 때까지
async function until(page, want, max = 80) {
  for (let n = 0; n < max; n++) {
    if (await page.locator(want).isVisible()) return;
    if (await page.locator('#screen-conveyor').isVisible()) { await page.locator('#btn-cv-skip').click(); await page.locator('#btn-cv-next').click(); }
    else if (await page.locator('#screen-grade').isVisible()) { await page.locator('#btn-gr-skip').click(); await page.locator('#btn-gr-next').click(); }
    else if (await page.locator('#screen-result #btn-next').isVisible()) await page.locator('#btn-next').click();
    else if (await page.locator('#screen-story .dialog').isVisible()) await page.locator('#screen-story .dialog').click();
    else await page.waitForTimeout(250);
  }
  throw new Error('never reached ' + want);
}

/* ② 가방 변경은 바로 저장 — 2 임무(이름표 고치기) 검수 → 보충 준비 */
async function part2() {
  const { browser, page, errors } = await openGame({ viewport: VP, query: '?start=m2' });
  try {
    await toInspect(page, { can_drink: 2, pet_clear: 2, vinyl_bag: 2, f_receipt: 1 });
    const ids = await page.evaluate(() => ({ receipt: DR.App.state.bag.find((c) => c.fakeId === 'f_receipt').id, can: DR.App.state.bag.find((c) => c.key === 'can_drink').id, len: DR.App.state.bag.length }));
    assert.equal((await saved(page)).screen, 'inspect');
    // 이름표 고치기 → 저장본에도 바로
    await page.locator(`#inspect-grid .bag-card[data-id="${ids.receipt}"] .bag-open`).click();
    await page.locator('#inspect-zoom [data-relabel="trash"]').click();
    assert.equal((await savedCard(page, ids.receipt)).label, 'trash', 'relabel saved at once');
    await page.keyboard.press('Escape');
    // 빼기 → 저장, 되돌리기 → 저장
    await page.locator(`#inspect-grid .bag-card[data-id="${ids.can}"] .btn-remove`).click();
    assert.equal(await savedCard(page, ids.can), null, 'removal saved at once');
    assert.equal((await saved(page)).bag.length, ids.len - 1);
    await page.locator('#undo-toast button').click();
    assert.ok(await savedCard(page, ids.can), 'undo saved at once');
    assert.deepEqual((await saved(page)).bag.map((c) => c.id), await page.evaluate(() => DR.App.state.bag.map((c) => c.id)), 'same order as on screen');
    // 한 장은 빼 둔 채로 다시 들어온다
    await page.locator(`#inspect-grid .bag-card[data-id="${ids.can}"] .btn-remove`).click();
    await reopen(page);
    await page.locator('#btn-continue').click();
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await page.locator('#inspect-grid .bag-card').count(), ids.len - 1, 'removed card stays removed after reopening');
    assert.equal(await page.locator(`#inspect-grid .bag-card[data-id="${ids.receipt}"] .bag-fixed`).count(), 1, 'relabel kept after reopening');
    assert.equal(await page.locator(`#inspect-grid .bag-card[data-id="${ids.receipt}"] .bag-label`).innerText(), '일반쓰레기');

    // 보충 준비에서도: 이름표 고치기·빼기·되돌리기가 prep 체크포인트로 저장되고, 다시 들어오면 보충 준비 그대로
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await until(page, '#screen-prep');
    assert.equal((await saved(page)).screen, 'prep');
    await page.locator('#btn-prep-all').click();
    const pet = await page.evaluate(() => DR.App.state.bag.find((c) => c.key === 'pet_clear').id);
    await page.locator(`#prep-grid .bag-card[data-id="${pet}"] .bag-open`).click();
    await page.locator('#prep-zoom [data-relabel="can"]').click();
    assert.equal((await savedCard(page, pet)).label, 'can', 'prep relabel saved');
    assert.equal((await saved(page)).screen, 'prep', 'still the prep checkpoint');
    await page.keyboard.press('Escape');
    const before = (await saved(page)).bag.length;
    await page.locator(`#prep-grid .bag-card[data-id="${ids.receipt}"] .btn-remove`).click();
    assert.equal((await saved(page)).bag.length, before - 1, 'prep removal saved');
    await page.locator('#undo-toast button').click();
    assert.equal((await saved(page)).bag.length, before, 'prep undo saved');
    await page.locator(`#prep-grid .bag-card[data-id="${ids.receipt}"] .btn-remove`).click();
    const supp = (await saved(page)).supplements;
    await reopen(page);
    assert.match(await page.locator('#title-progress').innerText(), /보충 준비부터/);
    await page.locator('#btn-continue').click();
    await page.locator('#screen-prep').waitFor({ state: 'visible', timeout: 30000 });
    const st = await page.evaluate(() => ({ len: DR.App.state.bag.length, supp: DR.App.state.supplements }));
    assert.equal(st.len, before - 1, 'prep bag as left');
    assert.equal(st.supp, supp, 'no supplement used up by reopening');
    await page.locator('#btn-prep-all').click();
    assert.equal(await page.locator(`#prep-grid .bag-card[data-id="${pet}"] .bag-fixed`).count(), 1);
    assert.deepEqual(errors, []);
    console.log('ok ② bag changes saved (inspect · prep)');
  } finally { await browser.close(); }
}

/* ③ 임무 뒤 활동 이어하기 + ⑥ 저장 실패 안내 — 1 임무 */
const ALL3 = { umbrella_open: 3, umbrella_folded: 3, wallet_closed: 3, wallet_open: 3, phone_front: 3, phone_back: 3 };
const ending = (page) => page.evaluate(() => DR.Save.ending());
async function continueFromTitle(page, re) {
  await reopen(page);
  assert.equal(await page.locator('#btn-continue').count(), 1, 'title offers to continue');
  assert.match(await page.locator('#title-progress').innerText(), re);
  await page.locator('#btn-continue').click();
}
async function part3() {
  const { browser, page, errors } = await openGame({ viewport: VP, query: '?start=m1' });
  try {
    await toInspect(page, ALL3);
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await until(page, '#screen-chapter');
    const ch = page.locator('#screen-chapter');
    assert.equal(await ch.getAttribute('data-step'), '1');
    let e = await ending(page);
    assert.equal(e.mission, 'm1'); assert.equal(e.step, 1); assert.deepEqual(e.city, { from: 0, to: 1 });
    const rec0 = await page.evaluate(() => JSON.stringify({ ...DR.Save.records().m1, chapter: null }));
    assert.equal((await saved(page)).mission, null, 'the game result itself is already recorded as finished');

    // 1단계에서 고르고 2단계로 → 나갔다 오면 2단계, 1단계 답은 그대로
    await page.locator('.ch-choice[data-choice="refuse"]').click();
    await page.locator('#btn-ch-next').click();
    assert.equal((await ending(page)).step, 2);
    await continueFromTitle(page, /첫 번째 임무 · 챕터 끝부터/);
    await ch.waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await ch.getAttribute('data-step'), '2', 'back at step 2');
    assert.equal(await page.evaluate(() => DR.Save.chapterOf(DR.Save.records(), 'm1').req.last), 'refuse');
    assert.equal(await page.locator('#title-city').getAttribute('data-count'), '1', 'city counted once');
    // 2단계 → 3단계 → 나갔다 오면 3단계, 쓴 글 그대로
    await page.locator('.ch-concept[data-choice="a"]').click();
    await page.locator('#btn-ch-next').click();
    await page.locator('#ch-note').fill('골고루 모았는지');
    await continueFromTitle(page, /챕터 끝부터/);
    await ch.waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await ch.getAttribute('data-step'), '3', 'back at step 3');
    assert.equal(await page.locator('#ch-note').inputValue(), '골고루 모았는지');

    // 마치기 → 도시 복구(한 번) → 마무리 대화 → 임무 완료 화면
    await page.locator('#btn-ch-done').click();
    await page.locator('#screen-city').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal((await ending(page)).step, 4);
    await page.locator('#btn-city-next').click();
    assert.equal((await ending(page)).city, null, 'city screen marked as seen');
    await until(page, '#screen-outro');
    const sum = await page.locator('#outro-summary').innerText();
    assert.match(sum, /다른 용도 요청: 거절/);
    // 완료 화면에서 나갔다 오면: 도시 복구는 다시 안 뜨고 완료 화면을 다시 본다. 기록·도시 칸은 그대로
    await continueFromTitle(page, /첫 번째 임무 · 임무 마무리부터/);
    let sawCity = false;
    for (let n = 0; n < 40 && !(await page.locator('#screen-outro').isVisible()); n++) {
      if (await page.locator('#screen-city').isVisible()) sawCity = true;
      if (await page.locator('#screen-chapter').isVisible()) throw new Error('chapter shown again');
      if (await page.locator('#screen-story .dialog').isVisible()) await page.locator('#screen-story .dialog').click(); else await page.waitForTimeout(200);
    }
    assert.equal(sawCity, false, 'city restore is not replayed');
    assert.equal(await page.locator('#outro-summary').innerText(), sum, 'same summary again');
    assert.equal(await page.evaluate(() => JSON.stringify({ ...DR.Save.records().m1, chapter: null })), rec0, 'completion record written once, unchanged');
    assert.deepEqual(await page.evaluate(() => Object.keys(DR.Save.records())), ['m1']);
    assert.equal(await page.evaluate(() => DR.App.cityCount()), 1);
    // [타이틀로] = 뒤 활동 완료 → 다음 임무부터
    await page.locator('#btn-again').click();
    assert.equal(await ending(page), null);
    await page.locator('#btn-resume-next').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#btn-resume-next').innerText(), '두 번째 임무부터 이어하기');
    assert.equal(await page.locator('#btn-continue').count(), 0);

    // 옛 저장(ending 없음, 끝낸 임무만): 예전처럼 다음 임무부터
    await page.evaluate(() => localStorage.setItem(DR.Save.KEY, JSON.stringify({ v: 1, mission: null, tutorialDone: true, cityV: 1,
      records: { tutorial: { cleared: true }, m1: { cleared: true, passed: true, firstTry: true, supplements: 0, firstFails: [] } } })));
    await reopen(page);
    assert.equal(await page.locator('#btn-continue').count(), 0, 'old save: nothing to continue');
    assert.equal(await page.locator('#btn-resume-next').innerText(), '두 번째 임무부터 이어하기');
    // 기록이 없는 임무를 가리키는 깨진 ending은 무시
    await page.evaluate(() => { const o = JSON.parse(localStorage.getItem(DR.Save.KEY)); o.ending = { mission: 'm3', step: 2 }; localStorage.setItem(DR.Save.KEY, JSON.stringify(o)); });
    await reopen(page);
    assert.equal(await page.locator('#btn-continue').count(), 0, 'ending without a cleared record is ignored');
    assert.deepEqual(errors, []);
    console.log('ok ③ chapter end resumes (m1)');
  } finally { await browser.close(); }

  // 4 임무: 챕터 끝 도중 나갔다 와도 재연결 화면은 다시 안 뜨고, 마무리 질문·비교표를 본다. 완료 화면에서 나갔다 와도 다시 본다
  const MIN = { neat_data: 1, neat_algo: 1, neat_ai: 1, neat_ml: 1, cur_ai: 2, cur_algo: 2, alt_ai: 2, alt_data: 2, alt_ml: 2, scrawl_ml: 2 };
  const g = await openGame({ viewport: VP, query: '?start=m4' });
  try {
    const page4 = g.page;
    await toInspect(page4, MIN);
    await page4.locator('#btn-submit').click(); await page4.locator('#btn-confirm').click();
    await until(page4, '#screen-city');
    assert.equal((await ending(page4)).step, 0);
    assert.deepEqual((await ending(page4)).city, { from: 0, to: 5 });
    await page4.locator('#btn-city-next').click();
    await page4.locator('#screen-chapter').waitFor({ state: 'visible', timeout: 10000 });
    await page4.locator('.ch-choice').first().click();
    await continueFromTitle(page4, /네 번째 임무 · 챕터 끝부터/);
    await page4.locator('#screen-chapter').waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await page4.locator('#screen-chapter').getAttribute('data-step'), '1');
    assert.equal(await page4.locator('.ch-choice[aria-pressed="true"]').count(), 1, 'the answer picked before leaving');
    await page4.locator('#btn-ch-next').click();
    await page4.locator('.ch-concept').first().click(); await page4.locator('#btn-ch-next').click();
    await page4.locator('#btn-ch-done').click();
    let city4 = false;
    for (let n = 0; n < 60 && !(await page4.locator('#screen-outro').isVisible()); n++) {
      if (await page4.locator('#screen-city').isVisible()) city4 = true;
      if (await page4.locator('#screen-story .dialog').isVisible()) await page4.locator('#screen-story .dialog').click(); else await page4.waitForTimeout(200);
    }
    assert.equal(city4, false, 'm4 reconnect screen not replayed');
    assert.equal(await page4.locator('#outro-compare').count(), 1, 'compare section');
    assert.equal(await page4.locator('#outro-questions li').count() > 0, true, 'closing questions');
    const q = await page4.locator('#outro-questions').innerText();
    await continueFromTitle(page4, /네 번째 임무 · 임무 마무리부터/);
    await until(page4, '#screen-outro');
    assert.equal(await page4.locator('#outro-questions').innerText(), q, 'closing questions again');
    assert.equal(await page4.locator('#outro-compare').count(), 1, 'compare again');
    assert.deepEqual(await page4.evaluate(() => Object.keys(DR.Save.records())), ['m4']);
    await page4.locator('#btn-again').click();
    assert.equal(await ending(page4), null);
    assert.deepEqual(g.errors, []);
    console.log('ok ③ chapter end resumes (m4)');
  } finally { await g.browser.close(); }
}

/* ⑥ 저장이 막히면 '저장했어' 대신 탭에만 남아 있다고 알린다 — 챕터 끝 화면을 바로 연다(2 임무) */
async function part6() {
  const { browser, page, errors } = await openGame({ viewport: VP });
  try {
    await page.evaluate(() => {
      DR.App.state = { mission: 'm2' };
      DR.App.records.m2 = { cleared: true }; DR.Save.setRecord('m2', DR.App.records.m2);
      DR.UI.chapter(DR.Missions.m2, {}, () => { window.__chDone = true; });
    });
    await page.locator('#screen-chapter').waitFor({ state: 'visible', timeout: 30000 });
    const note = () => page.evaluate(() => DR.Save.chapterOf(DR.Save.records(), 'm2').note);
    const block = () => page.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('quota'); }; });
    const unblock = () => page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
    // 고르기 단계: 저장이 안 되면 그 자리에서 알린다(고른 답·피드백은 그대로 보인다)
    await block();
    await page.locator('.ch-choice[data-choice="refuse"]').click();
    assert.equal(await page.locator('.ch-choice[data-choice="refuse"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.locator('#ch-save-fail').innerText(), /저장하지 못했어.*이 탭에만 남아 있어/);
    assert.equal(await page.locator('#btn-ch-next').isDisabled(), false, 'not blocked');
    await unblock();
    await page.locator('.ch-choice[data-choice="refuse"]').click();
    assert.equal(await page.locator('#ch-save-fail').count(), 0, 'notice goes away once saving works');
    await page.locator('#btn-ch-next').click();
    await page.locator('.ch-concept').first().click();
    await page.locator('#btn-ch-next').click();
    // 생각 쓰기: 정상 → '저장했어'(저장본과 같음)
    await page.locator('#ch-note').fill('이름표를 꼭 본다');
    assert.equal(await page.locator('#ch-saved').innerText(), '저장했어');
    assert.equal(await note(), '이름표를 꼭 본다');
    // 저장이 막힘 → 성공 문구 없음, 탭에만 남아 있다고. 글은 그대로, 계속 쓸 수 있다
    await block();
    await page.locator('#ch-note').fill('이름표를 꼭 본다. 사진도 본다');
    const fail = await page.locator('#ch-saved').innerText();
    assert.doesNotMatch(fail, /저장했어/, 'no success text when the save failed');
    assert.match(fail, /저장하지 못했어.*이 탭에만 남아 있어/);
    assert.equal(await page.locator('#ch-note').inputValue(), '이름표를 꼭 본다. 사진도 본다', 'typing is not blocked');
    assert.equal(await page.locator('#ch-note').isEditable(), true);
    assert.equal(await note(), '이름표를 꼭 본다', 'storage really kept the old text');
    await page.screenshot({ path: shotPath('review-save-fail-1280') });
    // 다시 저장되면 상태도 바뀐다
    await unblock();
    await page.locator('#ch-note').fill('이름표를 꼭 본다. 사진도 본다!');
    assert.equal(await page.locator('#ch-saved').innerText(), '저장했어');
    assert.equal(await note(), '이름표를 꼭 본다. 사진도 본다!');
    // 막힌 채로도 마칠 수 있다
    await block();
    await page.locator('#btn-ch-done').click();
    assert.equal(await page.evaluate(() => window.__chDone), true);
    assert.deepEqual(errors, []);
    console.log('ok ⑥ save failure is told');
  } finally { await browser.close(); }
}

/* ④ 비교표 화면 + ⑤ 크게 보기 포커스 — 4 임무 검수 */
async function part45() {
  const { browser, page, errors } = await openGame({ viewport: VP, query: '?start=m4' });
  try {
    if (on(4)) {
      const t = await page.evaluate(() => {
        const m = DR.Missions.m4, cfg = DR.config;
        const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
        const MIN = { neat_data: 1, neat_algo: 1, neat_ai: 1, neat_ml: 1, cur_ai: 2, cur_algo: 2, alt_ai: 2, alt_data: 2, alt_ml: 2, scrawl_ml: 2 };
        const b0 = bagOf({ ...MIN, scrawl_ml: 0 }), b1 = bagOf({ ...MIN, neat_data: 0, neat_algo: 0, neat_ai: 0, neat_ml: 0 });
        const first = DR.GradeCompare.snapshot(m, DR.Judge.judge(m, b0, cfg), b0);
        const box = DR.UI.gradeCompare(m, DR.GradeCompare.rows(m, first, DR.Judge.judge(m, b1, cfg), b1, cfg));
        box.style.cssText = 'position:fixed;inset:0;z-index:99;background:#14102e;overflow:auto;padding:16px';
        document.body.appendChild(box);
        const out = { th: [...box.querySelectorAll('th')].map((x) => x.textContent), kinds: [...box.querySelectorAll('tbody tr')].map((r) => r.dataset.id + ':' + r.dataset.kind),
          tag: (box.querySelector('tr[data-kind="worse"] .cmp-tag') || {}).textContent, note: (box.querySelector('#cmp-worse-note') || {}).textContent,
          gr1: [...box.querySelectorAll('tr[data-id="gr1"] td')].map((x) => x.innerText), text: box.innerText };
        return out;
      });
      assert.deepEqual(t.th, ['답안 사진', '처음 판정', '내가 바꾼 자료', '마지막 판정']);
      assert.doesNotMatch(t.text, /개선 후/);
      assert.deepEqual(t.kinds, ['gr11:changed', 'gr1:worse', 'gr14:worse', 'gr4:control']);
      assert.equal(t.tag, '새로 틀림 · 처음엔 맞았음');
      assert.match(t.note, /맞던 답안지도 새로 틀린다/);
      assert.equal(t.gr1[1], '○ 인공지능으로 읽음'); assert.equal(t.gr1[2], '또박또박 쓴 답안 4장 → 0장'); assert.equal(t.gr1[3], '사람 채점 · 못 읽음');
      await page.screenshot({ path: shotPath('review-compare-worse-1280') });
      await page.evaluate(() => document.getElementById('outro-compare').remove());
      console.log('ok ④ compare table shows newly wrong sheets');
    }
    if (!on(5)) return;
    await toInspect(page, { neat_data: 2, neat_ml: 2, q_ai: 1 });
    const ids = await page.evaluate(() => ({ neat: DR.App.state.bag.find((c) => c.key === 'neat_data').id, q: DR.App.state.bag.find((c) => c.ambiguousId).id }));
    const active = () => page.evaluate(() => { const a = document.activeElement; return { id: a.id, tag: a.tagName, inZoom: !!a.closest('#inspect-zoom, #prep-zoom'), relabel: a.dataset ? a.dataset.relabel || '' : '', label: a.dataset ? a.dataset.label || '' : '', card: (a.closest('.bag-card') || { dataset: {} }).dataset.id || '', cls: a.className }; });
    const cardBtn = `#inspect-grid .bag-card[data-id="${ids.neat}"] .bag-open`;
    await page.locator(cardBtn).focus();
    await page.keyboard.press('Enter');
    await page.locator('#inspect-zoom').waitFor({ state: 'visible' });
    assert.equal((await active()).id, 'btn-zoom-close', 'opens on the close button');
    // 배경은 창이 떠 있는 동안 못 누른다
    assert.equal(await page.evaluate(() => !!document.getElementById('btn-submit').closest('[inert]')), true, 'background is inert while the dialog is open');
    // Shift+Tab: 배경 제출 버튼이 아니라 창 안 마지막 조작으로
    await page.keyboard.press('Shift+Tab');
    let a = await active();
    assert.equal(a.inZoom, true, 'Shift+Tab stays in the dialog: ' + JSON.stringify(a));
    assert.notEqual(a.id, 'btn-submit');
    const last = a;
    await page.keyboard.press('Tab');
    assert.equal((await active()).id, 'btn-zoom-close', 'Tab from the last control wraps to the first');
    for (let n = 0; n < 9; n++) { await page.keyboard.press('Tab'); a = await active(); assert.equal(a.inZoom, true, 'Tab ' + n + ' stays in the dialog: ' + JSON.stringify(a)); }
    for (let n = 0; n < 9; n++) { await page.keyboard.press('Shift+Tab'); a = await active(); assert.equal(a.inZoom, true, 'Shift+Tab ' + n + ' stays in the dialog: ' + JSON.stringify(a)); }
    assert.ok(last.relabel || last.id, 'last control is a real control');
    // 이름표를 고치면 다시 그려도 포커스는 같은 이름표 버튼(닫기로 튀지 않는다) — 이어서 또 고칠 수 있다
    await page.locator('#inspect-zoom [data-relabel="ai"]').focus();
    await page.keyboard.press('Enter');
    a = await active();
    assert.equal(a.relabel, 'ai', 'focus stays on the label just pressed: ' + JSON.stringify(a));
    await page.keyboard.press('Shift+Tab'); // 앞 이름표로 가서 한 번 더
    a = await active();
    assert.equal(a.inZoom, true);
    await page.keyboard.press('Enter');
    assert.equal((await active()).relabel, a.relabel, 'second relabel keeps focus too');
    await page.screenshot({ path: shotPath('review-zoom-focus-1280') });
    // Esc → 열었던 카드로
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#inspect-zoom').count(), 0);
    a = await active();
    assert.equal(a.card, ids.neat, 'focus returns to the card that opened it: ' + JSON.stringify(a));
    assert.match(a.cls, /bag-open/);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#screen-inspect [inert]').length), 0, 'background usable again');
    // 닫기 버튼으로 닫아도 같다. "?" 카드: 낱말을 붙이면 그 버튼에 포커스 + 바로 저장(②)
    await page.locator(`#inspect-grid .bag-card[data-id="${ids.q}"] .bag-open`).click();
    await page.locator('#inspect-zoom [data-label="ai"]').click();
    a = await active();
    assert.equal(a.label, 'ai', '"?" label keeps focus: ' + JSON.stringify(a));
    assert.equal((await savedCard(page, ids.q)).assigned, 'ai', '"?" label saved at once');
    await page.locator('#btn-zoom-close').click();
    assert.equal((await active()).card, ids.q, 'close button returns focus to its card');
    // 바깥을 눌러 닫아도 열었던 카드로
    await page.locator(cardBtn).click();
    await page.locator('#inspect-zoom').click({ position: { x: 5, y: 5 } });
    assert.equal(await page.locator('#inspect-zoom').count(), 0);
    assert.equal((await active()).card, ids.neat);
    // 제출은 그대로 된다(창을 닫고 넘어감 — 포커스를 카드로 돌리지 않는다)
    await page.locator(cardBtn).click();
    await page.keyboard.press('Escape');
    await page.locator('#btn-submit').click();
    await page.locator('#screen-supervisor').waitFor({ state: 'visible', timeout: 10000 });
    assert.deepEqual(errors, []);
    console.log('ok ⑤ zoom dialog keeps and returns focus');
  } finally { await browser.close(); }
}

if (on(2)) await part2();
if (on(3)) await part3();
if (on(6)) await part6();
if (on(4) || on(5)) await part45();
console.log('PASS review');
