// 기본 실행 조건 = index.html 더블클릭(file://, --allow-file-access-from-files 없음) — 리뷰 2026-11-10 ①
//   파일에서 읽은 사진은 캔버스를 오염시켜 그림을 내보낼 수도(toDataURL·getImageData) 3D 텍스처로 올릴 수도 없다.
//   → 사진이 캔버스를 오염시키면 같은 사진을 담은 assets/cards/photos-embedded.js로 바꿔 읽는다(DR.CardArt.photoMode() 'embedded').
//   A) 1~3 임무: 브리핑 → 달리기(화면 카드·3D 카드) → 검수 썸네일 → 크게 보기 → 가리기(가린 그림) → (1 임무) 보충 준비까지 사진이 보이고 오류 없음
//   B) 연습(튜토리얼): 실기 미션 안내의 개·고양이 사진
//   C) 담은 파일을 못 읽으면: 사진 대신 Canvas 그림(빈 그림·멈춤 없음)
// 실행: node tests/bare-browser.mjs [A|B|C]
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const part = process.argv[2] || 'all';
const FILL = {
  m1: { umbrella_open: 3, wallet_closed: 3, wallet_open: 3, phone_front: 3, phone_back: 3 }, // 접힌 우산 0장 → 보충 준비까지 간다
  m2: { can_drink: 2, pet_clear: 2 },
  m3: { station_now: 2, river_now: 2 }
};
const ready = (page) => page.waitForFunction(() => DR.CardArt.photosReady && DR.CardArt.photosReady(), null, { timeout: 20000 });
// 화면에 붙은 그림이 정말 그려졌나: 다 읽혔고(naturalWidth) 한 가지 색이 아님(밝기 표준편차). rc = 그림 안 비율 칸
const pic = (page, sel, rc) => page.evaluate(([sel, rc]) => {
  const im = document.querySelector(sel);
  if (!im) return null;
  if (!(im.complete && im.naturalWidth > 0)) return { loaded: false };
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const r = rc || { x: 0, y: 0, w: 1, h: 1 };
  const d = g.getImageData(Math.round(r.x * c.width), Math.round(r.y * c.height), Math.max(1, Math.round(r.w * c.width)), Math.max(1, Math.round(r.h * c.height))).data;
  let s = 0, s2 = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; }
  return { loaded: true, w: im.naturalWidth, mean: s / n, std: Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) };
}, [sel, rc || null]);
const allLoaded = (page, sel) => page.evaluate((sel) => { const list = [...document.querySelectorAll(sel)]; return { n: list.length, ok: list.filter((i) => i.complete && i.naturalWidth > 0).length }; }, sel);

async function toRun(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor({ state: 'visible', timeout: 60000 });
  const brief = await allLoaded(page, '#screen-briefing img');
  assert.ok(brief.n > 0 && brief.ok === brief.n, 'briefing pictures drawn ' + JSON.stringify(brief));
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 30000 });
}

async function missionPart(id) {
  const { browser, page, errors } = await openGame({ bare: true, viewport: { width: 1280, height: 800 }, query: '?start=' + id });
  try {
    await ready(page);
    const mode = await page.evaluate((id) => {
      const A = DR.CardArt, m = DR.Missions[id], d = m.privacy.cards[0];
      const c = A.card(m, d.id, 0, 192, 4);
      let exp = 'ok'; try { c.toDataURL(); } catch (e) { exp = e.name; }
      return { mode: A.photoMode(), photo: c.photo || '', exp, usable: Object.keys(A._photos).filter((k) => A._photos[k].complete && A._photos[k].naturalWidth > 0).length, all: Object.keys(A._photos).length };
    }, id);
    assert.equal(mode.mode, 'embedded', id + ' photos come from the embedded file under plain file://');
    assert.equal(mode.usable, mode.all, id + ' every photo read');
    assert.ok(mode.photo, id + ' private card uses its photo');
    assert.equal(mode.exp, 'ok', id + ' photo card canvas can be exported');

    await toRun(page);
    // 달리기: 화면 카드(34m 안 DOM)가 사진으로 뜨고, 3D 카드 텍스처·"지지직" 그림에서 오류가 없다
    //   (카드는 지나가면 숨으니, 사진 카드가 보이는 그 순간에 화소를 잰다)
    const run = await (await page.waitForFunction(() => {
      const im = [...document.querySelectorAll('.run-card:not([hidden]) img')].find((i) => i.complete && i.naturalWidth > 0 && i.dataset.photo);
      if (!im) return null;
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data;
      let s = 0, s2 = 0; const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; }
      return { photo: im.dataset.photo, std: Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) };
    }, null, { timeout: 30000 })).jsonValue();
    assert.ok(run.photo && run.std > 8, id + ' run card picture drawn ' + JSON.stringify(run));
    if (id === 'm1') await page.screenshot({ path: shotPath('bare-run-m1-1280') });
    await page.waitForTimeout(2500); // 3D 카드 텍스처·"지지직" 효과 그림이 만들어질 시간
    assert.deepEqual(errors, [], id + ' no errors while running');

    await page.evaluate(([id, c]) => {
      const fill = { ...c };
      DR.Missions[id].privacy.cards.forEach((d) => { fill[d.id] = 1; });
      DR.App.debugFill(fill); DR.Run.finishNow();
    }, [id, FILL[id]]);
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 60000 });
    assert.equal(await page.locator('#btn-submit').count(), 1, id + ' inspect rendered to the end');
    // 검수: 가방 썸네일·장면별 썸네일
    const thumbs = await allLoaded(page, '#inspect-grid .bag-open > img');
    assert.ok(thumbs.n >= 6 && thumbs.ok === thumbs.n, id + ' bag thumbnails ' + JSON.stringify(thumbs));
    const sceneThumbs = await allLoaded(page, '#inspect-scenes .scene-thumbs img');
    assert.ok(sceneThumbs.n > 0 && sceneThumbs.ok === sceneThumbs.n, id + ' scene thumbnails ' + JSON.stringify(sceneThumbs));
    const t0 = await pic(page, '#inspect-grid .bag-open > img');
    assert.ok(t0.std > 8, id + ' thumbnail is a picture ' + JSON.stringify(t0));

    // 크게 보기 → 가리기: 원본이 보이고, 가린 칸만 바뀐다(막대 = 어둡고 평평)
    const priv = await page.evaluate((id) => { const d = DR.Missions[id].privacy.cards[0], c = DR.App.state.bag.find((x) => x.privateId === d.id); return { card: c.id, rc: d.mask[0] }; }, id);
    const inset = { x: priv.rc.x + priv.rc.w * 0.15, y: priv.rc.y + priv.rc.h * 0.15, w: priv.rc.w * 0.7, h: priv.rc.h * 0.7 };
    await page.locator(`#inspect-grid .bag-card[data-id="${priv.card}"] .bag-open`).click();
    const plain = await pic(page, '#inspect-zoom .zoom-art', inset), whole = await pic(page, '#inspect-zoom .zoom-art');
    assert.ok(whole.loaded && whole.w === 320 && whole.std > 8, id + ' zoom shows the original ' + JSON.stringify(whole));
    await page.locator('#btn-mask').click();
    assert.equal(await page.locator('#btn-mask').innerText(), '가린 것 되돌리기');
    const masked = await pic(page, '#inspect-zoom .zoom-art', inset);
    assert.ok(masked.loaded, id + ' masked picture drawn');
    if (priv.rc.look === 'bar') assert.ok(masked.mean < 60 && masked.std < 20, id + ' mask bar covers it ' + JSON.stringify({ plain, masked }));
    else assert.ok(Math.abs(masked.std - plain.std) > 0.5 || Math.abs(masked.mean - plain.mean) > 0.5, id + ' mask changes the picture ' + JSON.stringify({ plain, masked }));
    if (id === 'm1') await page.screenshot({ path: shotPath('bare-zoom-masked-m1-1280') });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator(`#inspect-grid .bag-card[data-id="${priv.card}"] .bag-masked`).count(), 1);
    assert.deepEqual(errors, [], id + ' no errors in inspect');

    if (id === 'm1') {
      // 남은 개인정보 카드도 가리고 제출 → 결과 → 보충 준비(종류별 사진 고르기·카드 전체·크게 보기)
      const other = await page.evaluate(() => DR.App.state.bag.find((c) => c.privateId && !c.masked).id);
      await page.locator(`#inspect-grid .bag-card[data-id="${other}"] .bag-open`).click();
      await page.locator('#btn-mask').click();
      await page.keyboard.press('Escape');
      await page.screenshot({ path: shotPath('bare-inspect-m1-1280'), fullPage: true });
      await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
      await page.locator('#screen-conveyor').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('#btn-cv-skip').click();
      const cv = await allLoaded(page, '#screen-conveyor img');
      assert.ok(cv.n > 0 && cv.ok === cv.n, 'conveyor pictures ' + JSON.stringify(cv));
      await page.locator('#btn-cv-next').click();
      await page.locator('#screen-result .result-scene').waitFor({ timeout: 40000 });
      for (let n = 0; n < 6 && await page.locator('#screen-result').isVisible(); n++) {
        const rs = await allLoaded(page, '#screen-result img');
        assert.ok(rs.ok === rs.n, 'result pictures ' + JSON.stringify(rs));
        await page.locator('#btn-next').click();
      }
      for (let n = 0; n < 12 && await page.locator('#screen-story').isVisible(); n++) await page.locator('#screen-story .dialog').click();
      await page.locator('#screen-prep').waitFor({ state: 'visible', timeout: 30000 });
      await page.locator('#prep-summary .kind button').first().click();
      const picks = await allLoaded(page, '#prep-summary .kind-pick-card img');
      assert.ok(picks.n > 0 && picks.ok === picks.n, 'prep kind thumbnails ' + JSON.stringify(picks));
      await page.locator('#btn-prep-all').click();
      const grid = await allLoaded(page, '#prep-grid .bag-open > img');
      assert.ok(grid.n > 0 && grid.ok === grid.n, 'prep grid thumbnails ' + JSON.stringify(grid));
      await page.locator('#prep-grid .bag-open').first().click();
      const pz = await pic(page, '#prep-zoom .zoom-art');
      assert.ok(pz && pz.loaded && pz.std > 8, 'prep zoom picture ' + JSON.stringify(pz));
      await page.keyboard.press('Escape');
      assert.deepEqual(errors, [], 'no errors through result and prep');
    }
    console.log('bare OK', id);
  } catch (e) {
    // 어디서 멈췄는지(예외를 삼킨 화면은 pageerror만 남는다)
    console.log('bare FAIL', id, 'screen =', await page.evaluate(() => DR.App.screen).catch(() => '?'), 'errors =', errors.slice(0, 5),
      await page.evaluate(() => { const e = document.getElementById('screen-' + DR.App.screen), r = e.getBoundingClientRect(); return { hidden: e.hidden, w: r.width, h: r.height, html: e.innerHTML.length, vis: getComputedStyle(e).visibility, disp: getComputedStyle(e).display }; }).catch(() => '?'));
    throw e;
  } finally { await browser.close(); }
}

async function tutorialPart() {
  const { browser, page, errors } = await openGame({ bare: true, viewport: { width: 1280, height: 800 } });
  try {
    await ready(page);
    assert.equal(await page.evaluate(() => DR.CardArt.photoMode()), 'embedded');
    await page.evaluate(() => DR.App.practiceTutorial());
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    await page.locator('#btn-run').click();
    await page.locator('#btn-goal-start').waitFor({ state: 'visible', timeout: 5000 });
    const slots = await allLoaded(page, '.goal-slot img');
    assert.ok(slots.n === 10 && slots.ok === 10, 'goal slots show the photos ' + JSON.stringify(slots));
    assert.equal(await page.evaluate(() => DR.CardArt.card(DR.Missions.tutorial, 'dog', 0, 96, 0).photo), 'd01');
    await page.locator('#btn-goal-start').click();
    await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.run-card:not([hidden]) img')].some((i) => i.complete && i.naturalWidth > 0 && i.dataset.photo), null, { timeout: 20000 });
    assert.deepEqual(errors, []);
    console.log('bare OK tutorial');
  } finally { await browser.close(); }
}

async function fallbackPart() {
  const { browser, page, errors } = await openGame({ bare: true, viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    // 담은 파일이 없을 때(배포 사본에서 빠짐 등) — init script는 goto 뒤라 다시 읽는다
    await page.addInitScript(() => { window.__DR_PHOTO_EMBED = 'assets/cards/none.js'; });
    await page.reload();
    await ready(page);
    const r = await page.evaluate(() => {
      const A = DR.CardArt, m = DR.Missions.m1, c = A.card(m, 'umbrella_open', 0, 192, 0);
      let exp = 'ok'; try { c.toDataURL(); } catch (e) { exp = e.name; }
      return { mode: A.photoMode(), photo: c.photo || '', exp };
    });
    assert.deepEqual(r, { mode: 'canvas', photo: '', exp: 'ok' }, 'no usable photo → Canvas drawing, still exportable');
    await toRun(page);
    await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, FILL.m1);
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 60000 });
    const thumbs = await allLoaded(page, '#inspect-grid .bag-open > img');
    assert.ok(thumbs.n >= 6 && thumbs.ok === thumbs.n, 'fallback thumbnails ' + JSON.stringify(thumbs));
    const t0 = await pic(page, '#inspect-grid .bag-open > img');
    assert.ok(t0.std > 8, 'fallback thumbnail is a drawing, not blank ' + JSON.stringify(t0));
    await page.locator('#inspect-grid .bag-open').first().click();
    const z = await pic(page, '#inspect-zoom .zoom-art');
    assert.ok(z.loaded && z.std > 8, 'fallback zoom drawing ' + JSON.stringify(z));
    await page.screenshot({ path: shotPath('bare-fallback-m1-1280') });
    assert.deepEqual(errors.filter((e) => !/none\.js/.test(e)), [], 'only the missing embedded file is reported');
    console.log('bare OK fallback');
  } finally { await browser.close(); }
}

if (part === 'all' || part === 'A') for (const id of ['m1', 'm2', 'm3']) await missionPart(id);
if (part === 'all' || part === 'B') await tutorialPart();
if (part === 'all' || part === 'C') await fallbackPart();
console.log('PASS bare');
