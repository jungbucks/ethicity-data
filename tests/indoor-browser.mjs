// 달리기 무대 2차 = 2·4 임무 실내 무대(설계 docs/specs/2026-11-08-run-indoor-stages-design.md, 계획 docs/plans/2026-11-09-run-indoor-stages.md).
// A) 2 임무 선별장 1280: 실내 층(하늘·도시 2·창 색조·벽 그림·비) + 선별장 그림, 구역 4개마다 look·창빛·분류함 색(어둡게, 카드 테두리와 같은 색상), 초록 벨트 바닥, 소품은 레인 밖. 스크린샷 구역 4개.
// B) 4 임무 1280·390: S1 채점 센터(그림·남색 벨트) → S4 교무실(그림·바닥·안개 바뀜), 스캐너 문·교무실 문, 도장 팔·답안지가 움직임. 스크린샷 S1·S4.
// C) ?low=1 · 움직임 줄이기: 벽·도시 층·경광등·도장·답안지 멈춤.
// D) 실내 그림을 못 읽으면 그 층만 숨김(하늘·도시는 그대로).
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const ready = async (page) => {
  await page.waitForFunction(() => DR.Run && DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
  await page.waitForFunction(() => [...document.querySelectorAll('#run-stage .rw-layer')].filter((e) => e.classList.contains('rw-wall')).every((e) => !e.hidden));
};
const toZone = (page, id) => page.evaluate((id) => {
  const zone = DR.Run.course().zones.find((z) => z.id === id);
  while (DR.Run.peek().runnerZ < zone.start + 6) DR.Run.step(0.05);
}, id);
const peek = (page) => page.evaluate(() => DR.Run.peek());
const bg = (page, cls) => page.evaluate((cls) => getComputedStyle(document.querySelector('#run-stage .' + cls)).backgroundImage, cls);

// A. 2 임무
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?run=m2' });
  try {
    await ready(page);
    let p = await peek(page);
    assert.ok(p.scenery, 'scenery made ' + JSON.stringify(errors));
    assert.equal(p.world.indoor, true); assert.equal(p.world.room, 'sorting'); assert.equal(p.world.layers, 6);
    assert.equal(p.world.time, 'day'); assert.equal(p.world.rain, false);
    assert.equal(p.scenery.theme, 'sorting', 'theme name kept');
    assert.match(await bg(page, 'rw-wall'), /int-sorting\.webp/);
    assert.match(await bg(page, 'rw-sky'), /bg-sky-day\.webp/, 'day city through the windows');
    const pal = await page.evaluate(() => DR.BridgeLook.PALETTE.sorting);
    assert.equal(p.world.deck, pal.deck, 'dark green rubber belt');
    assert.ok(p.scenery.props.minX > 4.2, 'props stay off the lanes');
    const seen = {};
    for (const id of ['S1', 'S2', 'S3', 'S4']) {
      await toZone(page, id);
      p = await peek(page);
      assert.equal(p.scenery.zone, id);
      assert.equal(p.world.look, 'm2-' + id);
      const exp = await page.evaluate((id) => {
        const m = DR.Missions.m2, sc = m.scenes.find((s) => s.id === id), B = DR.CardArt.binColors, labels = [];
        const lab = (fid) => m.cardTypes[fid] ? m.cardTypes[fid].label : (m.fakes.find((f) => f.id === fid) || {}).truth ? m.cardTypes[m.fakes.find((f) => f.id === fid).truth].label : 'trash';
        sc.art.focus.forEach((f) => { const l = lab(f); if (!labels.includes(l)) labels.push(l); });
        if (sc.art.wrongBin && !labels.includes(sc.art.wrongBin)) labels.push(sc.art.wrongBin);
        return labels.map((l) => DR.BridgeLook.dimBin(B[l]));
      }, id);
      assert.deepEqual(p.scenery.bins, exp, id + ' bins = zone bin colours, dimmed');
      seen[id] = { tint: await page.evaluate(() => getComputedStyle(document.querySelector('#run-stage .rw-tint')).backgroundColor), bins: p.scenery.bins.join() };
      await page.evaluate(() => { for (let i = 0; i < 6; i++) DR.Run.step(0.05); });
      await page.screenshot({ path: shotPath('indoor-m2-' + id + '-1280') });
    }
    assert.equal(new Set(Object.values(seen).map((s) => s.tint)).size, 4, 'window light shifts per zone');
    assert.ok(new Set(Object.values(seen).map((s) => s.bins)).size >= 3, 'bin colours signal the zone');
    // 움직임: 벽·도시 층이 은은하게 흐름, 경광등 날개가 돎
    const a = await peek(page); await page.evaluate(() => { for (let i = 0; i < 10; i++) DR.Run.step(0.05); }); const b = await peek(page);
    assert.notEqual(a.world.wallShift, b.world.wallShift, 'wall layer drifts');
    assert.notEqual(a.scenery.beacon, b.scenery.beacon, 'beacon turns');
    assert.deepEqual(errors, []);
    console.log('ok m2 sorting hall');
  } finally { await browser.close(); }
}

// B. 4 임무 채점 센터 → 교무실
for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const { browser, page, errors } = await openGame({ viewport: vp, query: '?run=m4' });
  try {
    await ready(page);
    let p = await peek(page);
    assert.equal(p.lanes, 4);
    assert.equal(p.world.room, 'grading'); assert.equal(p.scenery.theme, 'exam', 'theme name kept');
    assert.match(await bg(page, 'rw-wall'), /int-grading\.webp/);
    const pal = await page.evaluate(() => DR.BridgeLook.PALETTE);
    assert.equal(p.world.deck, pal.grading.deck, 'dark navy belt');
    assert.ok(p.scenery.props.minX > 5.4, 'props stay off the 4-lane belt');
    assert.ok(p.scenery.props.gates >= 3, 'scanner gates + office door');
    await toZone(page, 'S1');
    await page.evaluate(() => { for (let i = 0; i < 4; i++) DR.Run.step(0.05); });
    const h0 = (await peek(page)).scenery;
    await page.evaluate(() => { for (let i = 0; i < 9; i++) DR.Run.step(0.05); });
    const h1 = (await peek(page)).scenery;
    assert.ok(h0.headY !== h1.headY || h0.sheetZ !== h1.sheetZ, 'stamps / sheets move');
    await page.screenshot({ path: shotPath('indoor-m4-S1-' + vp.width) });
    await toZone(page, 'S4');
    p = await peek(page);
    assert.equal(p.world.look, 'm4-S4'); assert.equal(p.world.room, 'office');
    assert.equal(p.world.deck, pal.office.deck); assert.equal(p.world.fog, pal.office.fog);
    assert.match(await bg(page, 'rw-wall'), /int-teachers-office\.webp/);
    assert.ok(await page.evaluate(() => document.getElementById('run-stage').classList.contains('rw-room-office')));
    await page.evaluate(() => { for (let i = 0; i < 6; i++) DR.Run.step(0.05); });
    await page.screenshot({ path: shotPath('indoor-m4-S4-' + vp.width) });
    assert.deepEqual(errors, []);
    console.log('ok m4 grading → office', vp.width);
  } finally { await browser.close(); }
}

// C. 저사양·움직임 줄이기 = 멈춤
for (const [query, reduced] of [['?run=m2&low=1', false], ['?run=m4', true], ['?run=m2', true]]) {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query });
  try {
    if (reduced) { await page.emulateMedia({ reducedMotion: 'reduce' }); await page.reload(); }
    await ready(page);
    const a = await peek(page);
    assert.equal(a.world.moving, false, query);
    await page.evaluate(() => { for (let i = 0; i < 30; i++) DR.Run.step(0.05); });
    const b = await peek(page);
    assert.equal(b.world.wallShift, a.world.wallShift, 'wall still'); assert.equal(b.world.cityShift, a.world.cityShift, 'city still');
    if (b.scenery.theme === 'sorting') assert.equal(b.scenery.beacon, a.scenery.beacon, 'beacon still');
    else { assert.equal(b.scenery.headY, a.scenery.headY, 'stamp still'); assert.equal(b.scenery.sheetZ, a.scenery.sheetZ, 'sheets still'); }
    assert.deepEqual(errors, []);
    console.log('ok still', query, reduced ? 'reduced' : '');
  } finally { await browser.close(); }
}

// D. 실내 그림을 못 읽음 → 벽 층만 숨김
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await page.evaluate(() => { ['S1', 'S2', 'S3', 'S4'].forEach((z) => { DR.BridgeLook.look('m2', z).art = 'assets/title/int-missing.webp'; }); });
    await page.locator('#btn-skip').click();
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
    await page.waitForFunction(() => DR.Run.peek().world.artHidden === true, null, { timeout: 8000 });
    const vis = await page.evaluate(() => [...document.querySelectorAll('#run-stage .rw-layer')].map((e) => [e.className.split(' ')[1], !e.hidden]));
    assert.deepEqual(vis.filter(([k]) => ['rw-sky', 'rw-far', 'rw-mid'].includes(k)).map(([, v]) => v), [true, true, true], 'city still shown');
    assert.equal(vis.find(([k]) => k === 'rw-wall')[1], false);
    await page.screenshot({ path: shotPath('indoor-m2-noart-1280') });
    assert.deepEqual(errors.filter((e) => !/int-missing\.webp/.test(e)), []);
    console.log('ok missing art');
  } finally { await browser.close(); }
}
console.log('PASS indoor');
