// 1·2 임무 도입·마무리 대화의 장면 그림(story.introBg·outroBg, 2026-11-11) + 학생 초상
//   ① 그림이 대화 내내 깔려 있다(줄을 넘기는 동안 그림 요소·'on'·has-bg가 한 번도 안 빠짐 = 깜빡임 없음)
//   ② 그림 속 핵심 요소(m1 학생 얼굴·접힌 분홍 우산·모니터 / m2 건전지·수거봇)가 대화창·건너뛰기 버튼에 가리지 않는다
//      — 그림 안 비율 좌표(원본에서 잰 값)를 object-fit: cover 계산으로 화면 좌표로 바꿔 줄마다 겹침을 잰다
//   ③ 1 임무 도입: 학생 초상 = 다른 인물과 같은 크기·자리, 첫 줄 걱정 칸
//   ④ 줄에 bg가 따로 있으면 그 줄만 그 그림 / 그림 파일이 없으면 그림 없는 대화 배치(깨진 그림 표시 없음)
//   실행: node tests/story-bg-browser.mjs [m1|m2|extra]  (없으면 전부)
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

// 그림 안 상자(0~1). 원본 1536×1024에서 잰 화소 → x/1536, (y − top)/864 (top = tools/story-art.mjs SCENES: m1 40, m2 56)
const box = (top, x0, y0, x1, y1) => ({ x0: x0 / 1536, y0: (y0 - top) / 864, x1: x1 / 1536, y1: (y1 - top) / 864 });
const KEYS = {
  m1: { face: box(40, 1112, 140, 1362, 410), umbrella: box(40, 595, 448, 928, 512), monitor: box(40, 560, 135, 1047, 405) },
  m2: { battery: box(56, 483, 372, 545, 428), robotHead: box(56, 1215, 300, 1470, 520), robot: box(56, 1118, 275, 1512, 722) }
};
const BG = { m1: /assets\/story\/m1-lostfound\.webp$/, m2: /assets\/story\/m2-sorting\.webp$/ };
// 넓은 화면(대화창이 왼쪽): 핵심 요소 모두 화면 안 + 안 가림. 좁은 화면(390, 그림의 오른쪽 26%만 보임): 오른쪽 인물만 — 나머지는 화면 밖(재서 적어 둠)
//   2026-11-11: 좁은 세로 화면은 그림을 위쪽에 통째로 보여 준다 → 좁은 화면에서도 핵심 요소가 모두 화면 안
const MUST = { wide: { m1: ['face', 'umbrella', 'monitor'], m2: ['battery', 'robotHead'] }, narrow: { m1: ['face', 'umbrella', 'monitor'], m2: ['battery', 'robotHead'] } };
// 넓은 화면의 수거봇 전체: 1148×977(가로가 좁은 편)에서는 건전지(그림 31%)와 수거봇 등 바구니 끝(98%)이 한 화면에 다 안 들어간다
//   → 건전지·수거봇 머리는 온전히, 바구니 오른쪽 끝만 조금 화면 밖(전체의 90% 이상 보임). 가리는 것은 없어야 한다
const MOSTLY = { wide: { m2: { robot: 0.9 } }, narrow: { m2: { robot: 0.99 } } };
const VIEWPORTS = [{ width: 1148, height: 977 }, { width: 1280, height: 800 }, { width: 390, height: 844 }];
const only = process.argv[2];

// 지금 줄에서: 그림 상태 + 핵심 상자의 화면 좌표·보이는 비율·대화창/건너뛰기와 겹친 비율 + 초상 자리
const measure = (page, keys) => page.evaluate((keys) => {
  const scr = document.getElementById('screen-story'), img = scr.querySelector('.story-bg');
  const dlg = scr.querySelector('.dialog').getBoundingClientRect(), skip = scr.querySelector('#btn-skip').getBoundingClientRect();
  const out = { text: scr.querySelector('.dialog-text').textContent, hasBg: scr.classList.contains('has-bg'), img: !!img, keys: {} };
  const pf = scr.querySelector('.dialog .portrait'), pr = pf.getBoundingClientRect(), pi = pf.querySelector('img');
  out.portrait = { who: pf.dataset.character || 'canvas', dx: Math.round(pr.left - dlg.left), dy: Math.round(pr.top - dlg.top), w: Math.round(pr.width), h: Math.round(pr.height),
    imgW: pi ? Math.round(pi.getBoundingClientRect().width) : 0, imgH: pi ? Math.round(pi.getBoundingClientRect().height) : 0, shift: pi ? pi.style.transform : '', ok: pi ? pi.complete && pi.naturalWidth === 1024 : false };
  out.dialog = { x: Math.round(dlg.left), y: Math.round(dlg.top), w: Math.round(dlg.width), h: Math.round(dlg.height) };
  out.skip = { x: Math.round(skip.left), y: Math.round(skip.top), w: Math.round(skip.width), h: Math.round(skip.height) };
  if (!img) return out;
  const r = img.getBoundingClientRect(), cs = getComputedStyle(img);
  out.on = img.classList.contains('on'); out.opacity = Number(cs.opacity); out.src = img.getAttribute('src'); out.natural = img.naturalWidth;
  const pos = cs.objectPosition.split(' ').map((v) => parseFloat(v) / 100);
  const scale = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight), dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const ox = r.left + (r.width - dw) * pos[0], oy = r.top + (r.height - dh) * pos[1];
  const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const rect = (d) => ({ x0: d.left, y0: d.top, x1: d.right, y1: d.bottom });
  for (const k of Object.keys(keys)) {
    const b = keys[k], s = { x0: ox + b.x0 * dw, y0: oy + b.y0 * dh, x1: ox + b.x1 * dw, y1: oy + b.y1 * dh }, area = (s.x1 - s.x0) * (s.y1 - s.y0);
    out.keys[k] = { x0: Math.round(s.x0), y0: Math.round(s.y0), x1: Math.round(s.x1), y1: Math.round(s.y1),
      seen: +(inter(s, { x0: 0, y0: 0, x1: innerWidth, y1: innerHeight }) / area).toFixed(3), dialog: +(inter(s, rect(dlg)) / area).toFixed(3), skip: +(inter(s, rect(skip)) / area).toFixed(3) };
  }
  return out;
}, keys);

// 그림이 다 뜬 뒤부터: 그림 요소가 빠지거나 'on'·has-bg가 빠지면 센다(대화가 끝나 화면을 떠날 때는 세지 않게 끝 줄 전에 읽는다)
const watch = (page) => page.evaluate(() => {
  const scr = document.getElementById('screen-story'), img = scr.querySelector('.story-bg');
  const w = window.__bgWatch = { img, drops: 0, srcs: 0 };
  w.ob = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'childList') { for (const n of m.removedNodes) if (n === img) w.drops++; continue; }
      if (m.target === img && m.attributeName === 'class' && !img.classList.contains('on')) w.drops++;
      if (m.target === img && m.attributeName === 'src') w.srcs++;
      if (m.target === scr && !scr.classList.contains('has-bg')) w.drops++;
    }
  });
  w.ob.observe(scr, { attributes: true, attributeFilter: ['class', 'src'], subtree: true, childList: true });
});
const watched = (page) => page.evaluate(() => { const w = window.__bgWatch; w.ob.takeRecords(); return { drops: w.drops, srcs: w.srcs, same: document.querySelector('#screen-story .story-bg') === w.img }; });

// 대화 한 편을 끝 줄까지 넘기며 줄마다 잰다(끝 줄에서 멈춤)
async function walk(page, id, n, shot) {
  await page.locator('#screen-story.has-bg .story-bg.on').waitFor({ state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#screen-story .story-bg')).opacity) === 1, null, { timeout: 5000 });
  await watch(page);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const m = await measure(page, KEYS[id]);
    assert.ok(m.hasBg && m.img && m.on && m.opacity === 1, id + ' line ' + (i + 1) + ' keeps the backdrop: ' + JSON.stringify({ hasBg: m.hasBg, on: m.on, opacity: m.opacity }));
    assert.match(m.src, BG[id]); assert.equal(m.natural, 1600);
    rows.push(m);
    if (shot && shot.at === i) await page.screenshot({ path: shotPath(shot.name) });
    if (i < n - 1) await page.locator('#screen-story .dialog').click();
  }
  const w = await watched(page);
  assert.deepEqual(w, { drops: 0, srcs: 0, same: true }, id + ': backdrop never dropped or reloaded between lines');
  return rows;
}
// 줄마다 잰 값에서 요소별 최악(가장 많이 가린 줄)
function worst(rows) {
  const out = {};
  for (const k of Object.keys(rows[0].keys)) {
    out[k] = { seen: Math.min(...rows.map((r) => r.keys[k].seen)), dialog: Math.max(...rows.map((r) => r.keys[k].dialog)), skip: Math.max(...rows.map((r) => r.keys[k].skip)), at: rows[0].keys[k] };
  }
  return out;
}
function checkKeys(id, w, kind, where) {
  const wr = worst(kind);
  for (const k of MUST[w >= 900 ? 'wide' : 'narrow'][id]) {
    assert.ok(wr[k].seen >= 0.99, `${where} ${k} inside the screen: ${JSON.stringify(wr[k])}`);
    assert.equal(wr[k].dialog, 0, `${where} ${k} not under the dialog: ${JSON.stringify(wr[k])}`);
    assert.equal(wr[k].skip, 0, `${where} ${k} not under the skip button: ${JSON.stringify(wr[k])}`);
  }
  const mostly = MOSTLY[w >= 900 ? 'wide' : 'narrow'][id] || {};
  for (const k of Object.keys(mostly)) {
    assert.ok(wr[k].seen >= mostly[k], `${where} ${k} mostly inside the screen: ${JSON.stringify(wr[k])}`);
    assert.deepEqual([wr[k].dialog, wr[k].skip], [0, 0], `${where} ${k} not covered: ${JSON.stringify(wr[k])}`);
  }
  return wr;
}
const longest = (lines) => lines.reduce((b, l, i) => (l.text.length > lines[b].text.length ? i : b), 0);

for (const viewport of VIEWPORTS) {
  const w = viewport.width;
  for (const id of ['m1', 'm2']) {
    if (only && only !== id) continue;
    const { browser, page, errors } = await openGame({ viewport, query: '?start=' + id });
    try {
      const story = await page.evaluate((id) => { const s = DR.Missions[id].story; return { intro: s.intro, outro: s.outro, introBg: s.introBg, outroBg: s.outroBg }; }, id);
      // 도입 대화: 첫 줄 스크린샷 + 가장 긴 줄(대화창이 가장 높을 때) 스크린샷
      const intro = await walk(page, id, story.intro.length, { at: 0, name: `story-bg-${id}-intro-${w}` });
      assert.deepEqual(intro.map((r) => r.text), story.intro.map((l) => l.text));
      const iw = checkKeys(id, w, intro, `${id} intro ${w}`);
      if (id === 'm1') {
        // 학생 초상: 첫 줄 = student 시트의 걱정 칸, 다른 인물과 같은 틀 크기·대화창 안 같은 자리·같은 그림 크기
        assert.deepEqual([intro[0].portrait.who, intro[0].portrait.shift, intro[0].portrait.ok], ['student', 'translateX(-25%)', true]);
        const frame = (p) => [p.dx, p.dy, p.w, p.h, p.imgW, p.imgH];
        for (const r of intro) assert.deepEqual(frame(r.portrait), frame(intro[0].portrait), 'same portrait frame as the student: ' + r.portrait.who);
        assert.deepEqual([intro[0].portrait.w, intro[0].portrait.h, intro[0].portrait.imgW], [72, 72, 288]);
        assert.ok(new Set(intro.map((r) => r.portrait.who)).size >= 4, 'compared against several characters');
      }
      // 끝 줄을 넘기면 브리핑(그림 없음)
      await page.locator('#screen-story .dialog').click();
      await page.locator('#screen-briefing').waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.locator('#screen-story.has-bg').count(), 0);
      // 가장 긴 줄: 대화를 다시 열어 그 줄까지 넘긴 뒤 스크린샷
      const li = longest(story.intro);
      await page.evaluate((id) => DR.App.startMission(id), id);
      await page.locator('#screen-story.has-bg .story-bg.on').waitFor({ state: 'attached', timeout: 15000 });
      for (let i = 0; i < li; i++) await page.locator('#screen-story .dialog').click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: shotPath(`story-bg-${id}-intro-long-${w}`) });
      // 마무리 대화: 임무 뒤 활동의 마지막 단계로 바로(app.js runEnding → toOutro — 실제 길)
      await page.evaluate((id) => {
        DR.App.records[id] = { cleared: true, passed: true, firstTry: true, supplements: 0, firstFails: [], fixedLabels: 0 };
        DR.App.resumeEnding({ mission: id, step: 4, city: null, peer: 'none', compare: null });
      }, id);
      let outro, ow;
      if (story.outroBg) {
        outro = await walk(page, id, story.outro.length, { at: 0, name: `story-bg-${id}-outro-${w}` });
        assert.deepEqual(outro.map((r) => r.text), story.outro.map((l) => l.text));
        ow = checkKeys(id, w, outro, `${id} outro ${w}`);
      } else {
        // 마무리 배경이 없는 임무(1 임무): 줄마다 그림 없이 나온다
        outro = [];
        await page.locator('#screen-story .dialog').waitFor({ state: 'visible', timeout: 15000 });
        for (let i = 0; i < story.outro.length; i++) {
          const m = await measure(page, {});
          assert.equal(m.hasBg, false, id + ' outro line ' + (i + 1) + ' has no backdrop');
          outro.push(m);
          if (i === 0) await page.screenshot({ path: shotPath(`story-bg-${id}-outro-${w}`) });
          if (i < story.outro.length - 1) await page.locator('#screen-story .dialog').click();
        }
        assert.deepEqual(outro.map((r) => r.text), story.outro.map((l) => l.text));
        ow = Object.fromEntries(Object.keys(iw).map((k) => [k, { seen: '-', dialog: '-', skip: '-' }]));
      }
      await page.locator('#screen-story .dialog').click();
      await page.locator('#screen-outro').waitFor({ state: 'visible', timeout: 10000 });
      assert.equal(await page.locator('#screen-story.has-bg').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS ${id} ${w}×${viewport.height} backdrop stays through intro(${intro.length})·outro(${outro.length})`);
      console.log('  dialog(first/longest h)', intro[0].dialog, Math.max(...intro.map((r) => r.dialog.h)), 'skip', intro[0].skip);
      for (const k of Object.keys(iw)) console.log(`  ${k}: box ${JSON.stringify(iw[k].at)} · intro worst seen ${iw[k].seen} dialog ${iw[k].dialog} skip ${iw[k].skip} · outro worst seen ${ow[k].seen} dialog ${ow[k].dialog} skip ${ow[k].skip}`);
    } finally { await browser.close(); }
  }
}

if (!only || only === 'extra') {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    // ④-1 줄에 bg가 따로 있으면 그 줄만 그 그림, 다음 줄은 다시 기본 배경
    await page.locator('#screen-story.has-bg .story-bg.on').waitFor({ state: 'attached', timeout: 15000 });
    await page.evaluate(() => { DR.Missions.m1.story.intro[1].bg = 'assets/story/reveal-senior.webp'; DR.App.startMission('m1'); });
    const src = () => page.locator('#screen-story .story-bg').getAttribute('src');
    await page.locator('#screen-story.has-bg .story-bg.on').waitFor({ state: 'attached', timeout: 15000 });
    assert.match(await src(), BG.m1);
    await page.locator('#screen-story .dialog').click();
    assert.match(await src(), /reveal-senior\.webp$/, "the line's own bg wins");
    await page.locator('#screen-story .story-bg.on').waitFor({ state: 'attached', timeout: 15000 });
    await page.locator('#screen-story .dialog').click();
    assert.match(await src(), BG.m1, 'back to the default backdrop');
    await page.locator('#screen-story .story-bg.on').waitFor({ state: 'attached', timeout: 15000 });
    await page.evaluate(() => { delete DR.Missions.m1.story.intro[1].bg; });
    // 기본 배경이 없는 대화(3 임무 도입)는 그림 요소도 has-bg도 없다 = 전과 같음
    await page.evaluate(() => DR.App.startMission('m3'));
    await page.locator('#screen-story .dialog').waitFor();
    assert.equal(await page.locator('#screen-story.has-bg').count(), 0);
    assert.equal(await page.locator('#screen-story .story-bg').count(), 0);
    const plain = await page.evaluate(() => { const d = document.querySelector('#screen-story .dialog').getBoundingClientRect(); return [Math.round(d.left), Math.round(d.width)]; });
    assert.deepEqual(errors, []);
    // ④-2 그림 파일이 없으면: 그림 없는 대화와 같은 배치, 그림은 안 보임(깨진 그림 표시 없음), 대화는 그대로 넘어감
    await page.evaluate(() => { DR.Missions.m1.story.introBg = 'assets/story/_no-such-file.webp'; DR.App.startMission('m1'); });
    await page.waitForFunction(() => !document.getElementById('screen-story').classList.contains('has-bg'), null, { timeout: 10000 });
    const miss = await page.evaluate(() => { const i = document.querySelector('#screen-story .story-bg'), d = document.querySelector('#screen-story .dialog').getBoundingClientRect(); return { on: i.classList.contains('on'), opacity: Number(getComputedStyle(i).opacity), natural: i.naturalWidth, dialog: [Math.round(d.left), Math.round(d.width)] }; });
    assert.deepEqual([miss.on, miss.opacity, miss.natural], [false, 0, 0], 'a missing picture stays invisible');
    assert.deepEqual(miss.dialog, plain, 'dialog sits where a picture-less dialog sits');
    await page.screenshot({ path: shotPath('story-bg-missing-1280') });
    for (let i = 0; i < 3; i++) await page.locator('#screen-story .dialog').click();
    assert.equal(await page.locator('#screen-story.has-bg').count(), 0, 'stays picture-less on the following lines');
    assert.equal(await page.locator('#screen-story .dialog-text').innerText(), await page.evaluate(() => DR.Missions.m1.story.intro[3].text));
    assert.deepEqual(errors.filter((e) => !/_no-such-file\.webp/.test(e)), [], 'only the missing picture is reported');
    assert.equal(errors.length, 1);
    console.log('PASS per-line bg wins · no default backdrop on m3 intro · missing picture = picture-less dialog');
  } finally { await browser.close(); }
}
