// 3·4 임무 플레이테스트 수정(2026-11-18, docs/feedback/2026-11-18-playtest-m3-m4.md) — 화면 확인 + 스크린샷 _shot-pt1118-*.
//   node tests/pt1118-browser.mjs [guide|city|size|scenes|prep]  (없으면 전부, 한 번에 브라우저 하나)
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const ONLY = process.argv[2] || '';
const run = (name) => !ONLY || ONLY === name;
const ALL = { station_now: 2, station_rain: 2, market_now: 2, market_old: 1, market_eve_old: 2, river_now: 2, river_night: 2, crossing_now: 2, crossing_rain: 2 };

/* P0-1: 역 앞 — 지금 광장 사진이 모자람(옛 사진 없음) / 철거 전 빌딩 2장이 남음 */
async function guideCase(fill, tag) {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m3' });
  try {
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 15000 });
    await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, fill);
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 30000 });
    await page.evaluate(() => { DR.config.conveyor.step = 0.05; });
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    await page.locator('#screen-guide').waitFor({ state: 'visible' });
    await page.locator('#btn-gd-skip').click();
    const g1 = (await page.locator('#screen-guide .gd-item[data-id="g1"]').innerText()).replace(/\s+/g, ' ');
    await page.locator('#screen-guide .gd-item[data-id="g1"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('pt1118-guide-' + tag + '-1280') });
    await page.locator('#btn-gd-next').click();
    await page.locator('#screen-result .result-scene[data-scene="S1"]').waitFor({ state: 'visible' });
    const chip = (await page.locator('#screen-result .chip').innerText()).trim();
    const res = (await page.locator('#screen-result').innerText()).replace(/\s+/g, ' ');
    await page.screenshot({ path: shotPath('pt1118-result-' + tag + '-1280'), fullPage: true });
    assert.deepEqual(errors, []);
    return { g1, chip, res };
  } finally { await browser.close(); }
}
if (run('guide')) {
  const s = await guideCase({ ...ALL, station_now: 1 }, 'short');
  assert.match(s.g1, /예전 지도대로라면 빌딩 앞에서 왼쪽입니다/, s.g1);
  assert.match(s.g1, /지금 광장 사진이 적어서/);
  assert.ok(!/철거/.test(s.g1), 'no demolished-building note: ' + s.g1);
  assert.equal(s.chip, '길을 헷갈렸다 · 불편');
  assert.ok(!/철거|옛길/.test(s.res), 'result page does not read as old photos: ' + s.res);
  assert.match(s.res, /지금의 역 앞 광장 사진/);
  assert.match(s.res, /길 안내 시연에서 잘못 안내한 질문.*지금 광장 사진이 적어서/, 'wrong-question list uses the shortage note');
  console.log('ok guide shortage —', s.chip);
  const c = await guideCase({ ...ALL, o_station: 2 }, 'contam');
  assert.match(c.g1, /역 앞 빌딩 앞에서 왼쪽으로 꺾으세요\./);
  assert.match(c.g1, /그 빌딩은 2024년에 철거됐다\./);
  assert.equal(c.chip, '옛길로 안내했다 · 불편');
  assert.match(c.res, /길 안내 시연에서 잘못 안내한 질문.*그 빌딩은 2024년에 철거됐다/);
  console.log('ok guide contamination —', c.chip);
}

/* P0-2·P1-7: 도시 복구 화면 — 깬 임무 구간만 켜진다(뒤 활동 이어하기로 바로 연다) */
// step 3 = 챕터 끝 마지막 단계부터(실제 흐름처럼 챕터 끝 → 도시 복구로 넘어간다)
async function cityCase(viewport, records, mission, city, tag, step = 4) {
  const { browser, page, errors } = await openGame({ viewport });
  try {
    await page.evaluate(([recs, e]) => {
      localStorage.setItem('ethicity.data.save', JSON.stringify({ v: 1, cityV: 1, mission: null, tutorialDone: true, records: recs, ending: e }));
    }, [records, { mission, step, city, peer: 'none', compare: null }]);
    await page.reload();
    await page.evaluate(() => { DR.App.records = DR.Save.records(); DR.App.resumeEnding(DR.Save.ending()); });
    if (step === 3) {
      await page.locator('#ch-note').fill('목적에 맞는지 확인하겠다');
      await page.locator('#btn-ch-done').click();
    }
    await page.locator('#screen-city .city-page[data-phase="ready"]').waitFor({ state: 'attached', timeout: 15000 });
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => {
      const art = document.querySelector('#city-art'), r = art.getBoundingClientRect();
      return {
        line: document.querySelector('#city-line').textContent, sections: art.getAttribute('data-sections'), bySec: art.classList.contains('city-sections'),
        on: [...document.querySelectorAll('#screen-city .city-dots i')].map((i) => i.classList.contains('on') ? 1 : 0).join(''),
        secs: [...art.querySelectorAll('.city-sec')].map((i) => i.dataset.sec).join(','), hidden: art.hidden,
        left: r.left, right: r.right, vw: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth
      };
    });
    await page.screenshot({ path: shotPath('pt1118-city-' + tag) });
    assert.deepEqual(errors, []);
    return o;
  } finally { await browser.close(); }
}
const C = { cleared: true };
if (run('city')) {
  const a = await cityCase({ width: 1280, height: 800 }, { m3: C }, 'm3', { from: 0, to: 1 }, 'm3only-1280');
  assert.equal(a.line, '도시 1/5 — 길 안내 AI가 다시 이어졌다'); assert.equal(a.sections, '3'); assert.equal(a.bySec, true); assert.equal(a.secs, '');
  assert.equal(a.on, '00010'); assert.equal(a.hidden, false);
  console.log('ok city m3 only', a);
  const b = await cityCase({ width: 1280, height: 800 }, { m3: C, m4: C }, 'm4', { from: 1, to: 2 }, 'm3m4-1280');
  assert.equal(b.line, '도시 2/5 — 채점 AI까지, 도시가 다시 이어졌다'); assert.equal(b.sections, '3,4'); assert.equal(b.secs, '3'); assert.equal(b.on, '00011');
  console.log('ok city m3+m4', b);
  const t = await cityCase({ width: 1280, height: 800 }, { tutorial: C, m3: C }, 'm3', { from: 1, to: 2 }, 'tut-m3-1280');
  assert.equal(t.line, '도시 2/5 — 길 안내 AI가 다시 이어졌다'); assert.equal(t.secs, '0'); assert.equal(t.on, '10010');
  console.log('ok city tutorial+m3', t);
}
if (run('size')) {
  for (const vp of [{ width: 1148, height: 977 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const m2rec = { cleared: true, chapter: { req: { first: 'refuse', last: 'refuse' }, concept: { first: 'b', last: 'b' }, note: '' } };
    const o = await cityCase(vp, { tutorial: C, m1: C, m2: m2rec }, 'm2', { from: 2, to: 3 }, 'size-' + vp.width, 3);
    assert.ok(o.left >= 0 && o.right <= o.vw + 0.5, `${vp.width}: art inside the screen ${o.left}..${o.right} / ${o.vw}`);
    assert.ok(Math.abs(o.left - (o.vw - o.right)) <= 1.5, `${vp.width}: centered ${o.left} vs ${o.vw - o.right}`);
    assert.ok(o.scrollW <= o.vw, `${vp.width}: no sideways scroll`);
    console.log('ok city size', vp.width, o.left, o.right, o.vw);
  }
}
/* P1-8 4 임무 장면별로 모아 보기 · P1-9 보충 준비(3 임무 줄 순서, 4 임무 공통 묶음 여유) */
async function startRun(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor({ state: 'visible' });
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 15000 });
}
async function toPrep(page) {
  // 시연(건너뛰기) → 장면 결과 → (4 임무 결판 대화) → 보충 준비
  for (let n = 0; n < 60 && !(await page.locator('#screen-prep').isVisible()); n++) {
    if (await page.locator('#btn-gd-skip').isVisible()) { await page.locator('#btn-gd-skip').click(); continue; }
    if (await page.locator('#btn-gd-next').isVisible()) { await page.locator('#btn-gd-next').click(); continue; }
    if (await page.locator('#btn-gr-skip').isVisible()) { await page.locator('#btn-gr-skip').click(); continue; }
    if (await page.locator('#btn-gr-next').isVisible()) { await page.locator('#btn-gr-next').click(); continue; }
    if (await page.locator('#screen-result .result-scene').isVisible()) { await page.locator('#btn-next').click(); continue; }
    if (await page.locator('#screen-story').isVisible()) { await page.locator('#screen-story .dialog').click(); continue; }
    await page.waitForTimeout(200);
  }
  await page.locator('#screen-prep').waitFor({ state: 'visible', timeout: 10000 });
}
const NEAT8 = { neat_data: 2, neat_algo: 2, neat_ai: 2, neat_ml: 2, cur_ai: 2, cur_algo: 2, alt_ai: 2, alt_data: 2, alt_ml: 2, scrawl_ml: 2 };
if (run('scenes')) {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m4' });
  try {
    await startRun(page);
    await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, NEAT8);
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 30000 });
    const sc = (id) => page.locator(`#inspect-scenes [data-scene="${id}"]`);
    const thumbs = async (id) => sc(id).locator('.scene-thumbs img').count();
    assert.match(await sc('S1').locator('[data-combo="S1_neat"]').innerText(), /\(두 장면 공통\)/);
    assert.equal(await thumbs('S1'), 8);
    assert.match((await sc('S3').locator('[data-combo="S3_neat"]').innerText()).replace(/\s+/g, ' '), /또박또박 쓴 답안: 위와 같은 카드로 함께 채움 · 현재 8장/);
    assert.equal(await thumbs('S3'), 6, "S3 thumbnails = 'AI'·'data'·띄어 쓴 머신 러닝 only (no neat again)");
    assert.match(await sc('S3').locator('[data-combo="S3_space"]').innerText(), /\(두 장면 공통\)/);
    assert.match(await sc('S4').locator('[data-combo="S4_space"]').innerText(), /위와 같은 카드로 함께 채움/);
    assert.equal(await thumbs('S4'), 2, 'S4 = 아주 흘려 쓴 머신러닝 only');
    assert.ok(!/필요/.test(await page.locator('#inspect-scenes').innerText()), 'need stays hidden before the first result');
    await sc('S3').scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('pt1118-scenes-m4-1280') });
    // 필요 수 공개 뒤(첫 결과 뒤)의 꼴
    await page.evaluate(() => { DR.App.state.needRevealed = true; DR.UI.inspect(DR.Missions.m4, DR.App.state.bag, () => {}, {}); });
    assert.match((await sc('S3').locator('[data-combo="S3_neat"]').innerText()).replace(/\s+/g, ' '), /위와 같은 카드로 함께 채움 · 8장 \/ 필요 2장/);
    assert.match((await sc('S1').locator('[data-combo="S1_neat"]').innerText()).replace(/\s+/g, ' '), /8 \/ 4장/);
    await sc('S3').scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('pt1118-scenes-m4-revealed-1280') });
    assert.deepEqual(errors, []);
    console.log('ok scenes m4');
  } finally { await browser.close(); }
}
if (run('prep')) {
  // 3 임무: 시장 골목을 '1장 빼기'로 빼도 줄 순서 그대로
  {
    const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m3' });
    try {
      await startRun(page);
      await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, { ...ALL, station_now: 1, market_now: 1, market_old: 3, market_eve_old: 3 });
      await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 30000 });
      // 담은 순서(재현): 지금 시장 골목 1장 → 저녁 시장 골목 → 옛 시장 골목(화면에선 '시장 골목'으로 셈). 같은 배열을 제자리에서 바꾼다
      await page.evaluate(() => {
        const b = DR.App.state.bag, rank = (c) => (c.key === 'market_now' ? 0 : c.key === 'market_eve_old' ? 1 : c.key === 'market_old' ? 2 : 3);
        const sorted = b.slice().sort((x, y) => rank(x) - rank(y)); b.length = 0; b.push(...sorted);
      });
      await page.evaluate(() => { DR.config.conveyor.step = 0.05; });
      await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
      await toPrep(page);
      const order = () => page.locator('#prep-summary .kind').evaluateAll((els) => els.map((e) => e.dataset.key));
      const before = await order();
      const ct = await page.evaluate(() => Object.keys(DR.Missions.m3.cardTypes));
      assert.deepEqual(before, ct.filter((k) => before.includes(k)), 'rows follow the mission kind order: ' + before);
      await page.locator('#prep-summary .kind[data-key="market_now"] button').first().click();
      await page.locator('#prep-summary .kind[data-key="market_now"] .kind-pick-card').first().click();
      const after = await order();
      assert.deepEqual(after, before, 'order kept after removing a market card');
      await page.screenshot({ path: shotPath('pt1118-prep-m3-1280'), fullPage: true });
      assert.deepEqual(errors, []);
      console.log('ok prep m3 order', after.join(','));
    } finally { await browser.close(); }
  }
  // 4 임무: 또박또박 묶음(공통 풀) 여유가 묶음 첫 줄에
  {
    const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m4' });
    try {
      await startRun(page);
      await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, { ...NEAT8, cur_ai: 1 });
      await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
      await toPrep(page);
      const rows = await page.locator('#prep-summary .kind').evaluateAll((els) => els.map((e) => e.dataset.key + '=' + e.querySelector('.combo-count').textContent));
      const neat = rows.filter((r) => r.startsWith('neat_'));
      assert.equal(neat[0], 'neat_data=2장 · 또박또박 쓴 답안 합쳐 여유 4장', rows.join(' | '));
      assert.ok(neat.slice(1).every((r) => /=2장$/.test(r)), 'once per pool: ' + neat.join(' | '));
      assert.ok(rows.includes('cur_algo=2장'), 'single-kind rows unchanged: ' + rows.join(' | '));
      await page.screenshot({ path: shotPath('pt1118-prep-m4-1280'), fullPage: true });
      assert.deepEqual(errors, []);
      console.log('ok prep m4 pool', neat.join(' | '));
    } finally { await browser.close(); }
  }
}
console.log('PASS pt1118-browser ' + (ONLY || 'all'));
