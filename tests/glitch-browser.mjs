// "지지직" 연출(요청서 docs/feedback/2026-11-08-glitch-effect.md, 2026-11-09):
// A) 2 임무 첫 판을 시계로 끝까지 굴린다(지지직 카드는 레인 키·Space로 진짜 잡는다) — 효과가 켜진 순간은 늘 잡기 구간 1.0초 전보다 멀고,
//    잡기 구간 안에서는 3D·화면 카드 모두 원래 그림. 가짜·"?"·드문·개인정보 카드엔 한 번도 안 걸림. 1초에 번쩍 3번 이하. 첫 안내 한 줄 한 번.
//    끝나면 검수 화면 — 지지직 흔적 없음, 가방 카드에 glitch 필드 없음. 스크린샷 1280·390(멀리 지지직 카드).
// B) 움직임 줄이기 — 효과 0, 멀 때 테두리만 흐리게, 안내 없음.
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const HINT = '데이터 세계가 흔들려. 가까이 가면 또렷해져!';

async function toRun(page) {
  await page.locator('#btn-skip').click();
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
}

// 한 판 끝까지: 매 칸 지지직 상태를 기록하고 위반을 모은다
// stopForShot이면 멀리 있는 지지직 카드가 효과를 보이는 첫 순간에 멈춘다(스크린샷) — 기록은 window.__gl에 이어 쌓인다
const playThrough = (page, stopForShot = false) => page.evaluate(([HINT, stopForShot]) => {
  const m = DR.Missions[DR.App.state.mission], items = DR.Run.course().items, cfg = DR.config;
  const glitchUids = new Set(items.filter((i) => i.glitch).map((i) => i.uid));
  const out = window.__gl = window.__gl || { glitch: [...glitchUids], bad: [], onFrames: 0, softFrames: 0, onsets: {}, hints: 0, caught: [], clearedBeforeWindow: {}, domGlitchFrames: 0, maxOnsetsPerSec: 0, prev: {}, lastHint: '' };
  const key = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code }));
  const prev = out.prev;
  for (let i = 0; i < 30000 && DR.Run.peek().running; i++) {
    const p = DR.Run.peek(), st = DR.Run.glitchState();
    if (stopForShot) {
      const clear = DR.Glitch.clearDist(p.speed, cfg);
      // 3D로 그려지는 가장 가까운 거리(34m 밖)에서 효과가 켜졌고, 화면 카드(DOM)에 가리지 않은 카드
      const covered = (pt) => [...document.querySelectorAll('.run-card[data-uid]')].some((el) => { if (el.hidden) return false; const r = el.getBoundingClientRect(), b = document.getElementById('run-stage').getBoundingClientRect(); return pt.x + b.left > r.left - 40 && pt.x + b.left < r.right + 40 && pt.y + b.top > r.top - 60 && pt.y + b.top < r.bottom + 60; });
      const g = st.find((s) => { const d = items.find((x) => x.uid === s.uid).z - p.runnerZ, pt = DR.Run.screenOf(s.uid); return s.frame >= 0 && d > Math.max(clear + 1, 34.5) && d < 46 && pt && pt.visible && !covered(pt); });
      if (g) { const it = items.find((x) => x.uid === g.uid), pt = DR.Run.screenOf(g.uid), b = document.getElementById('run-stage').getBoundingClientRect(); return { shot: { uid: g.uid, effect: it.glitch, d: +(it.z - p.runnerZ).toFixed(1), clear: +clear.toFixed(1), x: pt.x + b.left, y: pt.y + b.top } }; }
    }
    const reach = Math.max(p.speed, cfg.baseSpeed);
    for (const g of st) {
      const it = items.find((x) => x.uid === g.uid);
      const d = it.z - p.runnerZ, toWindow = (d - reach * cfg.catchLead) / p.speed;
      const phase = DR.Catch.phase(it, p.runnerZ, p.speed, cfg);
      if (!glitchUids.has(g.uid) && (g.swapped || g.frame >= 0 || g.soft)) out.bad.push('not a glitch card but changed: ' + g.uid + ' ' + (it.key || it.fakeId || it.ambiguousId));
      if (g.frame >= 0) {
        out.onFrames++;
        if (toWindow < 1.0 - 1e-6) out.bad.push(`${g.uid} glitching ${toWindow.toFixed(3)}s before the catch window`);
        if (!(g.uid in prev) || prev[g.uid] < 0) (out.onsets[g.uid] = out.onsets[g.uid] || []).push(p.t);
      }
      if (g.soft) out.softFrames++;
      if (phase === 'active' && (g.swapped || g.frame >= 0)) out.bad.push(g.uid + ' not clear inside the catch window');
      if (glitchUids.has(g.uid) && phase !== 'far' && !(g.uid in out.clearedBeforeWindow)) out.clearedBeforeWindow[g.uid] = !g.swapped;
      prev[g.uid] = g.frame;
    }
    // 화면 카드(34m 안)
    document.querySelectorAll('.run-card[data-uid]').forEach((el) => {
      if (el.hidden) return;
      const uid = el.dataset.uid, it = items.find((x) => x.uid === uid);
      const on = el.classList.contains('glitching');
      if (on) out.domGlitchFrames++;
      if ((on || el.classList.contains('glitch-soft')) && !glitchUids.has(uid)) out.bad.push('dom glitch on non-glitch card ' + uid);
      if (on && DR.Catch.phase(it, p.runnerZ, p.speed, cfg) === 'active') out.bad.push('dom glitch inside catch window ' + uid);
      if (on && it.glitch === 'glyph' && el.querySelector('.run-card-label').textContent === DR.Cards.cardLabel(m, it)) out.bad.push('glyph frame shows the plain label ' + uid);
      if (!on && el.querySelector('.run-card-label').textContent !== DR.Cards.cardLabel(m, it)) out.bad.push('label not restored ' + uid);
    });
    const h = document.getElementById('run-hint');
    const ht = h && !h.hidden ? h.textContent : '';
    if (ht === HINT && out.lastHint !== HINT) out.hints++;
    out.lastHint = ht;
    // 지지직 카드는 진짜로 잡는다(레인 키 + Space)
    const t = items.find((it) => it.glitch && !DR.Run.isTaken(it.uid) && it.z > p.runnerZ - 0.5 && it.z - p.runnerZ < p.speed * 3);
    if (t && p.bagCount < p.bagMax) {
      if (p.lane !== t.lane) key(p.lane < t.lane ? 'ArrowRight' : 'ArrowLeft');
      else if (DR.Catch.phase(t, p.runnerZ, p.speed, cfg) === 'active') key('Space');
    }
    DR.Run.step(0.02);
  }
  for (const [uid, ts] of Object.entries(out.onsets)) for (const t of ts) out.maxOnsetsPerSec = Math.max(out.maxOnsetsPerSec, ts.filter((o) => o >= t && o < t + 1 + 1e-9).length);
  out.caught = [...glitchUids].filter((u) => DR.Run.isTaken(u));
  out.running = DR.Run.peek().running;
  return out;
}, [HINT, stopForShot]);


// A) 1280 한 판 + 스크린샷, 390 스크린샷
for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const { browser, page, errors } = await openGame({ viewport, query: '?start=m2' });
  try {
    await toRun(page);
    const marks = await page.evaluate(() => DR.Run.course().items.filter((i) => i.glitch).map((i) => i.uid + ':' + i.glitch));
    assert.ok(marks.length >= 3, 'm2 has glitch cards: ' + marks);
    const { shot } = await playThrough(page, true);
    assert.ok(shot, 'a far glitch card in a burst');
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: shotPath('glitch-m2-' + viewport.width) });
    await page.screenshot({ path: shotPath('glitch-m2-' + viewport.width + '-zoom'), clip: { x: Math.max(0, shot.x - 70), y: Math.max(0, shot.y - 80), width: 140, height: 160 } });
    console.log('shot', viewport.width, JSON.stringify(shot));
    if (viewport.width === 1280) {
      const r = await playThrough(page);
      console.log('m2 run:', JSON.stringify({ glitch: r.glitch.length, caught: r.caught.length, onFrames: r.onFrames, domGlitchFrames: r.domGlitchFrames, maxOnsetsPerSec: r.maxOnsetsPerSec, hints: r.hints, clearedBeforeWindow: r.clearedBeforeWindow }));
      assert.deepEqual(r.bad.slice(0, 5), [], 'no violations');
      assert.ok(r.onFrames > 20, 'effects did show while far');
      assert.ok(r.maxOnsetsPerSec <= 3, 'at most 3 flashes per second: ' + r.maxOnsetsPerSec);
      assert.equal(r.hints, 1, 'first-appearance hint once');
      assert.ok(Object.values(r.clearedBeforeWindow).length >= 3 && Object.values(r.clearedBeforeWindow).every(Boolean), 'every glitch card reached its window clear');
      assert.ok(r.caught.length >= 2, 'caught glitch cards for real: ' + r.caught.length);
      // 검수 화면: 지지직 흔적 없음, 가방 카드에 표시 필드 없음
      await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 15000 });
      assert.equal(await page.locator('.glitching, .glitch-soft').count(), 0, 'no glitch on inspect');
      const bag = await page.evaluate(() => DR.App.state.bag);
      assert.ok(bag.length > 0 && bag.every((c) => !('glitch' in c)), 'bag cards carry no glitch field');
      assert.ok(r.caught.some((u) => bag.some((c) => c.id === u && c.key)), 'caught glitch cards are ordinary cards in the bag (some may be lost to walls)');
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

// B) 움직임 줄이기: 효과 없음, 멀 때 테두리만 흐리게, 안내 없음
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await toRun(page);
    const r = await playThrough(page);
    console.log('reduced:', JSON.stringify({ onFrames: r.onFrames, softFrames: r.softFrames, domGlitchFrames: r.domGlitchFrames, hints: r.hints }));
    assert.deepEqual(r.bad.slice(0, 5), []);
    assert.equal(r.onFrames, 0, 'no glitch frames');
    assert.equal(r.domGlitchFrames, 0, 'no dom glitch');
    assert.ok(r.softFrames > 20, 'soft border while far');
    assert.equal(r.hints, 0, 'no shaking hint when nothing shakes');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
console.log('PASS glitch');
