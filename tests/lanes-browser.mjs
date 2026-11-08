// 4 임무만 4레인(2026-11-09 사용자 결정 "마지막 미션에서만 4개", 계획 docs/plans/2026-11-09-m4-four-lanes.md).
// A) 4 임무 1280·390: 레인 4개(출발 = 레인 1), 키로 끝까지(0·3에서 멈춤), 불 경고 4칸, 러너가 어느 레인에 있든 네 레인 가운데가 화면 안,
//    한 판을 굴리며 화면 카드(DOM)는 늘 화면 안·서로 안 겹침, 레인 순서대로 왼쪽→오른쪽, 레인 3 카드를 키로 잡기. 스크린샷.
// B) 연습(3레인)은 그대로 — 레인 3개, 출발 1, 끝 2, 불 경고 3칸, 레인 x 예전 값.
// C) 4 임무 휴대폰(390, 터치): 오른쪽으로 세 번 밀면 레인 3.
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

async function toRun(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
}
const key = (page, code, n = 1) => page.evaluate(([code, n]) => { for (let i = 0; i < n; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code })); DR.Run.step(0.3); }, [code, n]);

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const { browser, page, errors } = await openGame({ viewport: vp, query: '?start=m4' });
  try {
    await toRun(page);
    let p = await page.evaluate(() => DR.Run.peek());
    assert.equal(p.lanes, 4);
    assert.equal(p.lane, 1, 'starts left of centre');
    assert.deepEqual(p.laneX.map((x) => +x.toFixed(2)), [-3.6, -1.2, 1.2, 3.6]);
    assert.equal(await page.locator('.fire-warning').count(), 4);
    assert.ok(await page.locator('.run-feedback.lanes-4').count());
    await key(page, 'ArrowRight', 3);
    assert.equal((await page.evaluate(() => DR.Run.peek())).lane, 3, 'right ×3 = lane 3');
    await key(page, 'ArrowRight');
    assert.equal((await page.evaluate(() => DR.Run.peek())).lane, 3, 'stops at the right edge');
    // 오른쪽 끝에서 네 레인 가운데가 다 화면 안(가까이 8m·멀리 40m)
    const inside = async (tag) => {
      for (const d of [8, 20, 40]) {
        const xs = await page.evaluate((d) => DR.Run.laneScreen(d), d);
        for (const [l, pt] of xs.entries()) assert.ok(pt.x > 4 && pt.x < vp.width - 4, `${vp.width} ${tag} lane ${l} at ${d}m: x ${pt.x.toFixed(0)}`);
        for (let l = 1; l < 4; l++) assert.ok(xs[l].x > xs[l - 1].x, 'lanes left to right');
      }
    };
    await inside('runner lane 3');
    await key(page, 'ArrowLeft', 5);
    assert.equal((await page.evaluate(() => DR.Run.peek())).lane, 0, 'stops at the left edge');
    await inside('runner lane 0');

    // 한 판 굴리기: 화면 카드가 화면 밖으로 나가거나 겹치지 않는가. 레인 3 카드 하나를 키로 잡는다
    const r = await page.evaluate((W) => {
      const items = DR.Run.course().items, cfg = DR.config, bad = [];
      const k = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code }));
      const target = items.find((it) => it.kind === 'card' && it.lane === 3 && it.z > 60 && !items.some((w) => w.kind === 'wall' && w.lane === 3 && w.z < it.z && it.z - w.z < 40));
      const lanesSeen = new Set();
      for (let i = 0; i < 4000 && DR.Run.peek().running; i++) {
        const p = DR.Run.peek();
        if (p.runnerZ > target.z + 5 && lanesSeen.size === 4) break;
        if (!DR.Run.isTaken(target.uid) && target.z - p.runnerZ < p.speed * 2.5) {
          if (p.lane < 3) k('ArrowRight');
          else if (DR.Catch.phase(target, p.runnerZ, p.speed, cfg) === 'active') k('Space');
        }
        const els = [...document.querySelectorAll('.run-card[data-uid]')].filter((el) => !el.hidden);
        const stage = document.getElementById('run-stage').getBoundingClientRect();
        const rects = els.map((el) => { const b = el.getBoundingClientRect(); return { uid: el.dataset.uid, lane: items.find((x) => x.uid === el.dataset.uid).lane, l: b.left - stage.left, r: b.right - stage.left, t: b.top - stage.top, b: b.bottom - stage.top, w: b.width }; });
        for (const a of rects) {
          if (a.l < -0.5 || a.r > W + 0.5) bad.push(`off-screen ${a.uid} ${a.l.toFixed(0)}..${a.r.toFixed(0)}`);
          lanesSeen.add(a.lane);
          for (const b of rects) if (a !== b && a.lane < b.lane && a.r > b.l + 0.5 && a.b > b.t && b.b > a.t) bad.push(`overlap ${a.uid}(lane ${a.lane}) ${b.uid}(lane ${b.lane}) ${(a.r - b.l).toFixed(0)}px of ${a.w.toFixed(0)}/${b.w.toFixed(0)} z ${items.find((x) => x.uid === a.uid).z.toFixed(1)}/${items.find((x) => x.uid === b.uid).z.toFixed(1)} rz ${p.runnerZ.toFixed(1)}`);
        }
        DR.Run.step(0.03);
      }
      return { bad: bad.slice(0, 12), taken: DR.Run.isTaken(target.uid), target: target.uid, lanesSeen: [...lanesSeen].sort() };
    }, vp.width);
    assert.deepEqual(r.bad, [], `${vp.width} dom cards`);
    assert.ok(r.taken, 'caught a lane-3 card with the keys ' + r.target);
    assert.deepEqual(r.lanesSeen, [0, 1, 2, 3], 'screen cards appeared in all four lanes');
    // 스크린샷: 화면 카드가 둘 이상 보이는 순간까지 조금씩
    for (let i = 0; i < 400; i++) {
      const n = await page.evaluate(() => { DR.Run.step(0.03); return document.querySelectorAll('.run-card[data-uid]:not([hidden])').length; });
      if (n >= 2) break;
    }
    const w = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.run-card[data-uid]:not([hidden])')].map((e) => e.getBoundingClientRect().width)));
    if (vp.width < 600) assert.ok(w >= 78, 'narrow cards still readable width ' + w);
    await page.screenshot({ path: shotPath('lanes-m4-' + vp.width) });
    assert.deepEqual(errors, []);
    console.log('ok m4 4 lanes', vp.width, 'card width', w.toFixed(0));
  } finally { await browser.close(); }
}

{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?run=tutorial' });
  try {
    await page.waitForFunction(() => DR.Run && DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => DR.Run.setPaused(true));
    const p = await page.evaluate(() => DR.Run.peek());
    assert.equal(p.lanes, 3);
    assert.equal(p.lane, 1);
    assert.deepEqual(p.laneX.map((x) => +x.toFixed(2)), [-2.4, 0, 2.4]);
    assert.equal(await page.locator('.fire-warning').count(), 3);
    await key(page, 'ArrowRight', 3);
    assert.equal((await page.evaluate(() => DR.Run.peek())).lane, 2);
    assert.deepEqual(errors, []);
    console.log('ok tutorial 3 lanes');
  } finally { await browser.close(); }
}

{
  const { browser, page, errors } = await openGame({ viewport: { width: 390, height: 844 }, hasTouch: true, query: '?run=m4' });
  try {
    await page.waitForFunction(() => DR.Run && DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => DR.Run.setPaused(true));
    const cdp = await page.context().newCDPSession(page);
    const swipe = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 500 }] });
      for (const x of [160, 200, 240]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 502 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    for (let i = 0; i < 3; i++) await swipe();
    assert.equal(await page.evaluate(() => DR.Run.peek().lane), 3, 'swipe right ×3');
    await swipe();
    assert.equal(await page.evaluate(() => DR.Run.peek().lane), 3);
    assert.deepEqual(errors, []);
    console.log('ok m4 swipes');
  } finally { await browser.close(); }
}
console.log('PASS lanes');
