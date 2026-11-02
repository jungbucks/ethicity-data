// 시작 화면 다시 꾸미기(사용자 지시서 2026-11-02): 패럴랙스 배경·비·데이터 선 반짝임, 3D 주인공 제자리 달리기 + 카드 줍기,
// 왼쪽 정렬 배치(390은 장면 위), 제목 글리치·떠나는 전환, 임무 카드(썸네일·한 줄·상태), 이어하기 위치, AI 봇 안내, 캐릭터 카드, og 이미지.
// 게임 로직·저장 키·버튼 기능·접근성 이름은 그대로.
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const SIZES = [{ width: 1148, height: 977 }, { width: 1428, height: 976 }, { width: 390, height: 844 }];

for (const viewport of SIZES) {
  const w = viewport.width;
  const { browser, page, errors } = await openGame({ viewport });
  try {
    await page.waitForFunction(() => DR.TitleScene && DR.TitleScene.state().running, null, { timeout: 8000 });
    // 배경 층: 하늘 고정 + 3층 흐름 + 비, 장식은 aria-hidden
    const scene = page.locator('#title-scene');
    assert.equal(await scene.getAttribute('aria-hidden'), 'true');
    for (const c of ['tl-sky', 'tl-far', 'tl-mid', 'tl-road', 'tl-rain']) assert.equal(await page.locator('#title-scene .' + c).count(), 1, c);
    assert.ok(await page.evaluate(() => !document.getElementById('title-scene').classList.contains('no-art')), 'art loaded');
    const x0 = await page.evaluate(() => DR.TitleScene.state().offsets);
    await page.waitForTimeout(700);
    const x1 = await page.evaluate(() => DR.TitleScene.state().offsets);
    assert.ok(x1.far !== x0.far && x1.mid !== x0.mid && x1.road !== x0.road, 'layers move');
    assert.ok(Math.abs(x1.road - x0.road) > Math.abs(x1.mid - x0.mid) && Math.abs(x1.mid - x0.mid) > Math.abs(x1.far - x0.far), 'road fastest, far slowest');
    // 3D 주인공: 작은 캔버스, 화소 비율 ≤ 1.25, 30fps 루프
    const st = await page.evaluate(() => DR.TitleScene.state());
    assert.equal(st.hero, 'onyu'); assert.equal(st.fpsCap, 30); assert.ok(st.pixelRatio <= 1.25); assert.equal(st.mode, '3d');
    assert.equal(await page.locator('#title-runner').getAttribute('aria-hidden'), 'true');
    // 배치: 넓은 화면은 글 왼쪽·장면 오른쪽, 390은 장면 위 / 위쪽 큰 빈 공간 없음
    const box = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return { h1: r('#screen-title h1'), act: r('#title-actions'), lead: r('.title-lead'), stage: r('#title-runner') };
    });
    if (w > 700) {
      assert.ok(box.stage.left > box.h1.right - 40, 'running scene on the right');
      assert.ok(Math.abs(box.act.left - box.h1.left) < 2 && Math.abs(box.lead.left - box.h1.left) < 2, 'buttons line up with title');
      assert.ok(box.h1.top < viewport.height * 0.3, 'no big empty top');
    } else {
      assert.ok(box.stage.bottom <= box.h1.top + 4, 'scene above the title on mobile');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'no sideways scroll');
    }
    // 임무 카드: 접근성 이름 그대로, 썸네일·한 줄·상태
    const cards = await page.locator('#title-missions button').evaluateAll((bs) => bs.map((b) => ({ id: b.id, name: b.getAttribute('aria-label'), img: !!b.querySelector('img'), hook: b.querySelector('.mc-hook')?.textContent, status: b.querySelector('.mc-status')?.textContent })));
    assert.deepEqual(cards.map((c) => c.name), ['1 임무 · 침수 판별', '2 임무 · 분리배출', '3 임무 · 길 안내']);
    assert.ok(cards.every((c) => c.img && c.hook && c.status === '아직'), JSON.stringify(cards));
    // AI 봇: 달릴 주인공 묶음 밖, 고를 수 없음, 말풍선
    assert.equal(await page.locator('#hero-pick img').count(), 2);
    assert.equal(await page.locator('#title-guide img').getAttribute('alt'), 'AI 봇');
    assert.equal(await page.locator('#title-guide button').count(), 0, 'bot is not selectable');
    assert.ok((await page.locator('#title-guide .tl-bubble').innerText()).length > 5);
    await page.screenshot({ path: shotPath('title-' + w) });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 주인공 바꾸기 → 달리는 모델도 바로 · 캐릭터 카드 표정 · 봇 말풍선 바뀜 · 카드 날아와 줍기
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1428, height: 976 } });
  try {
    await page.waitForFunction(() => DR.TitleScene.state().running);
    const line0 = await page.locator('#title-guide .tl-bubble').innerText();
    await page.locator('#hero-pick [data-hero="daon"]').click();
    assert.equal(await page.evaluate(() => DR.TitleScene.state().hero), 'daon');
    assert.equal(await page.locator('#hero-pick [data-hero="daon"]').getAttribute('aria-pressed'), 'true');
    assert.notEqual(await page.locator('#hero-pick [data-hero="daon"] .character-portrait img').evaluate((i) => i.style.transform), 'translateX(-0%)', 'expression changes on pick');
    await page.waitForFunction(() => DR.TitleScene.state().cardsCaught >= 1, null, { timeout: 9000 });
    await page.waitForFunction((l) => document.querySelector('#title-guide .tl-bubble').textContent !== l, line0, { timeout: 9000 });
    // og 이미지
    const og = await page.evaluate(() => [document.querySelector('meta[property="og:image"]')?.content, document.querySelector('meta[name="twitter:image"]')?.content]);
    assert.deepEqual(og, ['https://jungbucks.github.io/ethicity-data/assets/title/og-image.jpg', 'https://jungbucks.github.io/ethicity-data/assets/title/og-image.jpg']);
    // 떠나면 멈추고 3D 정리, 돌아오면 다시
    await page.locator('#btn-m1').click();
    await page.locator('#screen-story').waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(() => ({ r: DR.TitleScene.state().running, d: DR.TitleScene.state().disposed })), { r: false, d: true });
    await page.evaluate(() => DR.App.go('title'));
    await page.waitForFunction(() => DR.TitleScene.state().running);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 저장에서 읽는 상태: 이어하기 아래 위치, 임무 카드 완료/진행 중 + 떠나는 전환(0.6초 이내)
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1428, height: 976 }, titleFx: true });
  try {
    await page.evaluate(() => {
      DR.Save.setRecord('m1', { cleared: true, passed: true, firstTry: true, supplements: 0, firstFails: [], fixedLabels: 0 });
      DR.Save.checkpoint('inspect', { mission: 'm2', bag: [], supplements: 0, firstTry: null, seed: 2201 }, {});
      DR.App.records = DR.Save.records();
      DR.App.go('title');
    });
    assert.equal((await page.locator('#title-progress').innerText()).trim(), '2임무 · 검수부터');
    const status = await page.locator('#title-missions .mc-status').allInnerTexts();
    assert.deepEqual(status, ['완료', '진행 중', '아직']);
    // 클릭 → 화면 전환(go)까지 걸린 시간을 페이지 안에서 잰다(검수 화면 그리기 시간은 빼고)
    await page.evaluate(() => {
      document.getElementById('btn-continue').addEventListener('click', () => { window.__t0 = performance.now(); }, true);
      const go = DR.App.go; DR.App.go = function (n) { if (n !== 'title' && !window.__t1) window.__t1 = performance.now(); return go.apply(this, arguments); };
    });
    await page.locator('#btn-continue').click();
    assert.ok(await page.locator('#screen-title').evaluate((e) => e.classList.contains('tl-leaving')), 'leave transition');
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 3000 });
    const ms = await page.evaluate(() => window.__t1 - window.__t0);
    assert.ok(ms <= 650, 'transition within 0.6s (+ frame) ' + ms);
    assert.equal(await page.evaluate(() => DR.App.state.mission), 'm2', 'continue still resumes');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// 움직임 줄이기 → 정지 장면만 / 그림 실패 → 지금의 그라데이션으로
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1428, height: 976 } });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => DR.App.go('title'));
    await page.waitForTimeout(200);
    const a = await page.evaluate(() => DR.TitleScene.state());
    await page.waitForTimeout(500);
    const b = await page.evaluate(() => DR.TitleScene.state());
    assert.equal(a.running, false); assert.equal(a.still, true);
    assert.deepEqual(a.offsets, b.offsets, 'no parallax under reduced motion');
    await page.evaluate(() => DR.TitleScene.testFallback());
    assert.ok(await page.locator('#title-scene').evaluate((e) => e.classList.contains('no-art')));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('PASS title');
