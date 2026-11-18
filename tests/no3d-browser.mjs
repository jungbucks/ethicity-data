// WebGL이 꺼진 컴퓨터(리뷰 2026-11-18 #6) — 헤드리스 Edge --disable-webgl.
//   A ?run=tutorial → 달리기 화면에서 멈추지 않고 안내(#screen-no3d), 캔버스 없음, [처음 화면으로]
//   B 저장된 1 임무 브리핑 → 이어하기 → [달리기 시작] → 안내 → [브리핑으로 돌아가기] = 1 임무 브리핑, 저장 그대로 (1280·390 스크린샷)
//   C 정상 환경(WebGL 있음)에선 그대로 달리기 시작
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openGame, shotPath, DATA_DIR } from './browser.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const URL0 = pathToFileURL(path.join(DATA_DIR, 'index.html')).href;
// 3D를 못 만들 때 three.js·게임이 콘솔에 남기는 줄(예상한 것) — 그 밖의 오류는 실패
const EXPECTED = /WebGL|webgl|3D 렌더러/;

async function noGLPage(browser, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text()) && !EXPECTED.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => { window.__DR_NO_AUTOPAUSE = true; window.__DR_FAST_TITLE = true; });
  return { page, errors };
}

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-webgl', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
try {
  /* A */
  {
    const { page, errors } = await noGLPage(browser, { width: 1280, height: 800 });
    await page.goto(URL0 + '?run=tutorial');
    assert.equal(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl')), false, 'WebGL이 정말 꺼져 있다');
    await page.locator('#screen-no3d').waitFor({ state: 'visible', timeout: 8000 });
    assert.match(await page.locator('#screen-no3d h2').innerText(), /달리기 화면을 열 수 없어요/);
    assert.match(await page.locator('#screen-no3d').innerText(), /선생님께 알려/);
    assert.equal(await page.locator('#run-stage canvas').count(), 0);
    assert.equal(await page.locator('#screen-run').isHidden(), true, '달리기 화면(0/0·조작 아이콘)은 숨김');
    assert.equal(await page.evaluate(() => DR.Run.peek().running), false);
    await page.locator('#btn-no3d-back').click();
    await page.locator('#screen-title').waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    await page.close();
    console.log('ok A ?run=tutorial → 안내 → 처음 화면');
  }
  /* B */
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const { page, errors } = await noGLPage(browser, vp);
    await page.goto(URL0);
    await page.evaluate(() => {
      localStorage.clear();
      DR.Save.passTutorial();
      DR.Save.setRecord('m1', { cleared: false });
      DR.Save.checkpoint('briefing', { mission: 'm1', bag: [], supplements: 0, firstTry: null, seed: 1101 }, {});
    });
    await page.reload();
    const saved = await page.evaluate(() => localStorage.getItem('ethicity.data.save'));
    await page.locator('#btn-continue').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    await page.locator('#btn-run').click();
    await page.locator('#screen-no3d').waitFor({ state: 'visible', timeout: 8000 });
    assert.equal(await page.locator('#btn-no3d-back').innerText(), '브리핑으로 돌아가기');
    assert.equal(await page.locator('#run-stage canvas').count(), 0);
    const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(noScroll, '가로 넘침 없음');
    await page.screenshot({ path: shotPath('no3d-m1-' + vp.width) });
    const raw = (s) => s.replace(/"savedAt":\d+/, '');
    assert.equal(raw(await page.evaluate(() => localStorage.getItem('ethicity.data.save'))), raw(saved), '저장 그대로');
    await page.locator('#btn-no3d-back').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    const s = await page.evaluate(() => DR.Save.load());
    assert.equal(s.mission, 'm1'); assert.equal(s.screen, 'briefing'); assert.equal(s.tutorialDone, true);
    assert.equal(raw(await page.evaluate(() => localStorage.getItem('ethicity.data.save'))), raw(saved), '돌아온 브리핑도 같은 체크포인트');
    // 새로고침해도 1 임무 브리핑부터
    await page.reload();
    assert.match(await page.locator('#title-progress').innerText(), /첫 번째 임무 · 브리핑부터/);
    assert.deepEqual(errors, []);
    await page.close();
    console.log('ok B ' + vp.width + ' 이어하기 → 달리기 시작 → 안내 → 브리핑, 저장 그대로');
  }
} finally { await browser.close(); }

/* C */
{
  const { browser: b, page, errors } = await openGame({ query: '?run=tutorial' });
  try {
    await page.waitForFunction(() => window.DR && DR.Run && DR.Run.peek().running, null, { timeout: 8000 });
    assert.equal(await page.locator('#run-stage canvas').count(), 1);
    assert.equal(await page.locator('#screen-no3d').isHidden(), true);
    assert.deepEqual(errors, []);
  } finally { await b.close(); }
  console.log('ok C 정상 환경 → 달리기 시작');
}
