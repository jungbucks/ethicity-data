// 플레이테스트 수정 2차(2026-11-12, 배포본 · 온유 · 1280×800 · 연습 ~ 2 임무) 브라우저 확인
//   T  타이틀: 왼쪽 위 "도시 n/5" 배지 없음 · 봇 첫 대사 = 지금/다음 임무 · 봇·말풍선이 주인공과 안 겹침(1148×977 · 1280×800 · 390×844) · 가로 넘침 없음
//   P  한 판(1280×800): 연습 → 1 임무 → 챕터 끝 → 도시 → 2 임무 결과까지
//        빈 대화 화면 없음(연습 합격·선배·마무리) · 임무 완료 화면 뒤 어두운 그림 · 장면 카드 갈색 띠 없음 · 개인정보 종류 안내·테두리·크게 보기 빼기 ·
//        챕터 끝 문장 · 주 버튼이 첫 화면에 · 연습 카드 설명 폭 · 분류함이 벨트 폭에 고르게 · 비상 정지 그림 · 2 임무 결과 문구가 잘못 간 물건 전부
//   E  3·4 임무 뒤 활동: 마무리 대화·(4 임무) 재연결 뒤 줄에 이미 있는 장면 그림, 임무 완료 화면 뒤 어두운 그림, 3 임무 도입은 그림 없음 그대로
//   N  좁은 화면(390×844): 주 버튼이 첫 화면에, 가로 넘침 없음(연습 검수 · 1 임무 결과 · 2 임무 결과)
// 하나만: ONLY=T node data/tests/playtest2-browser.mjs
import assert from 'node:assert/strict';
import { openGame, passExam, shotPath } from './browser.mjs';

const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (id) => !ONLY.length || ONLY.includes(id);
const SAVE = 'ethicity.data.save';

// 주 버튼이 지금 화면(스크롤 0)에 통째로 보이나
const inView = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return { ok: false, missing: true };
  const r = e.getBoundingClientRect(), scr = document.getElementById('screen-' + DR.App.screen);
  // 그 자리의 맨 위 요소가 버튼(또는 그 안)이어야 '보인다' — 다른 것에 덮이지 않음
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { ok: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && scr.scrollTop === 0 && !!top && (top === e || e.contains(top)),
    top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, scrollTop: scr.scrollTop, scrollH: scr.scrollHeight };
}, sel);
const overflowX = (page) => page.evaluate(() => {
  const scr = document.getElementById('screen-' + DR.App.screen);
  return { ok: document.documentElement.scrollWidth <= innerWidth && scr.scrollWidth <= scr.clientWidth, doc: document.documentElement.scrollWidth, win: innerWidth, scr: scr.scrollWidth, cw: scr.clientWidth, screen: DR.App.screen };
});
async function noOverflow(page, label) { const o = await overflowX(page); assert.ok(o.ok, label + ' horizontal overflow ' + JSON.stringify(o)); }
async function mainButton(page, sel, label) { const v = await inView(page, sel); assert.ok(v.ok, label + ' main button on the first screen ' + JSON.stringify(v)); return v; }

async function toRun(page) {
  if (await page.locator('#screen-story').isVisible()) await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#btn-run').click();
  if (await page.locator('#btn-goal-start').count()) await page.locator('#btn-goal-start').click();
  await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 20000 });
}
async function fill(page, counts, screenId) {
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, counts);
  await page.locator(screenId || '#screen-inspect').waitFor({ state: 'visible', timeout: 60000 });
}
// 대화: 줄마다 { text, bg(그림 주소 끝), hasBg } 를 모으며 끝까지 넘긴다
async function readDialogue(page) {
  const out = [];
  await page.locator('#screen-story .dialog').waitFor({ state: 'visible', timeout: 20000 });
  for (let n = 0; n < 30 && await page.locator('#screen-story').isVisible(); n++) {
    out.push(await page.evaluate(() => {
      const scr = document.getElementById('screen-story'), img = scr.querySelector('.story-bg');
      return { text: scr.querySelector('.dialog-text').textContent, hasBg: scr.classList.contains('has-bg'), bg: img ? (img.getAttribute('src') || '') : '' };
    }));
    await page.locator('#screen-story .dialog').click();
  }
  return out;
}
// 장면 그림(dataURL <img>)의 화소: 아래쪽에 갈색 바닥 띠가 없는지, 사진이 세로 가운데인지
const artBand = (page, sel) => page.evaluate((s) => new Promise((res) => {
  const im = document.querySelector(s), c = document.createElement('canvas');
  const run = () => {
    c.width = c.height = 200; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 200, 200);
    const px = (x, y) => Array.from(g.getImageData(Math.round(x * 200), Math.round(y * 200), 1, 1).data.slice(0, 3));
    const bg = px(0.5, 0.02), same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 24;
    // 왼쪽 사진을 지나는 세로줄(x 27%)에서 바탕이 아닌 첫·마지막 줄
    let first = -1, last = -1;
    for (let y = 0; y < 200; y++) if (!same(px(0.27, y / 200), bg)) { if (first < 0) first = y; last = y; }
    res({ bg, bottom: px(0.5, 0.9), bottomSame: same(px(0.5, 0.9), bg) && same(px(0.1, 0.97), bg) && same(px(0.9, 0.85), bg), top: first / 200, bottomGap: (199 - last) / 200 });
  };
  if (im.complete && im.naturalWidth) run(); else im.onload = run;
}), sel);

/* ---------- T. 타이틀 ---------- */
const BASE = { v: 1, mission: null, tutorialDone: true, cityV: 1 };
const cleared = (...ids) => Object.fromEntries(ids.map((id) => [id, { cleared: true, passed: true, firstTry: true, supplements: 0, firstFails: [] }]));
const SAVES = [
  ['처음(저장 없음)', null, 'tutorial', /개를 보고 내가 고양이라고 했어/],
  ['튜토리얼만 끝냄', { ...BASE, records: cleared('tutorial') }, 'm1', /접힌 우산을 내가 못 알아봐/],
  ['1 임무까지 깸', { ...BASE, records: cleared('tutorial', 'm1') }, 'm2', /캔 사이에 숨은 건전지/],
  ['1·2 임무 깸', { ...BASE, records: cleared('tutorial', 'm1', 'm2') }, 'm3', /비만 오면 내가 길을 헷갈려/],
  // 신고된 경우: 4 임무를 하는 중인데 3 임무 대사가 나왔다
  ['4 임무 진행 중', { ...BASE, mission: 'm4', screen: 'briefing', bag: [], supplements: 0, firstTry: null, seed: 4401, needRevealed: false, newIds: [], records: cleared('tutorial', 'm1', 'm2', 'm3') }, 'm4', /흘려 쓴 글씨를 내가 잘못 읽어/],
  ['2 임무 진행 중(1 임무 안 깸)', { ...BASE, mission: 'm2', screen: 'inspect', bag: [], supplements: 0, firstTry: null, seed: 2201, needRevealed: false, newIds: [], records: cleared('tutorial') }, 'm2', /캔 사이에 숨은 건전지/],
  ['다 깸', { ...BASE, records: cleared('tutorial', 'm1', 'm2', 'm3', 'm4') }, null, /도시가 다 이어졌어/]
];
// 시작 화면 루프가 한 번 그린 직후(같은 프레임) 3D 캔버스에서 주인공이 그려진 영역(화면 좌표)
const heroBox = (page) => page.evaluate(() => new Promise((res) => {
  const d0 = DR.TitleScene.state().draws; let tries = 0;
  (function tick() {
    if (DR.TitleScene.state().draws === d0 && ++tries < 240) return requestAnimationFrame(tick);
    const c = document.getElementById('title-runner'), gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl || gl.isContextLost()) return res(null);
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let x0 = w, x1 = -1, y0 = h, y1 = -1, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (buf[(y * w + x) * 4 + 3] > 40) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (!n) return res(null);
    const r = c.getBoundingClientRect(); // readPixels는 아래 줄부터
    res({ left: r.left + x0 / w * r.width, right: r.left + (x1 + 1) / w * r.width, top: r.top + (h - 1 - y1) / h * r.height, bottom: r.top + (h - y0) / h * r.height, opaque: n,
      stage: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
  })();
}));
const rectOf = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }, sel);
const gapOf = (a, b) => Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom); // > 0이면 떨어져 있음(가장 큰 축 간격)

if (want('T')) {
  for (const viewport of [{ width: 1148, height: 977 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const { browser, page, errors } = await openGame({ viewport });
    try {
      const w = viewport.width;
      for (const [name, save, lineFor, re] of SAVES) {
        await page.evaluate(([k, v]) => { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); }, [SAVE, save]);
        await page.reload();
        await page.locator('#title-guide .tl-bubble').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#title-city').count(), 0, name + ': no city badge');
        assert.equal(await page.locator('.title-city, .title-city-text').count(), 0);
        const st = await page.evaluate(() => DR.TitleScene.state());
        const bubble = await page.locator('#title-guide .tl-bubble').innerText();
        assert.match(bubble, re, name + ' @' + w + ': ' + bubble);
        if (lineFor) { assert.equal(st.lineFor, lineFor, name); assert.equal(st.lineSet, 'normal'); } else assert.equal(st.lineSet, 'done', name);
        // 봇·말풍선이 주인공과 겹치지 않는다(둥실 ±6px 여유) — 첫 대사와 가장 긴 대사(두 줄)에서
        const hero = await heroBox(page);
        assert.ok(hero && hero.opaque > 400, name + ' hero drawn ' + JSON.stringify(hero));
        const bot = await rectOf(page, '#title-guide .tl-bot .character-portrait'), bub = await rectOf(page, '#title-guide .tl-bubble');
        const gBot = gapOf(bot, hero), gBub = gapOf(bub, hero);
        assert.ok(gBot > 6, `${name} @${w} bot clear of the hero: gap ${gBot.toFixed(1)} bot ${JSON.stringify(bot)} hero ${JSON.stringify(hero)}`);
        assert.ok(gBub > 6, `${name} @${w} bubble clear of the hero: gap ${gBub.toFixed(1)} bubble ${JSON.stringify(bub)} hero ${JSON.stringify(hero)}`);
        // 봇·말풍선이 제목 카드(버튼·임무 카드)를 덮지 않는다 · 화면 밖으로 안 나간다
        const wrap = await rectOf(page, w > 700 ? '.title-wrap' : '#title-actions');
        assert.ok(gapOf(bot, wrap) >= 0 && gapOf(bub, wrap) >= 0, `${name} @${w} guide clear of the title card ${JSON.stringify({ bot, bub, wrap })}`);
        assert.ok(bot.left >= 0 && bot.right <= w && bub.left >= 0 && bub.right <= w && bub.top >= 0, `${name} @${w} guide inside the screen ${JSON.stringify({ bot, bub })}`);
        await noOverflow(page, name + ' @' + w + ' title');
        if (name === '4 임무 진행 중') {
          console.log(`  title @${w}×${viewport.height}: hero ${[hero.left, hero.top, hero.right, hero.bottom].map(Math.round)} bot ${[bot.left, bot.top, bot.right, bot.bottom].map(Math.round)} bubble ${[bub.left, bub.top, bub.right, bub.bottom].map(Math.round)} gaps bot ${gBot.toFixed(0)} bubble ${gBub.toFixed(0)}`);
          await page.screenshot({ path: shotPath('playtest2-title-' + w) });
          // 화면을 내려도(임무 카드가 화면보다 길 때) 봇은 주인공과 같은 기준이라 따라 겹치지 않는다
          await page.evaluate(() => { const s = document.getElementById('screen-title'); s.scrollTop = s.scrollHeight; });
          const hero2 = await heroBox(page), bot2 = await rectOf(page, '#title-guide .tl-bot .character-portrait'), bub2 = await rectOf(page, '#title-guide .tl-bubble');
          assert.ok(gapOf(bot2, hero2) > 6 && gapOf(bub2, hero2) > 6, `scrolled @${w} still clear ${JSON.stringify({ hero2, bot2, bub2 })}`);
        }
      }
      // 대사가 넘어가도(가장 긴 줄 포함) 안 겹친다 — 네 줄을 직접 넣어 본다
      const longest = await page.evaluate(() => { const b = document.querySelector('#title-guide .tl-bubble'); b.textContent = '사진은 많이 모으기보다, 목적에 맞게 모아야 해!'; return b.textContent; });
      const heroL = await heroBox(page), bubL = await rectOf(page, '#title-guide .tl-bubble'), botL = await rectOf(page, '#title-guide .tl-bot .character-portrait');
      assert.ok(gapOf(bubL, heroL) > 6 && gapOf(botL, heroL) > 6, `longest line @${w} "${longest}" ${JSON.stringify({ heroL, bubL, botL })}`);
      assert.deepEqual(errors, []);
      console.log('ok T title', w + '×' + viewport.height, '— no badge, bot line follows the mission, bot/bubble clear of the hero');
    } finally { await browser.close(); }
  }
}

/* ---------- P. 한 판(1280×800): 연습 → 1 임무 → 챕터 끝 → 도시 → 2 임무 결과 ---------- */
const M1_ALL = { umbrella_open: 3, umbrella_folded: 3, wallet_closed: 3, wallet_open: 3, phone_front: 3, phone_back: 3 };
const M2_ALL = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };
async function submitTry(page) {
  await page.locator('#btn-submit').click();
  await page.locator('#screen-supervisor').waitFor({ state: 'visible' });
  return { text: await page.locator('#screen-supervisor').innerText(), confirm: await page.locator('#btn-confirm').count() };
}

if (want('P')) {
  const viewport = { width: 1280, height: 800 };
  const { browser, page, errors } = await openGame({ viewport });
  try {
    // 세이브가 있는 상태의 연습(브리핑부터, 끝나면 타이틀)
    await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE, { ...BASE, records: cleared('tutorial') }]);
    await page.reload();
    await page.locator('#btn-practice').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    // 7) 연습 브리핑 장면 카드 = 받은 그림(512² webp), 정사각형
    const card = page.locator('#screen-briefing .brief-scene[data-scene="T1"] img');
    assert.match(await card.getAttribute('src'), /^assets\/story\/practice-shelter\.webp$/);
    await page.waitForFunction(() => { const i = document.querySelector('.brief-scene[data-scene="T1"] img'); return i.complete && i.naturalWidth === 512; }, null, { timeout: 10000 });
    const cb = await card.boundingBox();
    assert.ok(Math.abs(cb.width - cb.height) < 1, 'practice card is square ' + JSON.stringify(cb));
    assert.equal(await page.locator('#screen-briefing .brief-scene figcaption').innerText(), '보호소 입양 안내');
    await noOverflow(page, 'practice briefing');
    await page.screenshot({ path: shotPath('playtest2-practice-briefing-1280') });
    await toRun(page);
    await fill(page, { dog: 5, cat: 5 });
    // 6) 연습 검수: 주 버튼이 첫 화면에, 연습 카드 설명 글 폭 = 위 카드 격자 폭(한 줄), 연습 카드 칸 = 격자 칸
    await page.locator('#exam-drill').waitFor();
    await mainButton(page, '#btn-submit', 'exam inspect 1280');
    const drill = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect(), p = r('#exam-drill p'), g = r('#exam-grid'), c = r('#exam-drill .exam-card'), gc = r('#exam-grid .exam-card');
      const lh = parseFloat(getComputedStyle(document.querySelector('#exam-drill p')).lineHeight);
      return { pW: p.width, gridW: g.width, lines: Math.round(p.height / lh), cardW: c.width, gridCardW: gc.width };
    });
    assert.ok(Math.abs(drill.pW - drill.gridW) < 1, 'drill text as wide as the grid ' + JSON.stringify(drill));
    assert.equal(drill.lines, 1, 'drill text on one line at 1280 ' + JSON.stringify(drill));
    assert.ok(Math.abs(drill.cardW - drill.gridCardW) < 1, 'drill card as wide as a grid card ' + JSON.stringify(drill));
    await noOverflow(page, 'exam inspect');
    await page.screenshot({ path: shotPath('playtest2-exam-inspect-1280') });
    await passExam(page);
    // 1) 연습 합격 대화: 줄마다 시험장 그림
    const tOut = await readDialogue(page);
    assert.equal(tOut.length, 3);
    for (const l of tOut) assert.ok(l.hasBg && /assets\/story\/opening\/04-exam-onyu\.webp$/.test(l.bg), 'practice outro line has the exam scene: ' + JSON.stringify(l));
    if (await page.locator('#screen-city').isVisible()) await page.locator('#btn-city-next').click();
    await page.locator('#screen-title').waitFor({ state: 'visible', timeout: 10000 });

    // ----- 1 임무 -----
    await page.locator('#btn-m1').click();
    const intro = await readDialogue(page);
    assert.ok(intro.length >= 8 && intro.every((l) => l.hasBg && /m1-lostfound\.webp$/.test(l.bg)), 'm1 intro keeps its picture');
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#screen-briefing h2').first().innerText(), '오늘 접수대에 들어온 물건');
    // 2) 브리핑 장면 카드: 갈색 바닥 띠 없음, 사진이 세로 가운데
    for (const sid of ['S1', 'S2', 'S3']) {
      const a = await artBand(page, `#screen-briefing .brief-scene[data-scene="${sid}"] img`);
      assert.ok(a.bottomSame, sid + ' briefing card: no floor band ' + JSON.stringify(a));
      assert.ok(Math.abs(a.top - a.bottomGap) < 0.02 && a.top > 0.2 && a.top < 0.35, sid + ' photos vertically centred ' + JSON.stringify(a));
    }
    await noOverflow(page, 'm1 briefing');
    await page.screenshot({ path: shotPath('playtest2-m1-briefing-1280') });
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 20000 });
    await fill(page, { ...M1_ALL, p_wallet_id: 1, p_phone_msg: 1 });
    const ids = await page.evaluate(() => Object.fromEntries(DR.App.state.bag.filter((c) => c.privateId).map((c) => [c.privateId, c.id])));
    // 3-d) 썸네일: 알림이 뜬 스마트폰 ≠ 보통 스마트폰(검수 격자 크기에서) — 화면 부분 밝기·색 차이를 잰다
    const thumbs = await page.evaluate(() => {
      const A = DR.CardArt, m = DR.Missions.m1;
      const t = (id) => A.thumb(A.card(m, id, 0, 192, 0), 24), a = t('p_phone_msg'), b = t('phone_front');
      const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, db = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
      let diff = 0, la = 0, lb = 0, n = 0;
      // 가운데 40%(스마트폰 화면)
      for (let y = Math.round(a.height * 0.3); y < a.height * 0.7; y++) for (let x = Math.round(a.width * 0.3); x < a.width * 0.7; x++) {
        const i = (y * a.width + x) * 4; diff += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        la += (da[i] + da[i + 1] + da[i + 2]) / 3; lb += (db[i] + db[i + 1] + db[i + 2]) / 3; n++;
      }
      return { size: a.width, photo: !!A.card(m, 'p_phone_msg', 0, 192, 0).photo && !!A.card(m, 'phone_front', 0, 192, 0).photo, diff: diff / n / 3, lumMsg: la / n, lumPlain: lb / n };
    });
    assert.ok(thumbs.photo, 'both thumbnails come from the photos');
    console.log('  phone thumbnails(검수 격자 썸네일, 가운데 40%):', JSON.stringify(thumbs));
    assert.ok(thumbs.diff > 40 && thumbs.lumMsg - thumbs.lumPlain > 40, 'message phone is clearly brighter than the plain phone at thumbnail size ' + JSON.stringify(thumbs));
    await page.locator(`#inspect-grid .bag-card[data-id="${ids.p_phone_msg}"]`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: shotPath('playtest2-m1-inspect-thumbs-1280') });
    await page.evaluate(() => { document.getElementById('screen-inspect').scrollTop = 0; });

    // 3-a·b) 그대로 제출 → 막힘(종류 말 안 함) → 지갑만 가림 → "스마트폰 사진 중에 아직 1장 더" → 그대로 다시 → 테두리 안내 → 검수에서 스마트폰 카드 테두리
    let s = await submitTry(page);
    assert.match(s.text, /잠깐, 개인정보가 담긴 사진이 학습 자료에 들어가려 해\./);
    assert.doesNotMatch(s.text, /스마트폰|지갑/, 'first block names no kind');
    assert.equal(s.confirm, 0);
    await page.locator('#btn-back').click();
    assert.equal(await page.locator('#inspect-grid .look-here').count(), 0);
    await page.locator(`#inspect-grid .bag-card[data-id="${ids.p_wallet_id}"] .bag-open`).click();
    // 3-c) 크게 보기에 '빼기'도 있다
    assert.equal(await page.locator('#inspect-zoom #btn-mask').innerText(), '가리기');
    assert.equal(await page.locator('#inspect-zoom #btn-zoom-remove').innerText(), '빼기');
    await page.locator('#btn-mask').click();
    await page.keyboard.press('Escape');
    s = await submitTry(page);
    assert.ok(s.text.includes('잘 가린 사진도 있어. 개인정보가 담긴 사진이 스마트폰 사진 중에 아직 1장 더 있어.'), 'kind hint: ' + s.text);
    assert.ok(s.text.includes('이대로는 승인 못 해. 검수에서 다시 살펴봐.'));
    assert.equal(s.confirm, 0);
    await page.screenshot({ path: shotPath('playtest2-m1-block-kind-1280') });
    await page.locator('#btn-back').click();
    assert.equal(await page.locator('#inspect-grid .look-here').count(), 0, 'no highlight after the first kind hint');
    s = await submitTry(page);
    assert.ok(s.text.includes('잘 가린 사진도 있어. 개인정보가 담긴 사진이 스마트폰 사진 중에 아직 1장 더 있어.'));
    assert.ok(s.text.includes('검수로 돌아가면 스마트폰 사진 테두리를 잠깐 밝혀 둘게. 그 안에서 찾아봐.'), 'look line: ' + s.text);
    await page.locator('#btn-back').click();
    const look = await page.evaluate(() => {
      const m = DR.Missions.m1, cells = [...document.querySelectorAll('#inspect-grid .bag-card')];
      const lab = (cell) => { const c = DR.App.state.bag.find((x) => String(x.id) === cell.dataset.id); return DR.Cards.currentLabel(m, c); };
      const on = cells.filter((c) => c.classList.contains('look-here'));
      return { on: on.length, labels: [...new Set(on.map(lab))], phones: cells.filter((c) => lab(c) === 'phone').length, border: on.length ? getComputedStyle(on[0]).borderTopColor : '', anim: on.length ? getComputedStyle(on[0]).animationName : '' };
    });
    assert.deepEqual(look.labels, ['phone'], 'only phone cards are outlined ' + JSON.stringify(look));
    assert.equal(look.on, look.phones); assert.equal(look.on, 7, 'all phone cards (front 3 + back 3 + the private one), not just the one');
    assert.equal(look.border, 'rgb(255, 210, 74)'); assert.equal(look.anim, 'none', 'no animation');
    await page.screenshot({ path: shotPath('playtest2-m1-look-1280') });
    await page.waitForFunction(() => !document.querySelector('#inspect-grid .look-here'), null, { timeout: 6000 });
    assert.equal(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).privTold, SAVE), undefined, 'privTold is not saved (save structure unchanged)');

    // 3-c) 크게 보기에서 빼기 = 격자의 빼기와 같은 동작(되돌리기 포함, 바로 저장)
    const before = await page.evaluate(() => DR.App.state.bag.map((c) => c.id));
    const victim = await page.evaluate(() => DR.App.state.bag.find((c) => c.key === 'umbrella_open').id);
    await page.locator(`#inspect-grid .bag-card[data-id="${victim}"] .bag-open`).click();
    await page.locator('#btn-zoom-remove').click();
    assert.equal(await page.locator('#inspect-zoom').count(), 0, 'zoom closes');
    assert.deepEqual(await page.evaluate(() => DR.App.state.bag.map((c) => c.id)), before.filter((i) => i !== victim));
    assert.equal(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).bag.length, SAVE), before.length - 1, 'saved at once');
    assert.match(await page.locator('#undo-toast').innerText(), /뺐어요: 우산/);
    assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('bag-open')), 'focus goes to a card');
    await page.locator('#undo-toast button').click();
    assert.deepEqual(await page.evaluate(() => DR.App.state.bag.map((c) => c.id)), before, 'undo puts it back in place');
    // 개인정보 카드도 크게 보기에서 뺄 수 있다(가리는 대신) → 통과
    await page.locator(`#inspect-grid .bag-card[data-id="${ids.p_phone_msg}"] .bag-open`).click();
    await page.screenshot({ path: shotPath('playtest2-m1-zoom-remove-1280') });
    await page.locator('#btn-zoom-remove').click();
    await page.evaluate(() => DR.UI.clearToast());
    assert.equal(await page.evaluate(() => DR.App.state.bag.filter((c) => c.privateId === 'p_phone_msg').length), 0);
    s = await submitTry(page);
    assert.equal(s.confirm, 1, 'passes the privacy check: ' + s.text);
    await page.locator('#btn-confirm').click();

    // 6) 컨베이어: 분류함 4개가 벨트 폭에 고르게
    await page.locator('#screen-conveyor').waitFor({ state: 'visible' });
    const bins = await page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect(), belt = r(document.querySelector('.cv-belt')), b = [...document.querySelectorAll('.cv-bin')].map(r);
      return { n: b.length, belt: [belt.left, belt.right], first: b[0].left, last: b[b.length - 1].right, widths: b.map((x) => Math.round(x.width)), rows: new Set(b.map((x) => Math.round(x.top))).size };
    });
    assert.equal(bins.n, 4);
    assert.ok(Math.abs(bins.first - bins.belt[0]) < 2 && Math.abs(bins.last - bins.belt[1]) < 2, 'bins span the belt ' + JSON.stringify(bins));
    assert.ok(new Set(bins.widths).size === 1 && bins.rows === 1, 'equal bins in one row ' + JSON.stringify(bins));
    await page.locator('#btn-cv-skip').click();
    await page.screenshot({ path: shotPath('playtest2-m1-conveyor-1280') });
    await page.locator('#btn-cv-next').click();

    // 2·6) 결과: 장면 카드에 갈색 띠 없음, [다음 장면]이 첫 화면에(통과 판 — 스마트폰 뒷면 3장은 남았다)
    for (let i = 0; i < 3; i++) {
      await page.locator('#screen-result .result-scene').waitFor({ state: 'visible' });
      const a = await artBand(page, '#screen-result .result-art');
      assert.ok(a.bottomSame && Math.abs(a.top - a.bottomGap) < 0.02, 'result card ' + (i + 1) + ': no floor band, centred ' + JSON.stringify(a));
      const v = await mainButton(page, '#btn-next', 'm1 result ' + (i + 1));
      assert.equal(await page.locator('#btn-next').innerText(), i < 2 ? '다음 장면' : '계속');
      await noOverflow(page, 'm1 result ' + (i + 1));
      if (i === 0) { console.log('  m1 result 1/3 @1280×800: 다음 장면 y', v.top, '~', v.bottom, '/ 화면', v.vh, '(내용 높이', v.scrollH + ')'); await page.screenshot({ path: shotPath('playtest2-m1-result-1280') }); }
      await page.locator('#btn-next').click();
    }
    // 1) 선배 대사 두 줄에 해결된 장면 그림
    const senior = await readDialogue(page);
    assert.deepEqual(senior.map((l) => l.text), ['첫날치고 나쁘지 않네.', '근데 AI 너무 믿지는 마. AI는 네가 준 것 이상은 절대 몰라.']);
    for (const l of senior) assert.ok(l.hasBg && /assets\/story\/m1-lostfound-solved\.webp$/.test(l.bg), 'senior line has the solved scene: ' + JSON.stringify(l));

    // 4) 챕터 끝 문장
    await page.locator('#screen-chapter').waitFor({ state: 'visible' });
    const choice = async (cls, id) => { await page.locator(`.${cls}[data-choice="${id}"]`).click(); };
    assert.match(await page.locator('#screen-chapter').innerText(), /○○마트 마케팅팀/);
    assert.deepEqual(await page.locator('.ch-choice span:not(.ch-mark)').allInnerTexts(), ['주인들에게 먼저 동의를 받고 보낸다', '거절한다. 연락처는 물건을 돌려주려고 받은 거야', '이미 받은 연락처니까 그냥 나눠 준다']);
    await choice('ch-choice', 'erase');
    assert.equal(await page.locator('#ch-feedback').innerText(), '연락처는 물건을 돌려주려고 받은 거야. 다른 일에 쓰면, 그 사람은 내 번호가 어디로 갔는지 모르게 돼.');
    await page.screenshot({ path: shotPath('playtest2-chapter-request-1280'), fullPage: true });
    await choice('ch-choice', 'consent');
    assert.equal(await page.locator('#ch-feedback').innerText(), '동의를 묻는 문자도 결국 그 번호를 원래 목적과 다르게 쓰는 일이야. 물건을 돌려주는 일과 상관없는 부탁이라면 거절이 가장 안전해.');
    await choice('ch-choice', 'refuse');
    assert.equal(await page.locator('#ch-feedback').innerText(), '맞아. 모은 목적 안에서만 쓰는 게 원칙이야.');
    assert.deepEqual(await page.evaluate(() => DR.Save.chapterOf(DR.Save.records(), 'm1').req), { first: 'erase', last: 'refuse' }, 'first/last still saved');
    await page.locator('#btn-ch-next').click();
    assert.match(await page.locator('.ch-question').innerText(), /접힌 우산 사진을 모으지 않으면, AI는 접힌 모습의 우산을 어떻게 할까\?/);
    assert.deepEqual(await page.locator('.ch-concept span:not(.ch-mark)').allInnerTexts(), ['알아보지 못한다', '비슷하니까 알아서 알아본다', '사진을 많이 모으면 접힌 모습도 저절로 알게 된다']);
    await choice('ch-concept', 'c');
    assert.equal(await page.locator('#ch-concept-feedback').innerText(), '수거봇의 3,000장처럼 많아도 같은 모습만 있으면 소용없어. 빠진 모습을 넣어야 알아봐.');
    await page.screenshot({ path: shotPath('playtest2-chapter-concept-1280'), fullPage: true });
    await choice('ch-concept', 'a');
    await page.locator('#btn-ch-next').click();
    await page.locator('#btn-ch-done').click();
    // 도시 복구 화면은 그대로
    await page.locator('#screen-city').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#btn-city-next').click({ timeout: 15000 });
    // 1) 마무리 대화에도 그림, 임무 완료 화면 뒤에 같은 그림을 어둡게
    const outro = await readDialogue(page);
    assert.equal(outro.length, 2);
    for (const l of outro) assert.ok(l.hasBg && /m1-lostfound-solved\.webp$/.test(l.bg));
    await page.locator('#screen-outro').waitFor({ state: 'visible' });
    await page.waitForFunction(() => { const i = document.querySelector('#screen-outro .outro-bg'); return i && i.complete && i.naturalWidth === 1600; }, null, { timeout: 10000 });
    const ob = await page.evaluate(() => {
      const i = document.querySelector('#screen-outro .outro-bg'), cs = getComputedStyle(i), r = i.getBoundingClientRect(), h2 = document.querySelector('#screen-outro h2');
      const pg = getComputedStyle(document.querySelector('#screen-outro .outro-page'));
      return { src: i.getAttribute('src'), filter: cs.filter, pos: cs.position, rect: [r.left, r.top, r.width, r.height], vw: innerWidth, vh: innerHeight, h2: h2.textContent, h2Color: getComputedStyle(h2).color,
        sumColor: getComputedStyle(document.querySelector('#outro-summary')).color, pageZ: pg.zIndex, imgZ: cs.zIndex, hidden: i.getAttribute('aria-hidden'), alt: i.getAttribute('alt') };
    });
    assert.match(ob.src, /m1-lostfound-solved\.webp$/);
    assert.equal(ob.filter, 'brightness(0.35)');
    assert.deepEqual(ob.rect, [0, 0, ob.vw, ob.vh], 'backdrop covers the screen');
    assert.equal(ob.h2, '도시 한 구간이 다시 이어졌다');
    assert.ok(Number(ob.pageZ) > Number(ob.imgZ) && ob.hidden === 'true' && ob.alt === '', JSON.stringify(ob));
    assert.equal(ob.h2Color, 'rgb(244, 241, 255)'); assert.equal(ob.sumColor, 'rgb(244, 241, 255)', 'text keeps a light colour over the darkened picture');
    // 4) 요약: 마지막 선택 아래 '생각해 볼 점' 한 줄 — 점수·정오 표시 없음
    const sum = await page.locator('#outro-summary li').allInnerTexts();
    const reqLi = sum.find((t) => t.startsWith('다른 용도 요청:'));
    assert.equal(reqLi.replace(/\s*\n\s*/g, ' | '), '다른 용도 요청: 거절 (처음엔 그냥 나눠 주기) | 생각해 볼 점: 모은 목적 밖으로 쓰는 일인지');
    assert.equal(await page.locator('#outro-summary .outro-hint').count(), 1);
    assert.doesNotMatch(sum.join(' '), /점수|정답|오답|○|✕|[0-9]+점/);
    await noOverflow(page, 'm1 outro');
    await page.screenshot({ path: shotPath('playtest2-m1-outro-1280') });

    // ----- 2 임무 -----
    await page.locator('#btn-next-mission').click();
    const intro2 = await readDialogue(page);
    assert.ok(intro2.every((l) => l.hasBg && /m2-sorting\.webp$/.test(l.bg)));
    await page.locator('#screen-briefing').waitFor({ state: 'visible' });
    assert.match(await page.locator('#screen-briefing').innerText(), /이 AI가 판단해야 할 장면/);
    await noOverflow(page, 'm2 briefing');
    await page.locator('#btn-run').click();
    await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 20000 });
    // 플레이테스트의 판: 칫솔('투명 페트')·고양이('비닐')가 섞임 + 건전지('캔') 2장 → 비상 정지
    await fill(page, { ...M2_ALL, f_toothbrush: 1, f_cat: 1, f_battery: 2 });
    s = await submitTry(page);
    assert.equal(s.confirm, 1, s.text);
    await page.locator('#btn-confirm').click();
    await page.locator('#screen-conveyor').waitFor({ state: 'visible' });
    const bins2 = await page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect(), belt = r(document.querySelector('.cv-belt')), b = [...document.querySelectorAll('.cv-bin')].map(r);
      return { n: b.length, belt: [belt.left, belt.right], first: b[0].left, last: b[b.length - 1].right, rows: new Set(b.map((x) => Math.round(x.top))).size };
    });
    assert.ok(bins2.n === 7 && bins2.rows === 1 && Math.abs(bins2.first - bins2.belt[0]) < 2 && Math.abs(bins2.last - bins2.belt[1]) < 2, 'm2 bins unchanged: 7 across the belt ' + JSON.stringify(bins2));
    await page.locator('#btn-cv-fast').click();
    // 7) 비상 정지 창 그림 = 받은 그림
    await page.locator('#cv-stop:not([hidden]) .cv-stop-art').waitFor({ state: 'visible', timeout: 30000 });
    assert.match(await page.locator('.cv-stop-art').getAttribute('src'), /^assets\/story\/m2-emergency-stop\.webp$/);
    await page.waitForFunction(() => { const i = document.querySelector('.cv-stop-art'); return i.complete && i.naturalWidth === 512; }, null, { timeout: 10000 });
    assert.match(await page.locator('#cv-stop').innerText(), /비상 정지! 캔 함에 건전지가 들어갔어\./);
    const sb = await page.locator('.cv-stop-art').boundingBox();
    assert.ok(Math.abs(sb.width - sb.height) < 1 && sb.width >= 200, JSON.stringify(sb));
    await page.screenshot({ path: shotPath('playtest2-m2-stop-1280') });
    await page.locator('#btn-cv-resume').click();
    await page.locator('#btn-cv-skip').click();
    await page.locator('#btn-cv-next').click();
    // 6) 결과 2/4 '찌그러진 페트병과 비닐': 머리 문구가 잘못 간 물건을 전부 말하고, 원인 줄마다 '그래서 …'
    const scenes = [];
    for (let i = 0; i < 4; i++) {
      await page.locator('#screen-result .result-scene').waitFor({ state: 'visible' });
      const sc = await page.evaluate(() => {
        const q = (s) => [...document.querySelectorAll('#screen-result ' + s)].map((e) => e.innerText.trim());
        const el = document.querySelector('#screen-result .result-scene');
        return { scene: el.dataset.scene, outcome: el.dataset.outcome, kicker: q('.kicker')[0], h2: q('h2')[0], lead: q('.lead')[0], contam: q('p.contam'), also: q('p.contam-also'), wrong: q('.result-wrong figcaption') };
      });
      scenes.push(sc);
      await mainButton(page, '#btn-next', 'm2 result ' + (i + 1));
      await noOverflow(page, 'm2 result ' + (i + 1));
      if (sc.scene === 'S2') await page.screenshot({ path: shotPath('playtest2-m2-result-S2-1280'), fullPage: true });
      await page.locator('#btn-next').click();
    }
    const s2 = scenes.find((x) => x.scene === 'S2');
    assert.equal(s2.kicker, '결과 · 2/4 장면'); assert.equal(s2.h2, '찌그러진 페트병과 비닐'); assert.equal(s2.outcome, 'inconvenience');
    assert.deepEqual(s2.wrong, ['투명 페트병 → 비닐 함', '비닐봉지 → 일반쓰레기 함', '칫솔 → 투명 페트 함']);
    assert.equal(s2.lead, '투명 페트병은 비닐 함으로, 비닐봉지는 일반쓰레기 함으로, 칫솔은 투명 페트 함으로 갔다. 선별장 직원이 손으로 다시 골라낸다.');
    assert.deepEqual(s2.contam, ["우리가 넣은 데이터에 칫솔 사진이 '투명 페트'로 섞여 들어갔다. 그래서 칫솔이 투명 페트 함으로 갔다.", "우리가 넣은 데이터에 고양이 사진이 '비닐'로 섞여 들어갔다. 그래서 비닐봉지가 일반쓰레기 함으로 갔다."]);
    assert.deepEqual(s2.also, ['엉뚱한 사진이 섞이면서 투명 페트병도 비닐 함으로 갔다.']);
    // 잘못 간 물건 이름이 머리 문구에 다 있다(모든 실패 장면)
    for (const sc of scenes.filter((x) => x.outcome !== 'pass')) for (const cap of sc.wrong) assert.ok(sc.lead.includes(cap.split(' → ')[0]) || /건전지/.test(cap), sc.scene + ' lead covers ' + cap + ': ' + sc.lead);
    const s1 = scenes.find((x) => x.scene === 'S1');
    assert.equal(s1.outcome, 'danger');
    assert.match(s1.lead, /비상 정지 버튼을 눌렀다\. 그 밖에 음료 캔은 비닐 함으로 갔다\.$/);
    console.log('  m2 results:', scenes.map((x) => x.scene + ':' + x.outcome).join(' '), '\n   S2 lead:', s2.lead);
    await page.locator('#screen-prep').waitFor({ state: 'visible', timeout: 10000 });
    assert.deepEqual(errors, []);
    console.log('ok P practice → m1 → chapter end → city → m2 results (1280×800)');
  } finally { await browser.close(); }
}

/* ---------- E. 3·4 임무 뒤 활동: 빈 대화 화면 없음(이미 있는 장면 그림) + 임무 완료 화면 뒤 그림 ---------- */
if (want('E')) {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 } });
  try {
    const rec = { cleared: true, passed: true, firstTry: true, supplements: 0, firstFails: [], fixedLabels: 0 };
    const outroBg = async (re, label) => {
      await page.locator('#screen-outro').waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForFunction(() => { const i = document.querySelector('#screen-outro .outro-bg'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
      const o = await page.evaluate(() => { const i = document.querySelector('#screen-outro .outro-bg'); return { src: i.getAttribute('src'), filter: getComputedStyle(i).filter }; });
      assert.match(o.src, re, label); assert.equal(o.filter, 'brightness(0.35)', label);
      await noOverflow(page, label);
    };
    // 3 임무: 마무리 대화 2줄 = 정체 공개 그림, 완료 화면 뒤에도
    await page.evaluate((r) => { DR.App.records.m3 = r; DR.App.resumeEnding({ mission: 'm3', step: 4, city: null, peer: 'none', compare: null }); }, rec);
    const o3 = await readDialogue(page);
    assert.deepEqual(o3.map((l) => l.text), await page.evaluate(() => DR.Missions.m3.story.outro.map((l) => l.text)));
    for (const l of o3) assert.ok(l.hasBg && /assets\/story\/reveal-senior\.webp$/.test(l.bg), 'm3 outro line has the reveal scene ' + JSON.stringify(l));
    await outroBg(/reveal-senior\.webp$/, 'm3 outro screen');
    assert.equal(await page.locator('#screen-outro h2').innerText(), '도시 한 구간이 다시 이어졌다');
    // 3 임무 도입에는 그림을 깔지 않는다(정체 공개 장면을 미리 보여 주지 않게)
    await page.evaluate(() => DR.App.startMission('m3'));
    const i3 = await readDialogue(page);
    assert.ok(i3.length >= 8 && i3.every((l) => !l.hasBg), 'm3 intro stays picture-less');
    // 4 임무: 재연결 뒤 의뢰인·동기 줄부터 '해커의 이후' 그림, 마무리 대화·완료 화면도
    await page.evaluate((r) => { DR.App.records.m4 = r; DR.App.resumeEnding({ mission: 'm4', step: 4, city: null, peer: 'none', compare: null }); }, rec);
    const a4 = await readDialogue(page);
    assert.ok(a4.some((l) => l.text === '…알아.') && a4.some((l) => /✕가 하나도 안 찍혔어요/.test(l.text)), JSON.stringify(a4.map((l) => l.text)));
    for (const l of a4) assert.ok(l.hasBg && /assets\/story\/senior-after\.webp$/.test(l.bg), 'm4 closing line has the after scene ' + JSON.stringify(l));
    await outroBg(/senior-after\.webp$/, 'm4 outro screen');
    assert.equal(await page.locator('#screen-outro h2').innerText(), '도시가 다시 이어졌다');
    assert.equal(await page.locator('#outro-questions li').count(), 2);
    await page.screenshot({ path: shotPath('playtest2-m4-outro-1280') });
    assert.deepEqual(errors, []);
    console.log('ok E m3·m4 closing dialogues keep a scene picture, outro screens get the darkened backdrop, m3 intro stays picture-less');
  } finally { await browser.close(); }
}

/* ---------- N. 좁은 화면(390×844): 주 버튼이 첫 화면에, 가로 넘침 없음 ---------- */
if (want('N')) {
  const viewport = { width: 390, height: 844 };
  {
    const { browser, page, errors } = await openGame({ viewport });
    try {
      await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [SAVE, { ...BASE, records: cleared('tutorial') }]);
      await page.reload();
      await noOverflow(page, 'title 390');
      await page.locator('#btn-practice').click();
      await page.locator('#screen-briefing').waitFor({ state: 'visible' });
      await noOverflow(page, 'practice briefing 390');
      await toRun(page);
      await fill(page, { dog: 5, cat: 5 });
      await page.locator('#exam-drill').waitFor();
      const v = await mainButton(page, '#btn-submit', 'exam inspect 390');
      await noOverflow(page, 'exam inspect 390');
      console.log('  exam inspect @390×844: 이 자료로 시험하기 y', v.top, '~', v.bottom, '/ 화면', v.vh, '(내용 높이', v.scrollH + ')');
      await page.screenshot({ path: shotPath('playtest2-exam-inspect-390') });
      // 끝까지 내려도 버튼 자리는 같다(붙어 있을 때와 같은 자리)
      const end = await page.evaluate(() => { const s = document.getElementById('screen-inspect'); s.scrollTop = s.scrollHeight; const r = document.getElementById('btn-submit').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
      assert.ok(Math.abs(end.top - v.top) <= 1 && end.bottom <= end.vh, 'same button place at the end of the page ' + JSON.stringify({ v, end }));
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
  for (const [id, counts, n] of [['m1', { ...M1_ALL, umbrella_folded: 1 }, 3], ['m2', { ...M2_ALL, f_toothbrush: 1, f_cat: 1 }, 4]]) {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=' + id });
    try {
      await toRun(page);
      await fill(page, counts);
      await noOverflow(page, id + ' inspect 390');
      await page.locator('#btn-submit').click();
      await page.locator('#btn-confirm').click();
      await page.locator('#screen-conveyor').waitFor({ state: 'visible' });
      const bins = await page.evaluate(() => { const b = [...document.querySelectorAll('.cv-bin')].map((e) => e.getBoundingClientRect()), belt = document.querySelector('.cv-belt').getBoundingClientRect(); return { n: b.length, rows: new Set(b.map((x) => Math.round(x.top))).size, first: b[0].left, right: Math.max(...b.map((x) => x.right)), belt: [belt.left, belt.right] }; });
      assert.ok(Math.abs(bins.first - bins.belt[0]) < 2 && Math.abs(bins.right - bins.belt[1]) < 2 && bins.rows === (id === 'm1' ? 1 : 2), id + ' bins 390 ' + JSON.stringify(bins));
      await noOverflow(page, id + ' conveyor 390');
      await page.locator('#btn-cv-skip').click();
      await page.locator('#btn-cv-next').click();
      for (let i = 0; i < n; i++) {
        await page.locator('#screen-result .result-scene').waitFor({ state: 'visible' });
        const v = await mainButton(page, '#btn-next', id + ' result ' + (i + 1) + ' 390');
        await noOverflow(page, id + ' result ' + (i + 1) + ' 390');
        const failed = await page.evaluate(() => document.querySelector('#screen-result .result-scene').dataset.outcome !== 'pass');
        if (failed) { console.log('  ' + id + ' result ' + (i + 1) + '/' + n + ' @390×844: 다음 y', v.top, '~', v.bottom, '/ 화면', v.vh, '(내용 높이', v.scrollH + ')'); await page.screenshot({ path: shotPath('playtest2-' + id + '-result-390') }); }
        await page.locator('#btn-next').click();
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
  console.log('ok N 390×844 main buttons on the first screen, no horizontal overflow');
}
