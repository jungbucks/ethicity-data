// 달리기 무대 1차 = 빛의 다리(설계 docs/specs/2026-11-07-run-bridge-world-design.md, 계획 Task 2~4)
// 하늘·지평선 도시 = 캔버스 뒤 CSS 층(.rw-*), 다리·불빛 = 3D. peek().world로 상태를 본다.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { openGame, shotPath } from './browser.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const world = (page) => page.evaluate(() => DR.Run.peek().world);
const layers = (page) => page.evaluate(() => document.querySelectorAll('#run-stage .rw-layer').length);
async function ready(page) {
  await page.waitForFunction(() => DR.Run.peek().running);
  await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); DR.Run.step(0.05); });
}
// 같은 페이지에서 다른(또는 같은) 임무 달리기를 새로 시작 — 다시 달리기·보충·임무 바꾸기와 같은 경로(start가 앞 달리기를 stop)
async function restart(page, id) {
  await page.evaluate((id) => {
    const m = DR.Missions[id], course = DR.Stream.build(m, DR.config, { seed: m.seed });
    DR.Run.start(document.getElementById('run-stage'), { mission: m, course: course, bag: [], bagMax: m.bag, onEnd() {} });
  }, id);
  await ready(page);
}

// A. 연습 달리기 = 밤 다리, 1366·375
for (const viewport of [{ width: 1366, height: 900 }, { width: 375, height: 812 }]) {
  const { browser, page, errors } = await openGame({ query: '?run=tutorial', viewport });
  try {
    await ready(page);
    const w = await world(page);
    assert.ok(w, 'tutorial run has a bridge world');
    assert.deepEqual([w.time, w.look, w.layers], ['night', 'tutorial', 5]);
    assert.equal(w.wallOpacity, 0.72, 'night walls keep their look');
    assert.equal(await layers(page), 5);
    assert.ok(await page.evaluate(() => getComputedStyle(document.querySelector('#run-stage .rw-sky')).backgroundImage.includes('bg-sky.webp')));
    const hz = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('run-stage')).getPropertyValue('--rw-horizon')) / innerHeight);
    assert.ok(hz > 0.15 && hz < 0.6, 'horizon on screen: ' + hz);
    await page.waitForFunction(() => [...document.querySelectorAll('#run-stage .rw-layer')].every((e) => !e.hidden));
    await page.evaluate(() => { for (let i = 0; i < 40; i++) DR.Run.step(0.05); });
    await page.screenshot({ path: shotPath('bridge-tutorial-' + viewport.width) });
    if (viewport.width === 1366) {
      // 두 번 달려도 층이 겹쳐 쌓이지 않고, 2 임무로 가면 다리가 아니라 실내 무대(2차, 2026-11-09 — indoor-browser가 자세히 봄)
      await restart(page, 'tutorial');
      assert.equal(await layers(page), 5, 'no stacked layers after a rerun');
      assert.equal((await world(page)).indoor, false);
      await restart(page, 'm2');
      assert.equal(await layers(page), 6, 'm2 = indoor stage layers (with the wall art), not stacked on the bridge');
      assert.equal((await world(page)).room, 'sorting');
      assert.equal(await page.evaluate(() => DR.Run.peek().scenery.theme), 'sorting');
      await restart(page, 'tutorial');
      assert.equal(await layers(page), 5, 'back to the bridge');
      assert.equal(await page.evaluate(() => document.getElementById('run-stage').className.includes('rw-indoor')), false);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('ok tutorial night bridge');

// B. 저사양(?low=1)·움직임 줄이기 → 비·흐르는 배경 멈춤(정적인 하늘·다리는 보임)
{
  const { browser, page, errors } = await openGame({ query: '?run=tutorial&low=1' });
  try {
    await ready(page);
    const w = await world(page);
    assert.equal(w.moving, false); assert.equal(w.rain, false); assert.equal(w.layers, 5);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
{
  const { browser, page, errors } = await openGame({ query: '?run=tutorial' });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await restart(page, 'tutorial');
    const w = await world(page);
    assert.equal(w.moving, false); assert.equal(w.rain, false);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
{
  const { browser, page } = await openGame({ query: '?run=tutorial' });
  try {
    await ready(page);
    const w = await world(page);
    assert.equal(w.moving, true); assert.equal(w.rain, true, 'night tutorial: rain on by default');
  } finally { await browser.close(); }
}
console.log('ok low / reduced motion');

// C. 플래그 없이 더블클릭과 같은 조건(--allow-file-access-from-files 없음)에서도 하늘 그림이 뜬다
{
  const bare = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const { browser, page, errors } = await openGame({ browser: bare, query: '?run=tutorial' });
  try {
    await ready(page);
    const ok = await page.evaluate(() => new Promise((res) => {
      const url = getComputedStyle(document.querySelector('#run-stage .rw-sky')).backgroundImage.slice(5, -2);
      const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = url;
    }));
    assert.ok(ok, 'sky image loads from file:// without the flag');
    assert.equal((await world(page)).layers, 5);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('ok file:// without flag');

// D. 1 임무 = 밤 다리, 구역(우산·지갑·스마트폰)마다 하늘 색조·불빛 비율이 다르다
{
  const { browser, page, errors } = await openGame({ query: '?run=m1' });
  try {
    await ready(page);
    const zones = await page.evaluate(() => DR.Run.course().zones.map((z) => z.id));
    assert.equal(zones.length, 3);
    const seen = [];
    for (const id of zones) {
      await page.evaluate((id) => {
        const zone = DR.Run.course().zones.find((z) => z.id === id);
        while (DR.Run.peek().runnerZ < zone.start + 1) DR.Run.step(0.05);
      }, id);
      const sc = await page.evaluate(() => DR.Run.peek().scenery);
      assert.equal(sc.theme, 'bridge'); assert.equal(sc.zone, id);
      const w = await world(page);
      assert.equal(w.time, 'night'); assert.equal(w.look, 'm1-' + id);
      seen.push(await page.evaluate(() => getComputedStyle(document.querySelector('#run-stage .rw-tint')).backgroundColor));
      if (id === zones[0]) await page.screenshot({ path: shotPath('bridge-m1-1366') });
    }
    assert.equal(new Set(seen).size, 3, 'each zone tints the sky differently');
    assert.equal(await page.evaluate(() => DR.Run.peek().scenery && document.getElementById('run-stage').classList.contains('rw-night')), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('ok m1 night bridge zones');

// E. 그림을 못 읽으면(낮 하늘 파일이 없는 경우) 오류 없이 그 층만 숨김 → #run-stage 바탕이 단색 하늘
{
  const { browser, page, errors } = await openGame({ query: '?run=m3' });
  await page.addInitScript(() => {
    const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { d.set.call(this, String(v).includes('bg-sky-day') ? 'assets/title/__missing-sky.webp' : v); }, get() { return d.get.call(this); } });
  });
  try {
    await page.reload();
    await ready(page);
    await page.waitForFunction(() => document.querySelector('#run-stage .rw-sky').hidden);
    assert.equal((await world(page)).time, 'day');
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('run-stage')).backgroundImage.includes('gradient')), true, 'plain sky behind');
    // 리뷰 I1: 낮 다리의 노이즈 벽은 덜 투명하게(그려진 벽 재질에 실제로 들어감)
    assert.equal((await world(page)).wallOpacity, 0.9);
    const wallOp = await page.evaluate(() => { while (!DR.Run.course().items.some((i) => i.kind === 'wall' && i.z - DR.Run.peek().runnerZ < 140 && i.z > DR.Run.peek().runnerZ)) DR.Run.step(0.05); return DR.Run.peek().wallOpacities; });
    assert.ok(wallOp && wallOp.length && wallOp.every((o) => o === 0.9), 'wall meshes use 0.9: ' + JSON.stringify(wallOp));
    assert.deepEqual(errors.filter((e) => !e.includes('__missing-sky')), []);
  } finally { await browser.close(); }
}
console.log('ok missing art falls back');
console.log('PASS bridge');
