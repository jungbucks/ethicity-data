// 플레이테스트 수정 13건(docs/feedback/2026-11-08-playtest.md) 브라우저 확인 — 항목 번호별 묶음
// 하나만: ONLY=4 node data/tests/playtest-browser.mjs (쉼표로 여러 개: ONLY=3,6)
import assert from 'node:assert/strict';
import { openGame, openPrepAll, shotPath } from './browser.mjs';

const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...ids) => !ONLY.length || ids.some((id) => ONLY.includes(String(id)));
const W = { width: 1280, height: 800 };

async function toRun(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor({ state: 'visible' });
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 10000 });
}
async function fillAndInspect(page, fill) {
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, fill);
  await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 20000 });
}
async function submit(page) { await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click(); }
// 컨베이어(1·2 임무)·길 안내(3 임무) 시연을 건너뛰고 장면 결과를 모은다 → 보충 준비/다음 화면 앞에서 멈춤
async function results(page, shot) {
  const out = [];
  for (let n = 0; n < 14; n++) {
    if (await page.locator('#screen-conveyor').isVisible()) { await page.locator('#btn-cv-skip').click(); await page.locator('#btn-cv-next').click(); continue; }
    if (await page.locator('#screen-guide').isVisible()) { await page.locator('#btn-gd-skip').click(); await page.locator('#btn-gd-next').click(); continue; }
    if (!(await page.locator('#screen-result .result-scene').count())) {
      if (n === 0 || (await page.locator('#screen-supervisor').isVisible())) { await page.waitForTimeout(300); continue; }
      break;
    }
    const s = page.locator('#screen-result .result-scene');
    out.push({ scene: await s.getAttribute('data-scene'), outcome: await s.getAttribute('data-outcome'),
      lead: await s.locator('.lead').innerText(), missing: (await s.locator('.missing').allInnerTexts()).join(' / ') });
    if (shot && shot.scene === out[out.length - 1].scene) await page.screenshot({ path: shotPath(shot.name), fullPage: true });
    await page.locator('#btn-next').click();
    await page.waitForTimeout(50);
  }
  return out;
}
const center = (r) => r.x + r.width / 2;

/* ---------- 1. 여러 종류를 합친 조합 이름 ---------- */
if (want(1)) {
  const { browser, page, errors } = await openGame({ viewport: W, query: '?start=m4' });
  try {
    await toRun(page);
    await fillAndInspect(page, { neat_1: 2 });
    assert.equal(await page.locator('#inspect-scenes [data-combo="S1_neat"] .combo-label').innerText(), '또박또박 쓴 답안', '4 임무 NEAT 조합 = what');
    assert.equal(await page.locator('#inspect-scenes [data-combo="S2_25"] .combo-label').innerText(), '각지게 쓴 2와 둥글게 쓴 5');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  const g = await openGame({ viewport: W, query: '?start=m3' });
  try {
    await toRun(g.page);
    await fillAndInspect(g.page, { market_now: 1, market_old: 1 });
    assert.equal(await g.page.locator('#inspect-scenes [data-combo="S2_market"] .combo-label').innerText(), '시장 골목', '3 임무 시장 골목(지금+옛 사진)');
    assert.deepEqual(g.errors, []);
  } finally { await g.browser.close(); }
  console.log('ok 1 combo names');
}

/* ---------- 2. 실패한 조합 기준 결과 문구 ---------- */
const M2_ALL = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };
if (want(2)) {
  for (const [short, scene, bad, good] of [['pet_crushed', 'S2', /비닐/, /찌그러진 페트병/], ['pack_milk', 'S3', /영수증/, /우유팩/]]) {
    const { browser, page, errors } = await openGame({ viewport: W, query: '?start=m2' });
    try {
      await toRun(page);
      await fillAndInspect(page, { ...M2_ALL, [short]: 1 });
      await submit(page);
      const rs = await results(page, short === 'pet_crushed' ? { scene: 'S2', name: 'playtest-result-m2-S2' } : null);
      const r = rs.find((x) => x.scene === scene);
      assert.equal(r.outcome, 'inconvenience', JSON.stringify(rs));
      assert.match(r.lead, good, r.lead);
      assert.doesNotMatch(r.lead + ' ' + r.missing, bad, r.lead + ' / ' + r.missing);
      assert.ok(rs.filter((x) => x.scene !== scene).every((x) => x.outcome === 'pass'), JSON.stringify(rs));
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
  console.log('ok 2 per-combo result lines');
}

/* ---------- 3·6. 튜토리얼 연습 카드: 안내 · 점검표 · 시험관 말 · 그대로 두기 ---------- */
if (want(3, 6, 12)) {
  for (const viewport of [W, { width: 375, height: 812 }]) {
    const { browser, page, errors } = await openGame({ viewport });
    try {
      await page.locator('#btn-practice').click();
      await page.locator('#btn-skip').click();
      await page.locator('#btn-run').click();
      await page.locator('#btn-goal-start').click();
      await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 10000 });
      await page.evaluate(() => { DR.App.debugFill({ dog: 5, cat: 5 }); DR.Run.finishNow(); });
      await page.locator('#exam-drill').waitFor();
      const drill = await page.locator('#exam-drill').innerText();
      assert.match(drill, /이 카드도 AI가 배우는 자료야\. 이름표가 맞는지 보고, 틀렸으면 고쳐 봐\./);
      assert.doesNotMatch(drill, /가방에는 들어가지 않는/);
      // 6: 고치기 창에 '그대로 두기' — 누르면 이름표 그대로 닫힌다
      await page.locator('#exam-drill .exam-card').click();
      await page.locator('dialog.modal').waitFor();
      await page.locator('#btn-label-keep').click();
      await page.waitForFunction(() => !document.querySelector('dialog.modal'), null, { timeout: 3000 });
      assert.equal(await page.evaluate(() => DR.App.state.drill.label), undefined, '그대로 두기 = 이름표 안 바뀜');
      // 3: 안 고치고 제출 → 점검표와 시험관 말이 맞는다
      await page.locator('#btn-submit').click();
      await page.locator('.exam-pair.wrong').waitFor();
      assert.match(await page.locator('#exam-check').innerText(), /이름표가 맞는 카드 10 \/ 11장/, '연습 카드도 점검에 든다');
      assert.match(await page.locator('#screen-result').innerText(), /라고 가르쳤네/);
      // 12: 연습 시험 각주는 짧게
      const note = await page.locator('#exam-note').innerText();
      assert.ok(note.length <= 45, '각주 길이 ' + note.length + ': ' + note);
      if (viewport.width === 375) await page.screenshot({ path: shotPath('playtest-drill-375'), fullPage: true });
      await page.locator('#btn-fix').click();
      await page.locator('#exam-drill .exam-card').click();
      const truth = await page.evaluate(() => DR.Cards.truthKey(DR.Missions.tutorial, DR.App.state.drill));
      await page.locator('#btn-label-' + truth).click();
      await page.locator('#btn-submit').click();
      await page.locator('.exam-pair.fixed').waitFor();
      assert.match(await page.locator('#exam-check').innerText(), /이름표가 맞는 카드 11 \/ 11장/);
      await page.locator('#btn-next').waitFor();
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
  console.log('ok 3 drill card · 6 keep button · 12 short note');
}

/* ---------- 4·11. 다음 임무로 이어하기 · 다 깼을 때 봇 대사 · 옛 세이브 ---------- */
if (want(4, 11)) {
  const { browser, page, errors } = await openGame({ viewport: W });
  try {
    assert.equal(await page.locator('#btn-start').innerText(), '시작하기', '세이브 없음 = 시작하기');
    assert.equal(await page.locator('.mc-next').count(), 0);
    // 2 임무까지 깸(진행 없음) → 3 임무부터 이어하기 + 3 임무 카드 배지
    await page.evaluate(() => {
      DR.Save.markTutorialDone();
      DR.Save.setRecord('tutorial', { cleared: true });
      DR.Save.setRecord('m1', { cleared: true, passed: true, firstTry: true, supplements: 0, firstFails: [] });
      DR.Save.setRecord('m2', { cleared: true, passed: true, firstTry: false, supplements: 1, firstFails: [] });
      DR.Save.finish();
    });
    await page.reload();
    assert.equal(await page.locator('#btn-resume-next').innerText(), '3 임무부터 이어하기');
    assert.equal(await page.locator('#btn-continue').count(), 0);
    assert.equal(await page.locator('#btn-m3 .mc-next').innerText(), '다음은 여기');
    assert.equal(await page.locator('.mc-next').count(), 1, '배지는 한 곳');
    assert.equal(await page.locator('#btn-practice .mc-first').count(), 0);
    const st = await page.evaluate(() => {
      const a = getComputedStyle(document.querySelector('#btn-m3 .mc-next')), b = document.createElement('span');
      b.className = 'mc-first'; document.querySelector('#btn-m3 .mc-body').appendChild(b); const c = getComputedStyle(b);
      const out = { bg: [a.backgroundColor, c.backgroundColor], color: [a.color, c.color], radius: [a.borderRadius, c.borderRadius], size: [a.fontSize, c.fontSize] };
      b.remove(); return out;
    });
    for (const k of Object.keys(st)) assert.equal(st[k][0], st[k][1], '연습 카드 배지와 같은 모양: ' + k);
    assert.doesNotMatch(await page.locator('#title-guide .tl-bubble').innerText(), /도시가 다 이어졌어/);
    await page.screenshot({ path: shotPath('playtest-title-next-1280') });
    await page.locator('#btn-resume-next').click();
    await page.locator('#screen-story').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => DR.App.state.mission), 'm3');
    // 다 깸 → 처음부터 다시(확인 창) + 봇 대사 따로
    await page.evaluate(() => { DR.Save.setRecord('m3', { cleared: true }); DR.Save.setRecord('m4', { cleared: true }); DR.Save.finish(); });
    await page.reload();
    assert.equal(await page.locator('#btn-restart').innerText(), '처음부터 다시');
    assert.equal(await page.locator('#btn-resume-next').count(), 0);
    assert.equal(await page.locator('.mc-next').count(), 0);
    const bubble = await page.locator('#title-guide .tl-bubble').innerText();
    assert.doesNotMatch(bubble, /비만 오면/);
    assert.match(bubble, /도시가 다 이어졌어/);
    assert.equal(await page.evaluate(() => DR.TitleScene.state().lineSet), 'done');
    await page.screenshot({ path: shotPath('playtest-title-done-1280') });
    await page.locator('#btn-restart').click();
    assert.match(await page.locator('dialog.modal').innerText(), /처음부터 할까요/);
    await page.keyboard.press('Escape');
    // 진행 중 튜토리얼 세이브(옛 그대로) → 이어하기 → 브리핑
    await page.evaluate(() => { localStorage.clear(); DR.Save.checkpoint('briefing', { mission: 'tutorial', bag: [], supplements: 0, firstTry: null, seed: 7 }, {}); });
    await page.reload();
    assert.equal(await page.locator('#btn-continue').count(), 1, '튜토리얼 도중 = 이어하기');
    assert.equal(await page.locator('#btn-practice .mc-first').count(), 1, '튜토리얼 도중이면 아직 처음');
    await page.locator('#btn-continue').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    // 옛 형식(cityV 없음, records.tutorial 없음) + 1 임무만 깸 → 2 임무부터 이어하기
    await page.evaluate(() => { localStorage.setItem('ethicity.data.save', JSON.stringify({ v: 1, mission: null, tutorialDone: true, records: { m1: { cleared: true, firstTry: true, supplements: 0 } } })); DR.App.records = DR.Save.records(); });
    await page.reload();
    assert.equal(await page.locator('#btn-resume-next').innerText(), '2 임무부터 이어하기');
    assert.equal(await page.locator('#title-city').getAttribute('data-count'), '2', '옛 세이브 도시 칸 그대로');
    // 튜토리얼만 끝냄 → 1 임무부터 이어하기
    await page.evaluate(() => { localStorage.setItem('ethicity.data.save', JSON.stringify({ v: 1, mission: null, tutorialDone: true, cityV: 1, records: { tutorial: { cleared: true } } })); });
    await page.reload();
    assert.equal(await page.locator('#btn-resume-next').innerText(), '1 임무부터 이어하기');
    assert.equal(await page.locator('#btn-m1 .mc-next').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  console.log('ok 4 next mission · 11 done bot line · old saves');
}

/* ---------- 5. 검수 안내 · 크게 보기 구조 ---------- */
if (want(5)) {
  for (const [id, fill] of [['m1', { umbrella_open: 3 }], ['m2', { can_drink: 2 }]]) {
    const { browser, page, errors } = await openGame({ viewport: W, query: '?start=' + id });
    try {
      await toRun(page);
      await fillAndInspect(page, fill);
      const t = await page.locator('#screen-inspect').innerText();
      if (id === 'm1') { assert.match(t, /그림을 보고 필요 없는 카드는 뺀다\./); assert.doesNotMatch(t, /이름표를 고치거나/); }
      else assert.match(t, /이름표를 고치거나 뺀다/);
      await page.locator('#inspect-grid .bag-open').first().click();
      const g = await page.evaluate(() => {
        const p = document.querySelector('#inspect-zoom .zoom-panel'), head = p.firstElementChild, close = document.getElementById('btn-zoom-close'), art = p.querySelector('.zoom-art');
        const pr = p.getBoundingClientRect(), ar = art.getBoundingClientRect(), cr = close.getBoundingClientRect();
        return { headIsFirst: head.classList.contains('zoom-head'), closeInHead: head.contains(close), closes: p.querySelectorAll('button').length && [...p.querySelectorAll('button')].filter((b) => b.textContent.trim() === '닫기').length,
          artMid: ar.x + ar.width / 2, panelMid: pr.x + pr.width / 2, closeTop: cr.top - pr.top, closeRight: pr.right - cr.right };
      });
      assert.ok(g.headIsFirst && g.closeInHead, id + ' 닫기 = 위쪽 머리줄');
      assert.equal(g.closes, 1, id + ' 닫기 하나');
      assert.ok(Math.abs(g.artMid - g.panelMid) <= 2, id + ' 사진 가운데 ' + JSON.stringify(g));
      assert.ok(g.closeTop < 40 && g.closeRight < 40, id + ' 닫기 오른쪽 위 ' + JSON.stringify(g));
      await page.screenshot({ path: shotPath('playtest-zoom-' + id) });
      await page.locator('#btn-zoom-close').click();
      assert.equal(await page.locator('#inspect-zoom').count(), 0);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
  console.log('ok 5 inspect note · zoom layout');
}

/* ---------- 7·8·13. 보충 준비: 필요 칸 = 부족 장수 · 지난 판 노이즈 경고 · 카드 전체 접기 ---------- */
if (want(7, 8, 13)) {
  const { browser, page, errors } = await openGame({ viewport: W, query: '?start=m1' });
  try {
    await toRun(page);
    // 드문 모습(접힌 우산·열린 지갑·뒷면 폰)을 안 줍고 흔한 것만 22장(개인정보 카드 2장은 debugFill이 건너뜀) → 부족 3+3+3 = 9장, 빈 칸 8
    await fillAndInspect(page, { umbrella_open: 8, wallet_closed: 7, phone_front: 7 });
    // 8: 첫 달리기에서 노이즈로 2장 잃은 것으로(보충 뒤에 남으면 안 되는 값)
    await page.evaluate(() => { DR.App.state.lost = 2; });
    await submit(page);
    await results(page);
    await page.locator('#screen-prep').waitFor({ state: 'visible', timeout: 10000 });
    const prep = await page.locator('#screen-prep').innerText();
    assert.match(prep, /9칸 이상 비어 있어야/, '필요 칸 = 부족 장수 합');
    assert.match(await page.locator('#prep-need').innerText(), /1칸 더 비워야/);
    assert.equal(await page.locator('#btn-supplement').isDisabled(), true);
    // 13: 카드 전체 그리드는 접혀 있다
    assert.equal(await page.locator('#prep-grid').isVisible(), false, '처음엔 접힘');
    assert.equal(await page.locator('#btn-prep-all').getAttribute('aria-expanded'), 'false');
    await page.screenshot({ path: shotPath('playtest-prep-1280'), fullPage: true });
    await openPrepAll(page);
    assert.equal(await page.locator('#prep-grid').isVisible(), true);
    await page.locator('#prep-grid .bag-card[data-key="umbrella_open"] .btn-remove').first().click();
    assert.equal(await page.locator('#prep-grid').isVisible(), true, '다시 그려도 펼친 채');
    // 7: 출발 가능 = 분홍 경고 아님
    assert.match(await page.locator('#prep-need').innerText(), /출발할 수 있어요/);
    const look = await page.evaluate(() => { const n = document.getElementById('prep-need'), s = getComputedStyle(n); return { cls: n.className, border: s.borderTopColor }; });
    assert.match(look.cls, /notice-ok/);
    assert.notEqual(look.border, 'rgb(255, 95, 176)', '분홍 테두리 아님');
    assert.equal(await page.locator('#btn-supplement').isDisabled(), false);
    await page.screenshot({ path: shotPath('playtest-prep-ok-1280'), fullPage: true });
    // 8: 보충 달리기(벽 안 맞음) 뒤 검수에 지난 판 노이즈 경고 없음
    await page.locator('#btn-supplement').click();
    await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 10000 });
    await fillAndInspect(page, { umbrella_folded: 3 });
    assert.equal(await page.locator('#inspect-lost').count(), 0, '지난 판 경고 없음');
    assert.equal(await page.evaluate(() => DR.App.state.lost), 0);
    // 이번 달리기에서 잃었으면 그 수만, '이번 달리기' 기준이라고 말한다
    await page.evaluate(() => { DR.App.state.lost = 1; DR.UI.inspect(DR.Missions.m1, DR.App.state.bag, () => {}, { lost: DR.App.state.lost }); });
    assert.equal(await page.locator('#inspect-lost').innerText(), '이번 달리기에서 노이즈로 잃은 카드 1장');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  console.log('ok 7 need slots · 8 lost reset · 13 grid folded');
}

/* ---------- 10. 도시 복구 가운데 정렬(그림 있음·없음) ---------- */
if (want(10)) {
  for (const viewport of [W, { width: 375, height: 812 }]) {
    const { browser, page, errors } = await openGame({ viewport });
    try {
      for (const missing of [false, true]) {
        await page.evaluate((missing) => {
          window.__cityPath = window.__cityPath || DR.UI.city.path;
          DR.UI.city.path = missing ? 'assets/city/__missing__-' : window.__cityPath;
          DR.UI.city({ from: 1, to: 2, line: '분실물 센터 AI가 다시 이어졌다' }, () => {});
        }, missing);
        await page.locator('#screen-city').click({ position: { x: 5, y: 5 } }); // 건너뛰기 = 바로 ready
        await page.waitForFunction(() => document.querySelector('.city-page').dataset.phase === 'ready', null, { timeout: 5000 });
        await page.waitForTimeout(200); // 점 새 칸은 0.06초 뒤에 켜진다
        const g = await page.evaluate(() => {
          const r = (s) => { const e = document.querySelector(s); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return b.x + b.width / 2; };
          const page = document.querySelector('.city-page').getBoundingClientRect();
          return { mid: page.x + page.width / 2, kicker: r('.city-page .kicker'), dots: r('.city-dots-big'), line: r('#city-line'), next: r('#btn-city-next'), art: r('#city-art') };
        });
        for (const k of ['kicker', 'dots', 'line', 'next', 'art']) {
          if (g[k] === null) continue; // 그림이 보이면 큰 점은 숨김, 그림이 없으면 그림 자리 숨김
          assert.ok(Math.abs(g[k] - g.mid) <= 2, `${viewport.width} ${missing ? '그림 없음' : '그림'} ${k} 가운데 ${JSON.stringify(g)}`);
        }
        assert.ok(missing ? g.dots !== null : g.art !== null, JSON.stringify(g));
        await page.screenshot({ path: shotPath('playtest-city-' + (missing ? 'noart-' : '') + viewport.width) });
      }
      assert.deepEqual(errors.filter((e) => !/__missing__/.test(e)), []);
    } finally { await browser.close(); }
  }
  console.log('ok 10 city centered');
}

/* ---------- 12. 임무 완료 화면에 시뮬레이션 안내를 또 쓰지 않는다(감독관 대사에 있음) ---------- */
if (want(12)) {
  const { browser, page, errors } = await openGame({ viewport: W });
  try {
    await page.evaluate(() => { const m = DR.Missions.m1; DR.UI.outro(m.story.outro, () => {}, { kicker: m.title + ' 완료', summary: ['보충 달리기: 0번'] }); });
    const said = [];
    for (let i = 0; i < 6 && await page.locator('#screen-story').isVisible(); i++) { said.push(await page.locator('#screen-story .dialog-text').innerText()); await page.locator('#screen-story .dialog').click(); }
    await page.locator('#screen-outro').waitFor({ state: 'visible' });
    assert.ok(said.some((t) => /시뮬레이션/.test(t)), '감독관 대사에는 남김 ' + said.join(' | '));
    assert.doesNotMatch(await page.locator('#screen-outro').innerText(), /단순화한 규칙|시뮬레이션/, '완료 화면에는 없음');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  console.log('ok 12 simulation note once');
}
console.log('PASS playtest');
