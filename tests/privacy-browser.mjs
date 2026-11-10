// 목적 밖 개인정보 카드(설계 2026-11-08 ①) — 1부: 그림(사진 3장·3 임무 행인/번호판·4 임무 이름 흘림 획·가린 모습)
// 2부: 검수 가리기·감독관 막기·결과 한 줄(임무마다 그대로 / 빼기 / 가리기)
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const part = process.argv[2] || 'all';

async function artPart() {
  const { browser, page, errors } = await openGame({ viewport: { width: 1400, height: 900 } });
  try {
    await page.waitForFunction(() => DR.CardArt.photosReady && DR.CardArt.photosReady(), null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      const A = DR.CardArt, M = DR.Missions;
      const region = (c, rc) => {
        const g = c.getContext('2d'), S = c.width, d = g.getImageData(Math.round(rc.x * S), Math.round(rc.y * S), Math.round(rc.w * S), Math.round(rc.h * S)).data;
        let s = 0, s2 = 0, n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; }
        // grad = 이웃 화소 밝기 차 평균(눈·코·입 같은 잔무늬). 사진 얼굴은 칸이 작아(3 임무 약 19px) 머리카락↔피부↔배경의
        // 큰 명암이 흐린 뒤에도 남아 std는 0.8배 근처 — 흐림이 지우는 건 잔무늬라 grad로 잰다
        const w = Math.round(rc.w * S), h = Math.round(rc.h * S), L = (x, y) => { const i = (y * w + x) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3; };
        let gs = 0, gn = 0;
        for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) { gs += Math.abs(L(x + 1, y) - L(x, y)) + Math.abs(L(x, y + 1) - L(x, y)); gn++; }
        return { mean: s / n, std: Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)), grad: gn ? gs / gn : 0 };
      };
      const diff = (a, b) => { const x = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, y = b.getContext('2d').getImageData(0, 0, b.width, b.height).data; let s = 0; for (let i = 0; i < x.length; i += 4) s += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); return s / (x.length / 4); };
      const out = { cards: [] };
      for (const id of ['m1', 'm2', 'm3', 'm4']) for (const d of M[id].privacy.cards) {
        const plain = A.card(M[id], d.id, 0, 256, 4), masked = A.card(M[id], d.id + '#masked', 0, 256, 4), base = A.card(M[id], d.key, 0, 256, 4);
        const row = { id: d.id, photo: plain.photo || '', maskedPhoto: masked.photo || '', diffBase: diff(plain, base), regions: [] };
        for (const rc of d.mask) {
          const inset = { x: rc.x + rc.w * 0.12, y: rc.y + rc.h * 0.12, w: rc.w * 0.76, h: rc.h * 0.76 }; // 둥근 모서리 밖은 빼고
          const a = region(plain, inset), b = region(masked, inset);
          row.regions.push({ look: rc.look, plainStd: a.std, maskedStd: b.std, maskedMean: b.mean, plainGrad: a.grad, maskedGrad: b.grad });
        }
        // 가린 칸 밖은 같은 그림
        row.outside = region(masked, { x: 0, y: 0.92, w: 1, h: 0.08 }).mean - region(plain, { x: 0, y: 0.92, w: 1, h: 0.08 }).mean;
        out.cards.push(row);
      }
      // 4 임무 이름 줄은 답 칸(y 0.18 ~ 0.92) 밖 — 숫자 판단 단서와 섞이지 않게
      const n4 = M.m4.privacy.cards[0];
      out.m4NameAboveBox = n4.mask.every((rc) => rc.y + rc.h <= 0.18);
      out.m4AnswerSame = region(A.card(M.m4, n4.id, 0, 256), { x: 0.12, y: 0.2, w: 0.76, h: 0.7 }).mean - region(A.card(M.m4, n4.key, 0, 256), { x: 0.12, y: 0.2, w: 0.76, h: 0.7 }).mean;

      // 사람 눈 확인용 시트
      const sheet = document.createElement('div');
      sheet.style.cssText = 'position:fixed;inset:0;z-index:99;background:#111;display:flex;flex-wrap:wrap;gap:8px;padding:8px;overflow:hidden';
      const add = (c, label) => { const f = document.createElement('figure'); f.style.cssText = 'margin:0;color:#fff;font:12px sans-serif'; const k = document.createElement('canvas'); k.width = k.height = 200; k.getContext('2d').drawImage(c, 0, 0, 200, 200); f.append(k, Object.assign(document.createElement('figcaption'), { textContent: label })); sheet.append(f); };
      for (const id of ['m1', 'm2', 'm3', 'm4']) for (const d of M[id].privacy.cards) {
        add(A.card(M[id], d.id, 0, 256, 4), d.id);
        add(A.card(M[id], d.id + '#masked', 0, 256, 4), d.id + ' 가림');
      }
      add(A.thumb(A.card(M.m4, 'p_name_algo', 0, 192), 24), 'm4 썸네일');
      add(A.thumb(A.card(M.m4, 'p_name_algo#masked', 0, 192), 24), 'm4 썸네일 가림');
      add(A.thumb(A.card(M.m3, 'p_river_people', 0, 192), 24), 'm3 썸네일');
      document.body.append(sheet);
      return out;
    });
    await page.screenshot({ path: shotPath('privacy-art') });
    for (const c of r.cards) console.log(c.id, c.regions.map((g) => g.look + ' std ' + g.plainStd.toFixed(1) + '→' + g.maskedStd.toFixed(1) + ' grad ' + g.plainGrad.toFixed(1) + '→' + g.maskedGrad.toFixed(1)).join(' | '));
    for (const c of r.cards) {
      if (c.id.startsWith('p_wallet') || c.id.startsWith('p_phone') || c.id.startsWith('p_person') || c.id.startsWith('p_river') || c.id.startsWith('p_station')) {
        assert.ok(c.photo, c.id + ' uses its photo');
        assert.ok(c.maskedPhoto === '' || c.maskedPhoto === c.photo, c.id);
      }
      assert.ok(c.diffBase > 3, c.id + ' differs from the plain card of its kind: ' + c.diffBase);
      for (const g of c.regions) {
        if (g.look === 'bar') assert.ok(g.maskedMean < 40 && g.maskedStd < 12, c.id + ' bar is dark and flat ' + JSON.stringify(g));
        else assert.ok(g.maskedStd < g.plainStd * 0.9 && g.maskedGrad < g.plainGrad * 0.6, c.id + ' blur lowers detail ' + JSON.stringify(g));
      }
      assert.ok(Math.abs(c.outside) < 1, c.id + ' outside the mask unchanged');
    }
    assert.equal(r.m4NameAboveBox, true);
    assert.ok(Math.abs(r.m4AnswerSame) < 0.5, 'm4 answer box drawn like the plain neat card');
    assert.deepEqual(errors, []);
    console.log('privacy art OK', r.cards.length);
  } finally { await browser.close(); }
}

// 2부: 검수에서 처리 3갈래 — 그대로 제출 → 막힘 / 개인정보 아닌 카드 가리기 → 안내만 / 가리기·빼기 → 통과(2 임무는 가리면 막힘, 빼야 통과)
const COMMON = { m1: { umbrella_open: 3, umbrella_folded: 3, wallet_closed: 3, wallet_open: 3, phone_front: 3, phone_back: 3 },
  m2: { can_drink: 2, pet_clear: 2 }, m3: { station_now: 2, river_now: 2 }, m4: { neat_data: 2, neat_ml: 2 } };
async function toInspect(page, id) {
  await page.locator('#btn-skip').click();
  await page.locator('#screen-briefing').waitFor();
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.evaluate(([id, c]) => {
    const ids = DR.Missions[id].privacy.cards.map((d) => d.id), fill = { ...c };
    ids.forEach((p) => { fill[p] = 1; });
    DR.App.debugFill(fill); DR.Run.finishNow();
  }, [id, COMMON[id]]);
  await page.locator('#screen-inspect').waitFor({ state: 'visible' });
}
const privIds = (page) => page.evaluate(() => DR.App.state.bag.filter((c) => c.privateId).map((c) => c.id));
async function zoomMask(page, cardId) {
  await page.locator(`#inspect-grid .bag-card[data-id="${cardId}"] .bag-open`).click();
  await page.locator('#btn-mask').click();
}
async function closeZoom(page) { await page.keyboard.press('Escape'); }
async function submitTry(page) {
  await page.locator('#btn-submit').click();
  await page.locator('#screen-supervisor').waitFor({ state: 'visible' });
  return { text: await page.locator('#screen-supervisor').innerText(), confirm: await page.locator('#btn-confirm').count() };
}

async function flowPart(viewport) {
  for (const id of ['m1', 'm2', 'm3', 'm4']) {
    const { browser, page, errors } = await openGame({ viewport, query: '?start=' + id });
    try {
      await toInspect(page, id);
      const ids = await privIds(page);
      assert.equal(ids.length, 2, id + ' two private cards caught');
      // 문구는 임무마다 다를 수 있다(4 임무 = 답안지·학생 이름, 2026-11-10) — DR.Privacy.text
      const T = await page.evaluate((mid) => { const m = DR.Missions[mid]; return { note: DR.Privacy.text(m, 'inspectNote'), block: DR.Privacy.text(m, 'blockUnhandled'), more: DR.Privacy.text(m, 'blockMore') }; }, id);
      if (id === 'm4') { assert.match(T.note, /학생 이름이 적힌 답안지/); assert.match(T.block, /학생 이름이 적힌 답안지/); }
      else { assert.match(T.note, /개인정보가 보이는 사진은 크게 보기에서 가리거나 뺀다/); assert.match(T.block, /개인정보가 담긴 사진이 학습 자료에 들어가려 해/); }
      assert.ok((await page.locator('#screen-inspect').innerText()).includes(T.note), id + ' inspect note');
      // 그대로 제출 → 감독관이 막는다(어느 카드인지 말하지 않음), 승인 버튼 없음
      let s = await submitTry(page);
      assert.ok(s.text.includes(T.block), id + ' block line');
      assert.equal(s.confirm, 0, id + ' no confirm while blocked');
      await page.locator('#btn-back').click();
      // 개인정보 아닌 카드를 가리기 → 안내만, 그대로
      const plain = await page.evaluate(() => DR.App.state.bag.find((c) => !c.privateId).id);
      await zoomMask(page, plain);
      assert.match(await page.locator('#zoom-mask-note').innerText(), /가릴 개인정보가 없어/);
      assert.equal(await page.evaluate((p) => !!DR.App.state.bag.find((c) => c.id === p).masked, plain), false);
      await closeZoom(page);
      // 개인정보 카드 가리기 → '가림' 표시, 그림이 가린 모습
      // 4 임무는 더블 클릭으로 — 두 번째 누름이 새로 그린 '되돌리기'에 떨어져 가림이 바로 풀리면 안 된다(2026-11-10)
      if (id === 'm4') {
        await page.locator('#inspect-grid .bag-card[data-id="' + ids[0] + '"] .bag-open').click();
        await page.locator('#btn-mask').dblclick();
      } else await zoomMask(page, ids[0]);
      assert.equal(await page.locator('#btn-mask').innerText(), '가린 것 되돌리기');
      // 가린 것은 바로 저장된다(새로고침·탭 되살아남 뒤에도 남게)
      assert.equal(await page.evaluate((p) => { const sv = DR.Save.load(); return !!(sv && sv.bag.find((c) => c.id === p) || {}).masked; }, ids[0]), true, id + ' mask saved at once');
      if (id === 'm1' && viewport.width === 1280) await page.screenshot({ path: shotPath('privacy-zoom-m1-1280') });
      if (id === 'm3') await page.screenshot({ path: shotPath('privacy-zoom-m3-' + viewport.width) });
      await closeZoom(page);
      assert.equal(await page.locator(`#inspect-grid .bag-card[data-id="${ids[0]}"] .bag-masked`).count(), 1);
      if (id !== 'm2') {
        // 한 장만 가리고 내면: 같은 말을 되풀이하지 않고 남은 장 수를 말한다(어느 카드인지는 말하지 않는다)
        s = await submitTry(page);
        assert.ok(s.text.includes(T.more.replace('{n}', '1')), id + ' partial: ' + s.text.slice(0, 80));
        assert.equal(s.confirm, 0);
        if (id === 'm4' && viewport.width === 1280) await page.screenshot({ path: shotPath('privacy-partial-m4-1280') });
        await page.locator('#btn-back').click();
        if (id === 'm4' && viewport.width === 1280) {
          await page.locator('#inspect-grid .bag-card[data-id="' + ids[1] + '"] .bag-open').click();
          await page.screenshot({ path: shotPath('privacy-zoom-m4-1280') });
          await closeZoom(page);
        }
      }
      const before = await page.evaluate(() => DR.App.state.bag.length);
      if (id === 'm2') {
        // 2 임무: 사람 얼굴을 가려도 막힌다 → 빼야 통과
        await zoomMask(page, ids[1]); await closeZoom(page);
        s = await submitTry(page);
        assert.match(s.text, /얼굴을 가려도 이 사진에는 누가 버렸는지 기록이 남아/);
        assert.equal(s.confirm, 0);
        await page.locator('#btn-back').click();
        for (const p of ids) await page.locator(`#inspect-grid .bag-card[data-id="${p}"] .btn-remove`).click();
        assert.equal(await page.evaluate(() => DR.App.state.bag.length), before - 2, 'removed both');
      } else {
        // 가리기 하나 + 빼기 하나 → 통과. 가린 카드는 가방에 남아 그 종류로 센다
        await page.locator(`#inspect-grid .bag-card[data-id="${ids[1]}"] .btn-remove`).click();
        assert.equal(await page.evaluate(() => DR.App.state.bag.length), before - 1);
        assert.equal(await page.evaluate((p) => DR.App.state.bag.find((c) => c.id === p).masked, ids[0]), true);
        if (viewport.width === 1280 || id === 'm4') await page.screenshot({ path: shotPath(`privacy-inspect-${id}-${viewport.width}`), fullPage: true });
      }
      s = await submitTry(page);
      assert.equal(s.confirm, 1, id + ' handled → confirm');
      if (id === 'm1') {
        // 가릴 수 있던 카드를 뺐다 → 결과 마지막 장면에 한 줄
        await page.locator('#btn-confirm').click();
        await page.locator('#screen-conveyor').waitFor({ state: 'visible', timeout: 8000 });
        await page.locator('#btn-cv-skip').click();
        await page.locator('#btn-cv-next').click();
        await page.locator('#screen-result .result-scene').waitFor({ timeout: 40000 });
        assert.doesNotMatch(await page.locator('#screen-result').innerText(), /가렸으면/, 'not on the first scene');
        await page.locator('#btn-next').click(); await page.locator('#btn-next').click();
        assert.match(await page.locator('#screen-result').innerText(), /가렸으면 살려 쓸 수 있었어/);
        if (viewport.width === 1280) await page.screenshot({ path: shotPath('privacy-result-m1-1280'), fullPage: true });
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
      assert.deepEqual(errors, []);
      console.log('privacy flow OK', id, viewport.width);
    } finally { await browser.close(); }
  }
}

// 저장: 가린 카드는 새로고침 뒤에도 가린 채(검수 체크포인트)
async function reloadPart() {
  const { browser, page, errors } = await openGame({ viewport: { width: 1280, height: 800 }, query: '?start=m4' });
  try {
    await page.addInitScript(() => {}); // 같은 저장소
    await toInspect(page, 'm4');
    const ids = await privIds(page);
    await zoomMask(page, ids[0]); await closeZoom(page);
    await page.locator('#btn-submit').click(); // 막힘(하나는 그대로) — 검수 체크포인트는 그대로
    await page.locator('#btn-back').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.data.save')));
    assert.ok(saved.bag.some((c) => c.privateId && c.masked), 'masked flag saved at the inspect checkpoint');
    // 한 번 가려 본 카드는 '가릴 수 있었는데 뺐다' 목록에서 빠진다(2026-11-10 — 가린 뒤 칸을 비우려고 빼도 "가렸으면…"을 듣지 않게)
    assert.deepEqual(saved.privCaught, [ids[1]]);
    assert.deepEqual(errors, []);
    console.log('privacy save OK');
  } finally { await browser.close(); }
}

if (part === 'all' || part === 'art') await artPart();
if (part === 'all' || part === 'flow') { await flowPart({ width: 1280, height: 800 }); await flowPart({ width: 390, height: 844 }); }
if (part === 'all' || part === 'reload') await reloadPart();
console.log('PASS privacy');
