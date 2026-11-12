// 결승 "도착" 표지판(2026-11-12 사용자 결정 — Rising Banner, three.js 장면 안. js/finish-banner.js · run3d makeFinishBanner)
// A) 1280·390 × 1 임무(3레인)·4 임무(4레인), 러너는 끝 레인: 출발 땐 숨김(장면에 1개) → 결승선 통과 → 길 아래에서 솟음(올라가다 작게 넘쳤다 1로)
//    → 다 선 자리가 화면 안·HUD·패널과 안 겹침 → 어두워지기 전 0.6초 넘게 가만히 → 건너뛰기(Space)/그대로 끝 → 메시·재질·텍스처 dispose. 스크린샷(솟는 중·다 선 뒤)
// B) 다시 달리기: 표지판은 늘 1개, 처음엔 숨김
// C) HP 0: 표지판 없음  D) 움직임 줄이기: 처음부터 제자리(솟기·튕김 없음), 끝맺음 시간 그대로
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const stepUntil = (page, src, max = 12000) => page.evaluate(([src, max]) => {
  const f = new Function('p', 'b', src);
  for (let i = 0; i < max; i++) { if (f(DR.Run.peek(), DR.Run.banner())) return true; DR.Run.step(0.02); }
  return false;
}, [src, max]);
async function toRun(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
}
const toEdge = (page, code) => page.evaluate((code) => {
  for (let i = 0; i < 4; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
  for (let i = 0; i < 30; i++) DR.Run.step(0.02);
}, code);
const watchDispose = (page) => page.evaluate(() => {
  const m = DR.Run.debugBanner(), d = window.__bannerDisposed = { geometry: 0, material: 0, texture: 0 };
  m.geometry.addEventListener('dispose', () => d.geometry++);
  m.material.addEventListener('dispose', () => d.material++);
  m.material.map.addEventListener('dispose', () => d.texture++);
});
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  for (const id of ['m1', 'm4']) {
    const tag = `${id}-${vp.width}`;
    const { browser, page, errors } = await openGame({ viewport: vp, query: '?start=' + id });
    try {
      await toRun(page);
      let b = await page.evaluate(() => DR.Run.banner());
      assert.deepEqual([b.count, b.visible, b.shown], [1, false, false], tag + ' hidden at the start, one in the scene');
      await watchDispose(page);
      await stepUntil(page, 'return p.runnerZ > DR.App.course.length - 70;');
      await toEdge(page, vp.width > 500 ? 'ArrowRight' : 'ArrowLeft'); // 끝 레인 = 화면 가운데에서 가장 먼 경우
      assert.ok(await stepUntil(page, 'return !!p.finishing;'));
      const t0 = await page.evaluate(() => DR.Run.peek().t);
      b = await page.evaluate(() => DR.Run.banner());
      assert.equal(await page.evaluate(() => DR.Run.peek().finishing), 'arrive');
      assert.equal(b.shown, true, tag + ' shown on arrive');
      assert.ok(b.rise < 0.15 && b.bottom < -3, tag + ' starts under the road: ' + JSON.stringify(b));
      const aheadAtStart = b.z - b.runnerZ;
      // 솟는 중: 스크린샷 한 장(솟은 정도 0.45~0.8)
      const trace = [];
      const stepRec = (until) => page.evaluate(([src, t0]) => {
        const f = new Function('t', 'b', src), out = [];
        for (let i = 0; i < 400; i++) {
          const p = DR.Run.peek(), b = DR.Run.banner(), t = p.t - t0;
          out.push({ t, rise: b.rise, bottom: b.bottom, dark: !document.getElementById('run-fade').hidden, gap: b.z - p.runnerZ });
          if (f(t, b)) break;
          DR.Run.step(0.02);
        }
        return out;
      }, [until, t0]);
      trace.push(...await stepRec('return b.rise >= 0.45;'));
      const mid = trace[trace.length - 1];
      assert.ok(mid.rise < 0.8, tag + ' mid-rise caught: ' + mid.rise);
      await page.screenshot({ path: shotPath(`finish-banner-rise-${tag}`) });
      trace.push(...await stepRec('return t >= 0.8;'));
      // 다 선 뒤: 화면 안, HUD·패널과 안 겹침, 러너 앞
      const rest = await page.evaluate(() => {
        const b = DR.Run.banner(), st = document.getElementById('run-stage').getBoundingClientRect();
        const box = (sel) => { const el = document.querySelector(sel); if (!el || el.hidden || !el.offsetParent) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; };
        const s = b.screen;
        return { b, s: s && { left: s.left + st.left, right: s.right + st.left, top: s.top + st.top, bottom: s.bottom + st.top, inFront: s.inFront }, hud: box('#hud'), need: box('#run-need'), vw: innerWidth, vh: innerHeight };
      });
      const s = rest.s;
      assert.equal(rest.b.rise, 1, tag + ' at rest');
      // 지나온 게이트는 흐려져 사라졌다(4레인 세로 화면에서 카메라가 게이트 현수막 속에 들어가 표지판을 덮던 것)
      assert.equal(await page.evaluate(() => DR.Run.peek().gate), false, tag + ' gate faded out');
      assert.ok(s && s.inFront, tag + ' in front of the camera');
      assert.ok(s.left >= 0 && s.right <= rest.vw && s.top >= 0 && s.bottom <= rest.vh, tag + ' inside the viewport ' + JSON.stringify(s));
      assert.ok(s.right - s.left >= vp.width * 0.25, tag + ' big enough: ' + Math.round(s.right - s.left) + 'px wide');
      assert.ok(s.bottom - s.top >= 70, tag + ' tall enough: ' + Math.round(s.bottom - s.top) + 'px');
      assert.ok(rest.hud, 'hud still on before the fade');
      assert.ok(!overlaps(s, rest.hud), tag + ' clear of the HUD ' + JSON.stringify([s, rest.hud]));
      if (rest.need) assert.ok(!overlaps(s, rest.need), tag + ' clear of the need panel');
      await page.screenshot({ path: shotPath(`finish-banner-rest-${tag}`) });
      // 어두워질 때까지
      trace.push(...await stepRec('return document.getElementById("run-fade").hidden === false;'));
      const rises = trace.map((x) => x.rise);
      const peak = Math.max(...rises), peakAt = rises.indexOf(peak);
      for (let i = 1; i <= peakAt; i++) assert.ok(rises[i] >= rises[i - 1], tag + ' rises up to the peak');
      for (let i = peakAt + 1; i < rises.length; i++) assert.ok(rises[i] <= rises[i - 1] + 1e-9 && rises[i] >= 1, tag + ' settles back to 1');
      assert.ok(peak > 1.03 && peak < 1.15, tag + ' small bounce ' + peak);
      assert.ok(trace.every((x) => x.bottom < 0), tag + ' posts never lift off the road');
      const settle = trace.find((x) => x.rise === 1 && trace.indexOf(x) > peakAt).t, dark = trace.find((x) => x.dark).t;
      assert.ok(dark - settle >= 0.6, tag + ` at rest ${(dark - settle).toFixed(2)}s before the screen darkens`);
      const last = trace[trace.length - 1];
      assert.ok(last.gap > 4 && last.gap < 8, tag + ' runner stops about bannerAhead m short of the sign: ' + last.gap.toFixed(2) + ' (at crossing ' + aheadAtStart.toFixed(1) + ')');
      // 끝: 1280 = Space 건너뛰기, 390 = 그대로 끝까지 → 어느 쪽이든 표지판 메시·재질·텍스처가 dispose
      await page.evaluate(() => DR.Run.setPaused(false));
      if (vp.width > 500) await page.keyboard.press('Space');
      await page.waitForFunction(() => DR.App.screen !== 'run' && DR.Run.banner() === null, null, { timeout: 8000 });
      assert.deepEqual(await page.evaluate(() => window.__bannerDisposed), { geometry: 1, material: 1, texture: 1 }, tag + ' disposed');
      // B) 다시 달리기(같은 코스): 표지판은 1개, 숨김 → 끝맺음에서만 · 세 번 되풀이해도 그대로
      if (id === 'm1') {
        for (let n = 0; n < 3; n++) {
          const again = await page.evaluate(() => {
            const m = DR.App.mission(), c = DR.App.course;
            DR.Run.start(document.getElementById('run-stage'), { mission: m, course: c, bag: [], bagMax: m.bag, onEnd() {} });
            DR.Run.setPaused(true);
            const first = DR.Run.banner();
            const mesh = DR.Run.debugBanner(), d = { g: 0, m: 0, t: 0 };
            mesh.geometry.addEventListener('dispose', () => d.g++); mesh.material.addEventListener('dispose', () => d.m++); mesh.material.map.addEventListener('dispose', () => d.t++);
            DR.Run.debugSetHp(99);
            for (let i = 0; i < 20000 && !DR.Run.peek().finishing; i++) DR.Run.step(0.05);
            for (let i = 0; i < 10; i++) DR.Run.step(0.02);
            const during = DR.Run.banner();
            DR.Run.stop();
            return { first, during, d, after: DR.Run.banner() };
          });
          assert.deepEqual([again.first.count, again.first.visible, again.first.shown], [1, false, false], 'rerun ' + n + ': hidden, single');
          assert.deepEqual([again.during.count, again.during.shown], [1, true], 'rerun ' + n + ': shows on arrive');
          assert.deepEqual(again.d, { g: 1, m: 1, t: 1 }, 'rerun ' + n + ': disposed on stop');
          assert.equal(again.after, null);
        }
      }
      assert.deepEqual(errors, []);
      console.log('ok', tag, 'peak', peak.toFixed(3), 'rest', Math.round(s.right - s.left) + '×' + Math.round(s.bottom - s.top) + 'px @', Math.round(s.left) + ',' + Math.round(s.top), 'hold', (dark - settle).toFixed(2) + 's');
    } finally { await browser.close(); }
  }
}

// C) HP 0: 표지판 없음(예전 그대로 "연결 끊김")
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=flood' });
  try {
    await toRun(page);
    await page.evaluate(() => DR.Run.debugSetHp(1));
    const fire = await page.evaluate(() => DR.App.course.items.find((i) => i.kind === 'fire'));
    await stepUntil(page, `return p.runnerZ > ${fire.z} - 10;`);
    await page.evaluate((lane) => {
      for (let n = 0; n < 3 && DR.Run.peek().lane !== lane; n++) { const c = DR.Run.peek().lane < lane ? 'ArrowRight' : 'ArrowLeft'; window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c })); }
    }, fire.lane);
    await stepUntil(page, 'return !!p.finishing;');
    assert.equal(await page.evaluate(() => DR.Run.peek().finishing), 'knockout');
    const seen = await page.evaluate(() => { let any = false; for (let i = 0; i < 80 && DR.Run.peek().running; i++) { const b = DR.Run.banner(); if (b.visible || b.shown) any = true; DR.Run.step(0.02); } return any; });
    assert.equal(seen, false, 'no banner on knockout');    await page.evaluate(() => DR.Run.setPaused(false));
    await page.locator('#screen-knockout').waitFor({ state: 'visible', timeout: 10000 });
    assert.deepEqual(errors, []);
    console.log('ok knockout: no banner');
  } finally { await browser.close(); }
}

// D) 움직임 줄이기: 처음부터 제자리, 솟기·튕김 없음, 0.3초 페이드 그대로(글자 없음)
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toRun(page);
    await stepUntil(page, 'return !!p.finishing;');
    const r = await page.evaluate(() => {
      const out = [], gates = [];
      let n = 0;
      for (; n < 60 && DR.Run.peek().running; n++) { const b = DR.Run.banner(); out.push({ rise: b.rise, bottom: b.bottom, visible: b.visible, screen: b.screen }); gates.push(DR.Run.peek().gate); DR.Run.step(0.02); }
      return { out, gates, n, text: document.getElementById('run-fade').innerText };
    });
    assert.ok(r.out.every((x) => x.visible && x.rise === 1), 'in place from the first frame');
    assert.ok(r.gates.slice(1).every((g) => g === false), 'gate gone at once (no fade animation)');
    assert.ok(r.out.every((x) => Math.abs(x.bottom - r.out[0].bottom) < 1e-9), 'never moves');
    const s = r.out[0].screen;
    assert.ok(s && s.inFront && s.left >= 0 && s.right <= 1280 && s.top >= 0 && s.bottom <= 800, 'in view ' + JSON.stringify(s));
    assert.ok(r.n >= 14 && r.n <= 17, 'still about 0.3s: ' + r.n);
    assert.equal(r.text, '');
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 5000 });
    assert.deepEqual(errors, []);
    console.log('ok reduced motion: banner in place, steps', r.n);
  } finally { await browser.close(); }
}
console.log('PASS finish-banner');
