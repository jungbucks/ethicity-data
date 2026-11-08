// 도시 복구 화면(js/ui-city.js) 그림 연결 + "이어지는" 연출(피드백 2026-11-08 feedback2.txt)
//   1단계: 8:3 그림(좁은 화면 4:3 + 새 구역 쪽 object-position, 두 장 같게), 그림 없으면 점 5칸 + 문구
//   2단계: 케이블 빛 → 새 구역 아래→위 열림 → 반짝 → 문구 → [계속](0.8초 뒤). Space·Enter·클릭 = 건너뛰기(계속은 안 눌림),
//          to = 5는 케이블 전체·도시 전체 반짝, 움직임 줄이기 = 바로 끝 상태. done()은 [계속]에서 한 번만.
// 단계는 .city-page[data-phase] = wait → line → reveal → flash → text → ready (그림 없음·건너뛰기·움직임 줄이기 = 바로 ready)
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const CASES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 5]];
const LINE = '분리배출 분류 AI가 다시 이어졌다';

async function boot(page) { await page.waitForFunction(() => window.DR && DR.UI && DR.UI.city && DR.CityLook && DR.App && DR.App.screen === 'title'); }
// 화면을 연다(콘솔 확인 방법과 같은 호출) — 단계 바뀜을 시각과 함께 기록
async function open(page, from, to) {
  await page.evaluate(({ from, to, line }) => {
    window.__done = 0; window.__ph = []; window.__t0 = performance.now();
    if (window.__phObs) window.__phObs.disconnect();
    DR.UI.city({ from, to, line }, () => { window.__done++; });
    const pg = document.querySelector('#screen-city .city-page');
    const rec = () => { const p = pg.dataset.phase; if (!window.__ph.length || window.__ph[window.__ph.length - 1].p !== p) window.__ph.push({ p, t: performance.now() - window.__t0 }); };
    rec();
    window.__phObs = new MutationObserver(rec); window.__phObs.observe(pg, { attributes: true, attributeFilter: ['data-phase'] });
  }, { from, to, line: LINE });
}
const phase = (page) => page.evaluate(() => document.querySelector('#screen-city .city-page').dataset.phase);
const phases = (page) => page.evaluate(() => window.__ph);
const done = (page) => page.evaluate(() => window.__done);
const waitPhase = (page, p, timeout = 4000) => page.waitForFunction((p) => document.querySelector('#screen-city .city-page').dataset.phase === p, p, { timeout });
const btnShown = (page) => page.locator('#btn-city-next').isVisible();
const lineOpacity = (page) => page.evaluate(() => +getComputedStyle(document.getElementById('city-line')).opacity);

async function geometry(page) {
  return page.evaluate(() => {
    const art = document.getElementById('city-art'), r = art.getBoundingClientRect();
    const b = document.querySelector('#city-art .city-before'), a = document.querySelector('#city-art .city-after');
    const cs = (e) => getComputedStyle(e);
    const cab = document.querySelector('#city-art .city-cable'), cr = cab.getBoundingClientRect(), cc = cs(cab);
    return {
      w: r.width, h: r.height, left: r.left, right: r.right, vw: innerWidth,
      fitB: cs(b).objectFit, fitA: cs(a).objectFit, posB: cs(b).objectPosition, posA: cs(a).objectPosition,
      clip: cs(a).clipPath, filterA: cs(a).filter, filterArt: cs(art).filter,
      cable: { l: cr.left - r.left, w: cr.width, top: cr.top - r.top, h: cr.height, bg: cc.backgroundColor, shadow: cc.boxShadow, opacity: +cc.opacity },
      dotsBig: !!document.querySelector('#screen-city .city-dots-big') && getComputedStyle(document.querySelector('#screen-city .city-dots-big')).display !== 'none'
    };
  });
}
// computed clip-path "inset(t r b l)" — 같은 값은 줄여 쓴다(inset(100% 40% 0%) = 왼쪽도 40%)
function inset(v) {
  const m = /^inset\(([^)]*)\)$/.exec(v); if (!m) return null;
  const n = m[1].trim().split(/\s+/).map(parseFloat), [t, r = t, b = t, l = r] = n;
  return { top: t, right: r, bottom: b, left: l };
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  const narrow = viewport.width <= 640;
  const { browser, page, errors } = await openGame({ viewport });
  try {
    await boot(page);
    const cableY = await page.evaluate(() => DR.config.city.cableY);
    const T = await page.evaluate(() => DR.config.city);

    // ── A. 단계 순서·시간·자리(from/to 여러 경우)
    for (const [from, to] of CASES) {
      await open(page, from, to);
      assert.equal(await page.locator('#screen-city').isVisible(), true);
      assert.equal(await btnShown(page), false, `${from}→${to}: no [계속] while the sequence runs`);
      await waitPhase(page, 'line');
      assert.equal(await lineOpacity(page) < 0.05, true, 'text waits');
      const L = await page.evaluate(({ from, to, narrow }) => DR.CityLook.layout(from, to, narrow), { from, to, narrow });
      // 그림 틀: 넓은 화면 8:3·56rem 이하·양옆 안 잘림 / 좁은 화면 4:3 + 새 구역 쪽, 두 장 같은 자리
      let g = await geometry(page);
      assert.ok(g.left >= -0.5 && g.right <= g.vw + 0.5, `art inside the viewport (${g.left}..${g.right})`);
      near(g.w / g.h, narrow ? 4 / 3 : 8 / 3, 0.02, 'art aspect');
      if (!narrow) assert.ok(g.w <= 56 * 16 + 0.5, 'max 56rem');
      assert.equal(g.fitB, 'cover'); assert.equal(g.fitA, 'cover');
      assert.equal(g.posB, g.posA, 'before/after object-position identical');
      if (narrow) assert.match(g.posA, new RegExp('^' + Math.round(L.pos * 1000) / 10 + '% '), 'object-position x toward the new zone');
      assert.equal(g.dotsBig, false, 'big dots hidden while the art shows');
      // 케이블 빛: 88~94% 높이의 시안 선, 3~4px, 글로우, from 끝에서 시작
      near(g.cable.top + g.cable.h / 2, cableY * g.h, 1.5, 'cable height');
      assert.ok(g.cable.h >= 3 && g.cable.h <= 4, 'cable 3~4px');
      assert.equal(g.cable.bg, 'rgb(127, 249, 255)');
      assert.ok(g.cable.shadow && g.cable.shadow !== 'none', 'glow');
      near(g.cable.l, L.cableFrom * g.w, 1.5, 'cable start');
      await waitPhase(page, 'reveal');
      g = await geometry(page);
      near(g.cable.l + g.cable.w, L.cableTo * g.w, 1.5, `${from}→${to}: cable end`);
      // 새 구역만 열린다(아래→위): clip-path inset(top right bottom left)
      const m = inset(g.clip);
      assert.ok(m, 'clip-path inset during reveal: ' + g.clip);
      near(m.left, L.revealFrom * 100, 0.2, 'reveal left'); near(m.right, 100 - L.revealTo * 100, 0.2, 'reveal right');
      assert.equal(m.bottom, 0, 'opens from the bottom');
      await waitPhase(page, 'flash');
      g = await geometry(page);
      if (L.final) assert.match(g.filterArt, /brightness/, 'the whole city flashes on the last cell');
      else assert.match(g.filterA, /brightness/, 'the new zone flashes');
      await waitPhase(page, 'ready');
      assert.equal(await btnShown(page), true);
      near(await lineOpacity(page), 1, 0.01, 'text shown');
      assert.match(await page.locator('#city-line').innerText(), new RegExp(`^도시 ${to}/5 — ${LINE}$`));
      const ph = await phases(page);
      assert.deepEqual(ph.map((x) => x.p), ['wait', 'line', 'reveal', 'flash', 'text', 'ready'], 'phase order');
      const at = Object.fromEntries(ph.map((x) => [x.p, x.t]));
      near(at.reveal - at.line, T.line * 1000, 150, 'line time');
      near(at.flash - at.reveal, T.reveal * 1000, 150, 'reveal time');
      near(at.text - at.flash, T.flash * 1000, 150, 'flash time');
      near(at.ready - at.text, T.button * 1000, 150, 'button after the text');
      assert.ok(at.text - at.line <= 2000, 'the joining sequence stays under 2 s');
      g = await geometry(page);
      assert.equal(g.clip, 'none', 'final: whole city-to');
      if (L.final) { near(g.cable.l, 0, 1, 'whole cable lit'); near(g.cable.w, g.w, 1.5, 'whole cable lit'); }
      if (from === 2 && to === 3) await page.screenshot({ path: shotPath(`city-art-2to3-${viewport.width}`) });
      if (from === 4 && to === 5) await page.screenshot({ path: shotPath(`city-art-4to5-${viewport.width}`) });
      assert.equal(await done(page), 0, 'done waits for [계속]');
      await page.locator('#btn-city-next').click();
      await page.locator('#btn-city-next').click({ force: true }).catch(() => {});
      assert.equal(await done(page), 1, 'done exactly once');
    }
    console.log('ok sequence', viewport.width);

    // 연출 도중 화면 하나(새 구역 반쯤 열림)
    await open(page, 2, 3); await waitPhase(page, 'reveal'); await page.waitForTimeout(T.reveal * 500);
    await page.screenshot({ path: shotPath(`city-art-reveal-${viewport.width}`) });

    // ── B. 건너뛰기: Space · Enter · 클릭 → 바로 끝 상태, [계속]은 안 눌린다
    // 앞 대화를 Space로 넘기다 누른 채인 키(되풀이)는 건너뛰기가 아니다
    await open(page, 1, 2); await waitPhase(page, 'line');
    await page.evaluate(() => { for (const key of [' ', 'Enter']) window.dispatchEvent(new KeyboardEvent('keydown', { key, code: key === ' ' ? 'Space' : 'Enter', repeat: true, bubbles: true })); });
    assert.notEqual(await phase(page), 'ready', 'held-key repeat does not skip');
    await waitPhase(page, 'ready'); await page.locator('#btn-city-next').click();
    for (const how of ['Space', 'Enter', 'click']) {
      await open(page, 1, 2);
      await waitPhase(page, 'line');
      if (how === 'click') await page.mouse.click(viewport.width / 2, (await page.locator('#city-art').boundingBox()).y + 20);
      else await page.keyboard.press(how);
      await waitPhase(page, 'ready', 300);
      assert.equal(await btnShown(page), true, how + ': [계속] shown');
      near(await lineOpacity(page), 1, 0.01, how + ': text shown at once');
      const g = await geometry(page);
      assert.equal(g.clip, 'none', how + ': city-to whole');
      assert.equal(await done(page), 0, how + ': skipping does not press [계속]');
      assert.notEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'btn-city-next', 'button not focused by the skip');
      // 같은 키를 또 눌러도(끝난 뒤) 계속으로 넘어가지 않는다 — 버튼을 직접 눌러야
      await page.keyboard.press('Space'); await page.keyboard.press('Enter');
      assert.equal(await done(page), 0, how + ': keys after the end do not press [계속]');
      const ph = (await phases(page)).map((x) => x.p);
      assert.ok(!ph.includes('flash'), how + ': jumped straight to the end: ' + ph);
      await page.locator('#btn-city-next').click();
      assert.equal(await done(page), 1, how + ': done once');
    }
    console.log('ok skip', viewport.width);

    // ── C. 움직임 줄이기: 애니메이션 없이 city-to·문구·버튼 바로
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 3, 4);
    assert.equal(await phase(page), 'ready', 'reduced motion: final state right away');
    assert.equal(await btnShown(page), true);
    near(await lineOpacity(page), 1, 0.01, 'reduced: text');
    await page.waitForFunction(() => !document.getElementById('city-art').hidden);
    const gr = await geometry(page);
    assert.equal(gr.clip, 'none'); assert.equal(gr.filterA, 'none'); assert.equal(gr.filterArt, 'none');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#city-art .city-cable')).transitionDuration), '0s');
    await page.locator('#btn-city-next').click();
    assert.equal(await done(page), 1);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    console.log('ok reduced', viewport.width);

    // ── D. 그림이 없으면(파일 이름이 틀리면) 대체 화면: 점 5칸 + 문구 + [계속], 흐름은 막지 않음
    await page.evaluate(() => { window.__cityPath = DR.UI.city.path; DR.UI.city.path = 'assets/city/__missing__-'; });
    await open(page, 2, 3);
    await page.waitForFunction(() => document.getElementById('screen-city').classList.contains('city-no-art'));
    await waitPhase(page, 'ready', 1000);
    assert.equal(await page.locator('#city-art').isHidden(), true, 'art hidden');
    assert.equal(await page.locator('#screen-city .city-dots-big').isVisible(), true, 'five dots shown');
    await page.waitForFunction(() => document.querySelectorAll('#screen-city .city-dots-big i.on').length === 3);
    assert.equal(await btnShown(page), true);
    near(await lineOpacity(page), 1, 0.01, 'fallback text');
    if (narrow) await page.screenshot({ path: shotPath('city-art-missing-' + viewport.width) });
    await page.locator('#btn-city-next').click();
    assert.equal(await done(page), 1);
    await page.evaluate(() => { DR.UI.city.path = window.__cityPath; });
    console.log('ok missing art', viewport.width);

    // ── E. 게임 흐름 그대로: 타이틀 배지(cityDots)와 함수 모양
    assert.equal(await page.evaluate(() => typeof DR.UI.cityDots === 'function' && DR.UI.city.length === 2), true);
    assert.deepEqual(errors.filter((e) => !/__missing__/.test(e)), []);
  } finally { await browser.close(); }
}
console.log('PASS city');
