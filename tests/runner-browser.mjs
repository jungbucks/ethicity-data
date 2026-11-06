// 2026-11-05 지시서: 노이즈 벽 페널티·벽 간격·연습 카드·실기 미션 안내·달리기 끝맺음·가방 찬 뒤 가속.
// debugFill 없이 진짜 키로 벽을 피하거나 지나가는 판정, 진짜 시계로 도는 끝맺음 연출을 본다.
import assert from 'node:assert/strict';
import { openGame, passCity, shotPath } from './browser.mjs';

const key = (code) => `window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}', key: '${code === 'Space' ? ' ' : code}' }));`;
const waitRun = (page) => page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
// 시계를 멈추고 조건이 맞을 때까지 step
const stepUntil = (page, src, max = 12000) => page.evaluate(([src, max]) => {
  const f = new Function('p', 'items', 'cfg', src);
  for (let i = 0; i < max; i++) { const p = DR.Run.peek(); if (f(p, DR.App.course.items, DR.config)) return true; DR.Run.step(0.02); }
  return false;
}, [src, max]);
const startM = async (page) => {
  await page.locator('#btn-skip').click();
  await page.locator('#btn-run').click();
  await waitRun(page);
  await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
};
const toLane = (page, lane) => page.evaluate(([lane, l, r]) => {
  for (let n = 0; n < 3 && DR.Run.peek().lane !== lane; n++) new Function(DR.Run.peek().lane < lane ? r : l)();
}, [lane, key('ArrowLeft'), key('ArrowRight')]);
const rareOf = (stage) => `(() => { const m = DR.App.mission(), c = DR.App.course, S = DR.Stream, cfg = DR.config;
  return c.items.filter((i) => i.kind === 'card' && !i.fakeId && (i.ambiguousId || m.cardTypes[i.key]?.rare)).filter((i) => {
    const sec = S.rareGapSec(cfg, i.z / c.length), v = S.speedAt(cfg, i.z / c.length);
    const w = c.items.filter((o) => o.kind === 'wall' && o.lane === i.lane && o.z < i.z).pop();
    if (!w) return false;
    i.wall = w; i.neighbour = i.lane === 1 ? 0 : 1;
    const others = c.items.filter((o) => o.lane === i.neighbour && o.kind !== 'card' && Math.abs(o.z - w.z) < 8);
    return ${stage === 'early' ? 'S.canDodge(cfg, sec)' : '!S.canDodge(cfg, sec)'} && i.z > 80 && !others.length && !c.items.some((o) => o.kind === 'wall' && o.lane === i.lane && o.z > w.z && o.z < i.z);
  })[0]; })()`;

// 1) 벽: 부딪히면 최근 카드 1장을 잃는다 · 연출 · 무적 · 빈 가방은 감속만 · 검수 숫자
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await startM(page);
    // 빈 가방: 감속만
    const wall0 = await page.evaluate(() => DR.App.course.items.find((i) => i.kind === 'wall'));
    await stepUntil(page, `return p.runnerZ > ${wall0.z} - 10;`);
    await toLane(page, wall0.lane);
    await stepUntil(page, `return p.runnerZ > ${wall0.z} + 0.2;`);
    let p = await page.evaluate(() => DR.Run.peek());
    assert.ok(p.slowedUntil > p.t, 'slowed by the wall');
    assert.equal(p.lost, 0, 'empty bag loses nothing');
    assert.equal(await page.locator('.bag-minus').count(), 0);
    // 카드 2장(마지막 = 구역 카드) 담고 다음 벽에 부딪힘
    const r = await page.evaluate(() => {
      const items = DR.App.course.items, z = DR.Run.peek().runnerZ, wall = items.find((i) => i.kind === 'wall' && i.z > z + 20);
      const cards = items.filter((i) => i.kind === 'card' && i.z < wall.z - 4 && i.z > z).slice(0, 2);
      cards.forEach((c) => DR.Run.debugTake(c.uid));
      return { wall, last: cards[cards.length - 1].uid, zone: cards[cards.length - 1].zoneId, n: cards.length };
    });
    assert.equal(r.n, 2);
    const zoneText = () => page.locator(`.zone-cell[data-scene="${r.zone}"] .zone-count`).innerText();
    await page.evaluate(() => DR.Run.step(0.02));
    const before = await zoneText();
    await stepUntil(page, `return p.runnerZ > ${r.wall.z} - 8;`);
    await toLane(page, r.wall.lane);
    // 빨간 가방·"-1"은 진짜 시계 0.8초만 떠 있다 — 시계를 멈춘 테스트가 놓치지 않게 부딪힌 그 호출 안에서 읽는다
    const hit = await page.evaluate((wz) => {
      for (let i = 0; i < 2000; i++) {
        const q = DR.Run.peek();
        if (q.lost === 1 || q.runnerZ > wz + 1) break;
        DR.Run.step(0.02);
      }
      const bag = document.getElementById('hud-bag');
      return { p: DR.Run.peek(), count: bag.querySelector('b').textContent, cls: bag.className, minus: bag.querySelector('.bag-minus')?.textContent, notice: document.querySelector('.catch-notice').textContent };
    }, r.wall.z);
    p = hit.p;
    assert.equal(p.lost, 1, 'one card lost');
    assert.equal(p.bagCount, 1, 'bag down by one');
    assert.equal(hit.count, '1/30');
    assert.match(hit.cls, /\blose\b/);
    assert.equal(hit.minus, '-1');
    assert.equal(hit.notice, '노이즈! 카드 1장을 잃었어');
    await page.evaluate(() => DR.Run.step(0.2 / 4)); // 튀어 나가는 카드가 그려질 틈
    assert.equal(await page.locator('.lost-flight').count(), 1, 'card flies off');
    await page.evaluate(() => DR.Run.step(0.02));
    const after = await zoneText();
    assert.equal(parseInt(after.match(/\d+/)[0], 10), parseInt(before.match(/\d+/)[0], 10) - 1, 'zone count follows: ' + before + ' → ' + after);
    await page.screenshot({ path: shotPath('wall-lost-1280') });
    // 무적 안에서 또 부딪혀도 안 잃는다(벽을 바로 앞으로 옮겨 재현)
    const again = await page.evaluate(() => {
      const p = DR.Run.peek(), w = DR.App.course.items.find((i) => i.kind === 'wall' && i.z > p.runnerZ + 20);
      w.z = p.runnerZ + 1; w.lane = p.lane; DR.Run.debugTake(DR.App.course.items.find((i) => i.kind === 'card' && i.z > p.runnerZ + 30).uid);
      for (let i = 0; i < 20; i++) DR.Run.step(0.02);
      return DR.Run.peek();
    });
    assert.equal(again.lost, 1, 'no second loss inside invuln');
    assert.equal(again.bagCount, 2);
    // 검수: 잃은 카드는 가방에 없고 한 줄로 보인다
    await page.evaluate(() => DR.Run.finishNow());
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('#inspect-lost').innerText(), '노이즈로 잃은 카드 1장');
    assert.match(await page.locator('#screen-inspect h2').first().innerText(), /\(2\/30칸\)/);
    assert.equal(await page.evaluate(() => DR.App.state.bag.some((c) => c.id === 'x')), false);
    const lostUid = r.last;
    assert.equal(await page.evaluate((u) => DR.App.state.bag.some((c) => c.id === u), lostUid), false, 'lost card out of the bag');
    // 저장·이어하기: 같은 숫자, 옛 세이브(lost 없음)는 줄 없음
    await page.goto(page.url().split('?')[0]); await page.locator('#btn-continue').click();
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('#inspect-lost').innerText(), '노이즈로 잃은 카드 1장');
    await page.evaluate(() => { const k = 'ethicity.data.save', o = JSON.parse(localStorage.getItem(k)); delete o.lost; localStorage.setItem(k, JSON.stringify(o)); });
    await page.goto(page.url().split('?')[0]); await page.locator('#btn-continue').click();
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('#inspect-lost').count(), 0, 'old save: no line');
    assert.deepEqual(errors, []);
    console.log('ok wall penalty');
  } finally { await browser.close(); }
}

// 2) 진짜 키: 초반은 벽을 피해 돌아 들어가 잡는다(1임무) / 후반은 벽을 지나면 1장 내주고 잡는다(2임무) → HUD·검수 숫자가 맞는다
// 1임무 코스는 드문 카드가 진행 0.56 안쪽에만 있어 후반 칸(0.75~)이 없다 — 후반 칸은 2~4임무에서 나온다
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await startM(page);
    const early = await page.evaluate(`(${rareOf('early').replace(/^\(\(\)/, '(()')})`);
    assert.ok(early && early.z < (await page.evaluate(() => DR.App.course.length)) * 0.4, 'a rare card in the first stage');
    await stepUntil(page, `return p.runnerZ > ${early.wall.z} - 12;`);
    await toLane(page, early.neighbour);
    await stepUntil(page, `return p.runnerZ > ${early.wall.z} - 8;`);
    await page.screenshot({ path: shotPath('wall-early-1280') });
    assert.match(await page.locator('#run-hint').innerText(), /귀한 데이터! 노이즈를 피해 돌아 들어가/);
    await stepUntil(page, `return p.runnerZ > ${early.wall.z} + 0.5;`);
    await toLane(page, early.lane);
    await stepUntil(page, `return ${early.z} - p.runnerZ < p.speed * cfg.catchLead * 0.5;`);
    await page.evaluate(key('Space'));
    await page.evaluate(() => { DR.Run.step(0.02); DR.Run.step(0.02); });
    let p = await page.evaluate(() => DR.Run.peek());
    assert.ok(await page.evaluate((u) => DR.Run.isTaken(u), early.uid), 'rare caught after dodging');
    assert.equal(p.lost, 0, 'dodged: nothing lost');
    assert.equal(p.bagCount, 1);
    assert.deepEqual(errors, []);
    console.log('ok dodge early');
  } finally { await browser.close(); }
}
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m2' });
  try {
    await startM(page);
    const late = await page.evaluate(`(${rareOf('late')})`);
    assert.ok(late, 'a rare card in the late stage');
    // 내줄 카드 1장을 담아 두고 시작(앞쪽 카드는 벽 전에 다 지나간다)
    await page.evaluate((wz) => { const it = DR.App.course.items.find((i) => i.kind === 'card' && !i.fakeId && i.z < wz - 60 && i.z > wz - 200); DR.Run.debugTake(it.uid); }, late.wall.z);
    await stepUntil(page, `return p.runnerZ > ${late.wall.z} - 40;`);
    await toLane(page, late.lane);
    await stepUntil(page, `return p.runnerZ > ${late.wall.z} - 10;`);
    await page.screenshot({ path: shotPath('wall-late-1280') });
    assert.match(await page.locator('#run-hint').innerText(), /노이즈를 지나면 카드 1장을 잃어\. 그래도 잡을까\?/);
    await stepUntil(page, `return p.lost === 1;`);
    let p = await page.evaluate(() => DR.Run.peek());
    assert.equal(p.lost, 1, 'hit the wall in the late stage');
    assert.equal(p.bagCount, 0, 'gave one card');
    await stepUntil(page, `return ${late.z} - p.runnerZ < 6;`);
    await page.evaluate(key('Space'));
    await page.evaluate(() => { DR.Run.step(0.02); DR.Run.step(0.02); });
    p = await page.evaluate(() => DR.Run.peek());
    assert.equal(p.bagCount, 1, 'and took the rare one');
    assert.match(await page.locator('#hud-bag b').innerText(), /^1\/30$/);
    await page.evaluate(() => DR.Run.finishNow());
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('#inspect-lost').innerText(), '노이즈로 잃은 카드 1장');
    assert.match(await page.locator('#screen-inspect h2').first().innerText(), /\(1\/30칸\)/);
    assert.deepEqual(await page.evaluate(() => DR.App.state.bag.map((c) => c.id)), [late.uid]);
    assert.deepEqual(errors, []);
    console.log('ok trade late');
  } finally { await browser.close(); }
}

// 3) 세이브가 있을 때 연습 카드: 모달 → 달리기 → 5/5 → 끝맺음 → 타이틀, 저장은 그대로
for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  const { browser, page, errors } = await openGame({ viewport });
  try {
    await page.evaluate(() => DR.Save.checkpoint('inspect', { mission: 'm2', bag: [{ id: 'c1', key: 'can_drink' }], supplements: 1, firstTry: false, seed: 2201, needRevealed: true }, {}));
    const raw0 = await page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.data.save')));
    await page.reload();
    assert.equal(await page.locator('.mc-first').count(), 0, 'no first-time badge with a save');
    assert.equal(await page.locator('#title-missions button').first().getAttribute('id'), 'btn-practice', 'practice card comes first');
    await page.locator('#btn-practice').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('#screen-profile').isVisible(), false);
    await page.locator('#btn-run').click();
    // 모달: 달리지 않고 안내
    const dlg = page.locator('dialog.modal');
    await dlg.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => DR.App.screen), 'briefing', 'not running yet');
    assert.equal(await dlg.locator('h2').innerText(), '실기 미션');
    assert.match(await dlg.innerText(), /강아지 사진 5장과 고양이 사진 5장을 모으세요\./);
    assert.match(await dlg.innerText(), /불꽃은 하트 -1/);
    assert.match(await dlg.innerText(), /분홍 노이즈는 카드 1장 잃음/);
    assert.equal(await dlg.locator('.goal-row[data-goal="dog"] .goal-slot img').count(), 5);
    assert.equal(await dlg.locator('.goal-row[data-goal="cat"] .goal-slot img').count(), 5);
    const focused = () => page.evaluate(() => document.activeElement.id);
    assert.equal(await focused(), 'btn-goal-start');
    await page.keyboard.press('Tab');
    assert.equal(await focused(), 'btn-goal-start', 'focus stays inside');
    const fits = await dlg.evaluate((d) => { const r = d.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && d.querySelector('.modal-body').scrollHeight <= d.querySelector('.modal-body').clientHeight + 1; });
    assert.ok(fits, 'modal fits without scrolling');
    await page.screenshot({ path: shotPath('tutorial-goal-' + viewport.width) });
    // Esc는 브리핑으로
    await page.keyboard.press('Escape');
    await dlg.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => DR.App.screen), 'briefing');
    await page.locator('#btn-run').click();
    await dlg.waitFor({ state: 'visible' });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
    const goalText = () => page.locator('#run-goal').innerText();
    await page.evaluate(() => DR.Run.step(0.02));
    assert.match(await goalText(), /강아지 0\/5\s*·\s*고양이 0\/5/);
    // 첫 벽 직전 안내, 벽 뒤 같은 레인에 카드 없음
    const wall = await page.evaluate(() => DR.App.course.items.find((i) => i.kind === 'wall'));
    await stepUntil(page, `return ${wall.z} - p.runnerZ < p.speed * 1.9;`);
    assert.equal(await page.locator('#run-hint').innerText(), '분홍 노이즈에 부딪히면 카드가 1장 떨어져');
    await page.screenshot({ path: shotPath('tutorial-wall-' + viewport.width) });
    // 5장 = 금색, 넘치면 주황 "이미 5장!"
    await page.evaluate(() => { DR.App.debugFill({ dog: 5 }); DR.Run.step(0.02); });
    assert.match(await page.locator('.run-goal-item[data-goal="dog"]').getAttribute('class'), /\bdone\b/);
    await page.evaluate(() => { DR.App.debugFill({ dog: 1 }); DR.Run.step(0.02); });
    const over = page.locator('.run-goal-item[data-goal="dog"]');
    assert.match(await over.getAttribute('class'), /\bover\b/);
    assert.match(await over.innerText(), /강아지 6\/5 이미 5장!/);
    assert.equal(await page.evaluate(() => DR.Run.peek().bagCount), 6, 'not blocked');
    await page.screenshot({ path: shotPath('tutorial-over-' + viewport.width) });
    // 한쪽으로 쏠림(6:4) → fail 대사
    await page.evaluate(() => { DR.App.debugFill({ cat: 4 }); DR.Run.finishNow(); });
    await page.locator('#screen-result').waitFor({ state: 'visible', timeout: 5000 });
    assert.match(await page.locator('#screen-result').innerText(), /한쪽 사진만 잔뜩/);
    await page.locator('#btn-retry').click();
    await waitRun(page);
    // 4:4 → failFew
    await page.evaluate(() => { DR.App.debugFill({ dog: 4, cat: 4 }); DR.Run.finishNow(); });
    await page.locator('#screen-result').waitFor({ state: 'visible', timeout: 5000 });
    assert.match(await page.locator('#screen-result').innerText(), /아직 너무 적어/);
    await page.locator('#btn-retry').click();
    await waitRun(page);
    // 5:5 통과, 끝은 진짜 끝맺음으로
    await page.evaluate(() => { DR.App.debugFill({ dog: 5, cat: 5 }); });
    assert.equal(await page.evaluate(() => DR.Run.peek().rush), true);
    await page.locator('#screen-result').waitFor({ state: 'visible', timeout: 60000 });
    assert.equal(await page.locator('#btn-retry').count(), 0, 'passed');
    await page.locator('#btn-next').click();
    await page.locator('#screen-story').waitFor();
    const talk = [];
    for (let i = 0; i < 4 && await page.locator('#screen-story').isVisible(); i++) { talk.push(await page.locator('#screen-story').innerText()); await page.locator('#screen-story .dialog').click(); }
    assert.ok(talk.some((x) => /개 5장, 고양이 5장\. 말한 대로 골라 담았네/.test(x)), 'new pass line');
    await page.waitForTimeout(200);
    await passCity(page);
    await page.locator('#screen-title').waitFor({ state: 'visible', timeout: 5000 });
    const raw1 = await page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.data.save')));
    for (const k of ['mission', 'screen', 'bag', 'supplements', 'firstTry', 'seed', 'needRevealed']) assert.deepEqual(raw1[k], raw0[k], 'save kept: ' + k);
    assert.equal(raw1.tutorialDone, true, 'tutorialDone recorded');
    await page.locator('#btn-continue').waitFor();
    assert.match(await page.locator('#title-progress').innerText(), /2임무 · 검수부터/);
    assert.deepEqual(errors, []);
    console.log('ok practice with save', viewport.width);
  } finally { await browser.close(); }
}

// 4) 세이브가 없을 때: 배지 강조, 처음 흐름 → 끝나면 1 임무로. '처음부터' 선택지는 그대로
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 } });
  try {
    assert.equal(await page.locator('#btn-practice .mc-first').innerText(), '처음이라면 여기부터');
    await page.screenshot({ path: shotPath('title-practice-1280') });
    await page.locator('#btn-practice').click();
    await page.locator('#screen-profile').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('#btn-skip').click();
    await page.locator('#btn-skip').click();
    await page.locator('#btn-run').click();
    await page.locator('#btn-goal-start').click();
    await page.waitForFunction(() => DR.App.screen === 'run' && DR.Run.peek().running, null, { timeout: 8000 });
    await page.evaluate(() => { DR.App.debugFill({ dog: 5, cat: 5 }); DR.Run.finishNow(); });
    await page.locator('#btn-next').click();
    await page.locator('#screen-story').waitFor();
    await page.locator('#btn-skip').click();
    await page.waitForTimeout(100);
    await passCity(page);
    await page.locator('#screen-story').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.evaluate(() => DR.App.state.mission), 'm1', 'continues into mission 1');
    await page.locator('#btn-skip').click();
    await page.locator('#screen-briefing').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.data.save')))).tutorialDone, true);
    assert.deepEqual(errors, []);
    console.log('ok practice without save');
  } finally { await browser.close(); }
}

// 5) 끝맺음: 게이트 → 입력 잠금·감속 → 어두워짐 "도착 · 가방 n/30" → 다음 화면 밝아짐. 일시정지 막힘, 건너뛰기, 임무마다, 보충, HP 0, 움직임 줄이기
async function nearEnd(page) {
  await stepUntil(page, 'return p.runnerZ > DR.App.course.length - 50;');
  assert.equal(await page.evaluate(() => DR.Run.peek().gate), true, 'gate visible in the last stretch');
}
for (const id of ['m1', 'm2', 'm3']) {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=' + id });
  try {
    await startM(page);
    assert.equal(await page.evaluate(() => DR.Run.peek().gate), false, 'gate hidden at the start');
    await nearEnd(page);
    await stepUntil(page, 'return !!p.finishing;');
    const f0 = await page.evaluate(() => DR.Run.peek());
    await page.evaluate(() => DR.Run.setPaused(false));
    assert.equal(f0.finishing, 'arrive');
    assert.equal(f0.running, true);
    // 잠금: 레인·일시정지 버튼·Esc·P
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    await page.keyboard.press('p');
    await page.evaluate(() => document.getElementById('btn-pause').click());
    assert.equal(await page.locator('dialog[open]').count(), 0, 'no pause while finishing');
    assert.equal((await page.evaluate(() => DR.Run.peek())).lane, f0.lane, 'input locked');
    const log = await page.evaluate(() => new Promise((done) => {
      const out = { texts: [], minOpacity: 1, hudOff: false, phases: [] }, t0 = performance.now();
      (function tick() {
        const el = document.getElementById('run-fade');
        if (!el.hidden && el.textContent && !out.texts.includes(el.textContent)) out.texts.push(el.textContent);
        if (document.getElementById('hud').classList.contains('hud-off')) out.hudOff = true;
        if (DR.App.screen === 'inspect' && !out.inspectAt) { out.inspectAt = performance.now() - t0; out.veilAtSwitch = !el.hidden; }
        if (out.inspectAt && el.hidden) { out.clearAt = performance.now() - t0; done(out); return; }
        if (performance.now() - t0 > 25000) { done(out); return; }
        requestAnimationFrame(tick);
      })();
    }));
    assert.ok(log.texts.some((x) => /^도착 · 가방 0\/30$/.test(x)), JSON.stringify(log));
    assert.ok(log.hudOff, 'hud hidden');
    assert.ok(log.inspectAt, 'reached inspect ' + JSON.stringify(log));
    assert.ok(log.veilAtSwitch, 'veil still up when the next screen appears');
    assert.ok(log.clearAt > log.inspectAt, 'veil clears after the switch');
    assert.equal(await page.locator('#run-fade').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('ok finish', id, Math.round(log.inspectAt) + 'ms', Math.round(log.clearAt - log.inspectAt) + 'ms');
  } finally { await browser.close(); }
}
// 보충 달리기도 같은 끝맺음
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await startM(page);
    await page.evaluate(() => { DR.App.debugFill({ day_deep: 1 }); DR.Run.finishNow(); });
    await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
    for (let n = 0; n < 8 && !(await page.locator('#screen-prep').isVisible()); n++) await page.locator('#btn-next').click();
    await page.locator('#screen-prep .btn-primary').last().click();
    await waitRun(page);
    await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
    await nearEnd(page);
    await stepUntil(page, 'return !!p.finishing;');
    await page.evaluate(() => DR.Run.setPaused(false));
    await page.locator('#run-fade').waitFor({ state: 'visible', timeout: 15000 });
    assert.match(await page.locator('#run-fade').innerText(), /^도착 · 가방 \d+\/30$/);
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 15000 });
    assert.deepEqual(errors, []);
    console.log('ok finish supplement');
  } finally { await browser.close(); }
}
// Space·클릭 건너뛰기, 두 번 실행 없음
for (const how of ['space', 'click']) {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await startM(page);
    await page.evaluate(() => { let n = 0; const go = DR.App.go; DR.App.go = function (s) { if (s === 'inspect') window.__inspects = ++n; return go.apply(this, arguments); }; });
    await nearEnd(page);
    await stepUntil(page, 'return !!p.finishing;');
    await page.evaluate(() => { for (let i = 0; i < 20; i++) DR.Run.step(0.02); }); // 잠깐 지나 건너뛰기 허용
    if (how === 'space') await page.keyboard.press('Space');
    else await page.mouse.click(640, 420);
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 3000 });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__inspects), 1, 'one transition');
    assert.deepEqual(errors, []);
    console.log('ok skip', how);
  } finally { await browser.close(); }
}
// 처음 0.3초 안의 Space는 넘기지 않는다(잡기 연타)
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await startM(page);
    await nearEnd(page);
    await stepUntil(page, 'return !!p.finishing;');
    await page.evaluate(key('Space'));
    assert.equal((await page.evaluate(() => DR.Run.peek())).running, true, 'mash does not skip');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}
// HP 0: 빨간 플래시 뒤 같은 페이드
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await startM(page);
    await page.evaluate(() => DR.Run.debugSetHp(1));
    const fire = await page.evaluate(() => DR.App.course.items.find((i) => i.kind === 'fire'));
    await stepUntil(page, `return p.runnerZ > ${fire.z} - 10;`);
    await toLane(page, fire.lane);
    await stepUntil(page, 'return !!p.finishing;');
    assert.equal((await page.evaluate(() => DR.Run.peek())).finishing, 'knockout');
    assert.equal(await page.locator('.damage-flash').isVisible(), true, 'red flash');
    await page.evaluate(() => DR.Run.setPaused(false));
    await page.locator('#run-fade').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#run-fade').innerText(), '연결 끊김');
    await page.locator('#screen-knockout').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#btn-rerun').click();
    await waitRun(page);
    assert.equal(await page.locator('#hud').evaluate((h) => h.classList.contains('hud-off')), false, 'hud back on rerun');
    assert.equal(await page.locator('#run-fade').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('ok knockout fade');
  } finally { await browser.close(); }
}
// 움직임 줄이기: 0.3초 단순 페이드(감속·글자 없음)
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startM(page);
    await nearEnd(page);
    await stepUntil(page, 'return !!p.finishing;');
    const steps = await page.evaluate(() => { let n = 0; for (; n < 60 && DR.Run.peek().running; n++) DR.Run.step(0.02); return n; });
    assert.ok(steps >= 14 && steps <= 17, 'about 0.3s of steps: ' + steps);
    assert.equal(await page.locator('#run-fade').innerText(), '');
    await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 3000 });
    assert.deepEqual(errors, []);
    console.log('ok reduced motion');
  } finally { await browser.close(); }
}

// 6) 가방이 차면 1.5배, 카드를 잃으면 원래 속도
{
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m1' });
  try {
    await startM(page);
    const base = await page.evaluate(() => { DR.Run.step(0.02); return DR.Run.peek().speed; });
    await page.evaluate(() => {
      const items = DR.App.course.items.filter((i) => i.kind === 'card');
      for (let i = items.length - 1, n = 0; n < 30; i--, n++) DR.Run.debugTake(items[i].uid);
      for (let i = 0; i < 40; i++) DR.Run.step(0.02);
    });
    let p = await page.evaluate(() => DR.Run.peek());
    assert.equal(p.rush, true);
    assert.equal(await page.locator('#run-hint').innerText(), '가방이 꽉 찼어! 결승선까지 달려');
    assert.ok(Math.abs(p.speed / base - 1.5) < 0.05, 'speed x1.5: ' + p.speed + ' / ' + base);
    const wall = await page.evaluate(() => { const z = DR.Run.peek().runnerZ; return DR.App.course.items.find((i) => i.kind === 'wall' && i.z > z + 30); });
    await toLane(page, wall.lane);
    await stepUntil(page, 'return p.lost === 1;');
    p = await page.evaluate(() => DR.Run.peek());
    assert.equal(p.rush, false, 'lost a card: rush ends');
    assert.equal(p.bagCount, 29);
    await page.evaluate(() => { for (let i = 0; i < 80; i++) DR.Run.step(0.02); });
    p = await page.evaluate(() => DR.Run.peek());
    assert.ok(p.speed / base < 1.15, 'back to normal speed: ' + p.speed);
    assert.deepEqual(errors, []);
    console.log('ok bag full rush');
  } finally { await browser.close(); }
}
console.log('PASS runner');
