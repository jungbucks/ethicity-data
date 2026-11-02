// 실제로 잡아서 끝까지(사용자 2026-11-02 "비 오는 날 학교 앞 횡단보도 카드가 안 나와서 클리어할 수 없어"):
// debugFill(코스에서 몰래 집기) 없이, 레인 키·Space로 진짜 잡아서 3 임무를 처음 판에 깰 수 있는지 — 주인공 둘 × 여러 코스.
// 자동 조종은 장면마다 필요한 카드를 한 줄에 하나씩만 고른다(같은 줄의 두 카드는 동시에 못 잡음).
// 조사 결과: 카드는 늘 나오고 잡을 수 있었다 — 원인은 '비 오는 학교 앞' 그림이 맑은 날과 거의 같았던 것(cardart-browser가 지킴).
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

async function throughResults(page) {
  const out = [];
  for (let n = 0; n < 12; n++) {
    if (await page.locator('#screen-guide').isVisible()) { await page.locator('#btn-gd-skip').click(); await page.locator('#btn-gd-next').click(); continue; }
    if (!(await page.locator('#screen-result').isVisible()) || !(await page.locator('#screen-result .result-scene').count())) break;
    const s = page.locator('#screen-result .result-scene');
    out.push({ scene: await s.getAttribute('data-scene'), outcome: await s.getAttribute('data-outcome') });
    await page.locator('#btn-next').click();
  }
  return out;
}

// 달리는 중(일시정지 + step): 목표 카드 레인으로 옮기고 판정 구간에서 Space. 불꽃 넉아웃은 테스트 밖(HP 99)
async function autopilot(page) {
  return page.evaluate(() => {
    const m = DR.Missions[DR.App.state.mission], items = DR.Run.course().items, cfg = DR.config;
    const rows = new Set(), targets = [], plan = {};
    m.scenes.forEach((s) => s.combos.forEach((cb) => {
      let n = 0;
      for (const it of items) {
        if (n >= cb.need) break;
        if (it.kind !== 'card' || it.fakeId || it.ambiguousId || !cb.keys.includes(it.key) || rows.has(it.z)) continue;
        rows.add(it.z); targets.push(it); n++;
      }
      plan[cb.id] = n + '/' + cb.need;
    }));
    targets.sort((a, b) => a.z - b.z);
    const key = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code }));
    for (let i = 0; i < 20000 && DR.Run.peek().running; i++) {
      const p = DR.Run.peek();
      const t = targets.find((it) => !DR.Run.isTaken(it.uid) && it.z > p.runnerZ - 0.5);
      if (t) {
        if (p.lane !== t.lane) key(p.lane < t.lane ? 'ArrowRight' : 'ArrowLeft');
        else if (DR.Catch.phase(t, p.runnerZ, p.speed, cfg) === 'active') key('Space');
      }
      DR.Run.step(0.02);
    }
    return { plan, targets: targets.length, caught: targets.filter((t) => DR.Run.isTaken(t.uid)).length };
  });
}

// 실제 배포 코스(seed 3301, config.randomSeed=false) × 주인공 둘 + 다른 코스 하나. (조사 때는 둘 × 3301·3302·3317 여섯 판 모두 통과)
for (const [hero, seed] of [['onyu', 3301], ['daon', 3301], ['daon', 3317]]) {
  {
    const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m3' });
    try {
      // 주인공은 달리기 시작 때 저장소에서 읽는다 · 코스 seed는 브리핑에서 출발할 때 App.state.seed로 만든다
      await page.evaluate(([h, s]) => { DR.Save.setHero(h); DR.App.state.seed = s; }, [hero, seed]);
      await page.locator('#btn-skip').click();
      await page.locator('#btn-run').click();
      await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
      await page.evaluate(() => { DR.Run.setPaused(true); DR.Run.debugSetHp(99); });
      assert.equal(await page.evaluate(() => DR.Run.peek().hero), hero);
      const r = await autopilot(page);
      const tag = hero + ' seed ' + seed + ' ' + JSON.stringify(r);
      assert.ok(Object.values(r.plan).every((v) => { const [a, b] = v.split('/').map(Number); return a >= b; }), 'needed cards reachable ' + tag);
      assert.equal(r.caught, r.targets, 'caught every planned card ' + tag);
      await page.locator('#screen-inspect').waitFor({ state: 'visible', timeout: 8000 });
      await page.locator('#btn-submit').click(); await page.locator('#btn-confirm').click();
      const res = await throughResults(page);
      assert.deepEqual(res.map((x) => x.outcome), ['pass', 'pass', 'pass', 'pass'], tag + ' ' + JSON.stringify(res));
      await page.locator('#screen-story').waitFor({ state: 'visible', timeout: 4000 });
      assert.deepEqual(errors, []);
      console.log('ok', tag);
    } finally { await browser.close(); }
  }
}
console.log('PASS play');
