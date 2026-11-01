// 카드 그림: 모든 카드·아이콘·단서·결과 컷이 실제로 그려지는지, 변형·캐시·픽셀화가 맞는지 + 사람 눈 확인용 시트
import assert from 'node:assert/strict';
import { openGame, shotPath } from './browser.mjs';

const { browser, page, errors } = await openGame({ viewport: { width: 1400, height: 1000 } });
try {
  const r = await page.evaluate(() => {
    const A = DR.CardArt, M = DR.Missions;
    const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const std = (c) => { const d = px(c); let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; } return Math.sqrt(s2 / n - (s / n) ** 2); };
    const lowerMean = (c) => { const d = px(c), w = c.width, h = c.height; let r = 0, g = 0, b = 0, n = 0; for (let y = Math.floor(h * 2 / 3); y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return [r / n, g / n, b / n]; };
    const out = { bad: [], sizes: [] };
    const ids = [...Object.keys(M.m1.cardTypes), ...M.m1.ambiguous.map((a) => a.id), ...M.m1.fakes.map((f) => f.id)];
    for (const id of ids) { const c = A.card(M.m1, id, 0, 256); out.sizes.push(c.width + 'x' + c.height); if (std(c) <= 10) out.bad.push(id); }
    for (const id of Object.keys(M.tutorial.cardTypes)) { const c = A.card(M.tutorial, id, 0, 256); if (std(c) <= 10) out.bad.push(id); }
    out.variantDiffers = A.card(M.m1, 'day_deep', 0, 256).toDataURL() !== A.card(M.m1, 'day_deep', 1, 256).toDataURL();
    out.cached = A.card(M.m1, 'day_deep', 0, 256) === A.card(M.m1, 'day_deep', 0, 256);
    const a = lowerMean(A.card(M.m1, 'day_dry', 0, 256)), b = lowerMean(A.card(M.m1, 'day_deep', 0, 256));
    out.waterDiff = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const icons = ['day', 'night', 'flood_deep', 'flood_shallow', 'wet', 'dry', 'unknown', 'dog', 'cat'];
    out.iconUnique = new Set(icons.map((n) => A.icon(n, 64).toDataURL())).size;
    const t = A.thumb(A.card(M.m1, 'night_wet', 0, 256), 24);
    const k = t.width / 24, d = px(t), cell = [];
    for (let y = 5 * k; y < 6 * k; y++) for (let x = 5 * k; x < 6 * k; x++) { const i = (y * t.width + x) * 4; cell.push(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); }
    out.thumbInt = Number.isInteger(k);
    out.thumbBlock = new Set(cell).size;
    out.scenes = 0;
    for (const s of M.m1.scenes) for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) if (std(A.scene(M.m1, s.id, o, 320)) > 10) out.scenes++;
    out.tutScene = std(A.scene(M.tutorial, 'T1', 'neutral', 320)) > 10;
    out.clues = 0;
    for (const q of M.m1.ambiguous) q.clues.forEach((_, i) => { if (std(A.clue(M.m1, q.id, i, 256)) > 5) out.clues++; });
    out.clueTotal = M.m1.ambiguous.reduce((n, q) => n + q.clues.length, 0);

    // 사람 눈 확인용 시트
    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99;background:#111;display:flex;flex-wrap:wrap;gap:6px;padding:6px;overflow:hidden';
    const add = (c, label) => { const f = document.createElement('figure'); f.style.cssText = 'margin:0;color:#fff;font:11px sans-serif'; c.style.width = '128px'; c.style.height = '128px'; f.append(c, Object.assign(document.createElement('figcaption'), { textContent: label })); sheet.append(f); };
    for (const id of ids) add(A.card(M.m1, id, 0, 256), id);
    for (const id of ['day_deep', 'night_wet']) add(A.card(M.m1, id, 1, 256), id + ' v1');
    add(A.thumb(A.card(M.m1, 'night_neon', 0, 256), 24), 'thumb neon');
    for (const f of M.m1.fakes) add(A.thumb(A.card(M.m1, f.id, 0, 256), 24), 'thumb ' + f.id);
    for (const id of Object.keys(M.tutorial.cardTypes)) add(A.card(M.tutorial, id, 0, 256), id);
    for (const n of icons) add(A.icon(n, 64), n);
    for (const q of M.m1.ambiguous) q.clues.forEach((_, i) => add(A.clue(M.m1, q.id, i, 256), q.id + ' clue' + i));
    for (const s of M.m1.scenes) for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) add(A.scene(M.m1, s.id, o, 320), s.id + ' ' + o);
    add(A.scene(M.tutorial, 'T1', 'neutral', 320), 'T1');
    document.body.append(sheet);
    return out;
  });
  await page.screenshot({ path: shotPath('cardart') });

  // 2 임무(spec §7): 물건 카드·가짜·컨베이어 변형·이름표 아이콘 7종·선별장 컷 — 시트는 따로(_shot-cardart-m2.png)
  const r2 = await page.evaluate(() => {
    document.querySelectorAll('body > div[style*="z-index:99"]').forEach((e) => e.remove());
    const A = DR.CardArt, M = DR.Missions, m2 = M.m2;
    const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const std = (c) => { const d = px(c); let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; } return Math.sqrt(s2 / n - (s / n) ** 2); };
    const out = { bad: [], scenes: 0, variantDiff: [] };
    const ids = [...Object.keys(m2.cardTypes), ...m2.fakes.map((f) => f.id)];
    for (const id of ids) for (const v of [0, 1, 2]) if (std(A.card(m2, id, v, 256)) <= 10) out.bad.push(id + ' v' + v);
    for (const it of m2.conveyor) if (std(A.card(m2, it.art, it.variant, 256)) <= 10) out.bad.push(it.id);
    for (const k of Object.keys(m2.cardTypes)) if (A.card(m2, k, 0, 256).toDataURL() === A.card(m2, k, 3, 256).toDataURL()) out.variantDiff.push(k);
    const icons = ['day', 'night', 'flood_deep', 'flood_shallow', 'wet', 'dry', 'unknown', 'dog', 'cat', ...m2.labels.map((l) => l.id)];
    out.iconUnique = new Set(icons.map((n) => A.icon(n, 64).toDataURL())).size;
    out.iconStd = m2.labels.filter((l) => std(A.icon(l.id, 64)) > 10).length;
    for (const s of m2.scenes) for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) if (std(A.scene(m2, s.id, o, 320)) > 10) out.scenes++;
    out.outcomesDiffer = new Set(['neutral', 'pass', 'danger', 'inconvenience'].map((o) => A.scene(m2, 'S4', o, 320).toDataURL())).size;

    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99;background:#111;display:flex;flex-wrap:wrap;gap:6px;padding:6px;overflow:hidden';
    const add = (c, label, w = 112) => { const f = document.createElement('figure'); f.style.cssText = 'margin:0;color:#fff;font:11px sans-serif'; c.style.width = w + 'px'; c.style.height = w + 'px'; f.append(c, Object.assign(document.createElement('figcaption'), { textContent: label })); sheet.append(f); };
    for (const id of ids) add(A.card(m2, id, 0, 256), id);
    for (const id of ['can_drink', 'pet_clear', 'paper_news', 'trash_misc', 'battery_aa']) add(A.card(m2, id, 1, 256), id + ' v1');
    for (const id of ['paper_news', 'trash_misc']) add(A.card(m2, id, 2, 256), id + ' v2');
    for (const it of m2.conveyor.slice(0, 6)) add(A.card(m2, it.art, it.variant, 256), it.id + ' ' + it.art);
    // 24칸 썸네일에서 헷갈리기 쉬운 짝: 영수증↔종이, 칫솔↔페트, 건전지↔캔
    for (const id of ['f_receipt', 'paper_news', 'f_toothbrush', 'pet_clear', 'battery_aa', 'can_drink', 'can_tin', 'pack_milk']) add(A.thumb(A.card(m2, id, 0, 256), 24), 'thumb ' + id, 80);
    for (const l of m2.labels) add(A.icon(l.id, 64), l.text, 56);
    for (const s of m2.scenes) for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) add(A.scene(m2, s.id, o, 320), s.id + ' ' + o, 150);
    document.body.append(sheet);
    return out;
  });
  await page.screenshot({ path: shotPath('cardart-m2') });
  assert.deepEqual(r2.bad, [], 'm2 blank art');
  assert.deepEqual(r2.variantDiff, [], 'm2 variant 0 vs 3');
  assert.equal(r2.iconUnique, 16, 'icons unique');
  assert.equal(r2.iconStd, 7, 'm2 icons drawn');
  assert.equal(r2.scenes, 16, 'm2 scenes');
  assert.equal(r2.outcomesDiffer, 4, 'm2 outcomes differ');

  assert.deepEqual(r.bad, []);
  assert.ok(r.sizes.every((s) => s === '256x256'), r.sizes.join());
  assert.ok(r.variantDiffers, 'variant');
  assert.ok(r.cached, 'cache');
  assert.ok(r.waterDiff > 10, 'water layer ' + r.waterDiff);
  assert.equal(r.iconUnique, 9);
  assert.ok(r.thumbInt, 'thumb size');
  assert.equal(r.thumbBlock, 1, 'pixel block');
  assert.equal(r.scenes, 16);
  assert.ok(r.tutScene);
  assert.equal(r.clues, r.clueTotal);
  assert.deepEqual(errors, []);
  console.log('PASS cardart');
} finally { await browser.close(); }
