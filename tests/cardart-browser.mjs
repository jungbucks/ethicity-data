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
    const ids = [...Object.keys(M.flood.cardTypes), ...M.flood.ambiguous.map((a) => a.id), ...M.flood.fakes.map((f) => f.id)];
    for (const id of ids) { const c = A.card(M.flood, id, 0, 256); out.sizes.push(c.width + 'x' + c.height); if (std(c) <= 10) out.bad.push(id); }
    for (const id of Object.keys(M.tutorial.cardTypes)) { const c = A.card(M.tutorial, id, 0, 256); if (std(c) <= 10) out.bad.push(id); }
    out.variantDiffers = A.card(M.flood, 'day_deep', 0, 256).toDataURL() !== A.card(M.flood, 'day_deep', 1, 256).toDataURL();
    out.cached = A.card(M.flood, 'day_deep', 0, 256) === A.card(M.flood, 'day_deep', 0, 256);
    const a = lowerMean(A.card(M.flood, 'day_dry', 0, 256)), b = lowerMean(A.card(M.flood, 'day_deep', 0, 256));
    out.waterDiff = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    const icons = ['day', 'night', 'flood_deep', 'flood_shallow', 'wet', 'dry', 'unknown', 'dog', 'cat'];
    out.iconUnique = new Set(icons.map((n) => A.icon(n, 64).toDataURL())).size;
    const t = A.thumb(A.card(M.flood, 'night_wet', 0, 256), 24);
    const k = t.width / 24, d = px(t), cell = [];
    for (let y = 5 * k; y < 6 * k; y++) for (let x = 5 * k; x < 6 * k; x++) { const i = (y * t.width + x) * 4; cell.push(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); }
    out.thumbInt = Number.isInteger(k);
    out.thumbBlock = new Set(cell).size;
    out.scenes = 0;
    for (const s of M.flood.scenes) for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) if (std(A.scene(M.flood, s.id, o, 320)) > 10) out.scenes++;
    out.tutScene = std(A.scene(M.tutorial, 'T1', 'neutral', 320)) > 10;
    out.clues = 0;
    for (const q of M.flood.ambiguous) q.clues.forEach((_, i) => { if (std(A.clue(M.flood, q.id, i, 256)) > 5) out.clues++; });
    out.clueTotal = M.flood.ambiguous.reduce((n, q) => n + q.clues.length, 0);

    // 사람 눈 확인용 시트
    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99;background:#111;display:flex;flex-wrap:wrap;gap:6px;padding:6px;overflow:hidden';
    const add = (c, label) => { const f = document.createElement('figure'); f.style.cssText = 'margin:0;color:#fff;font:11px sans-serif'; c.style.width = '128px'; c.style.height = '128px'; f.append(c, Object.assign(document.createElement('figcaption'), { textContent: label })); sheet.append(f); };
    for (const id of ids) add(A.card(M.flood, id, 0, 256), id);
    for (const id of ['day_deep', 'night_wet']) add(A.card(M.flood, id, 1, 256), id + ' v1');
    add(A.thumb(A.card(M.flood, 'night_neon', 0, 256), 24), 'thumb neon');
    for (const f of M.flood.fakes) add(A.thumb(A.card(M.flood, f.id, 0, 256), 24), 'thumb ' + f.id);
    for (const id of Object.keys(M.tutorial.cardTypes)) add(A.card(M.tutorial, id, 0, 256), id);
    for (const n of icons) add(A.icon(n, 64), n);
    for (const q of M.flood.ambiguous) q.clues.forEach((_, i) => add(A.clue(M.flood, q.id, i, 256), q.id + ' clue' + i));
    for (const s of M.flood.scenes) for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) add(A.scene(M.flood, s.id, o, 320), s.id + ' ' + o);
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
    // [2] 1 임무 S1 불편 컷 = 물 없는 옆 골목(물에 잠긴 컷과 아래쪽 색이 다르다)
    const low = (cv) => { const d = px(cv), w = cv.width, h = cv.height; let r = 0, g = 0, b = 0, n = 0; for (let y = Math.floor(h * 2 / 3); y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } return [r / n, g / n, b / n]; };
    const wet = low(A.scene(M.flood, 'S1', 'danger', 320)), dry = low(A.scene(M.flood, 'S1', 'inconvenience', 320));
    out.s1Dry = Math.abs(wet[0] - dry[0]) + Math.abs(wet[1] - dry[1]) + Math.abs(wet[2] - dry[2]);
    // 컨베이어 건전지(변형 3·4)는 학습 카드(0~2)와 다른 모양
    out.batteryDiff = [3, 4, 5, 6].every((v) => [0, 1, 2].every((w) => ['battery_aa', 'f_battery'].every((id) => A.card(m2, 'battery_aa', v, 256).toDataURL() !== A.card(m2, id, w, 256).toDataURL())));

    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99;background:#111;display:flex;flex-wrap:wrap;gap:6px;padding:6px;overflow:hidden';
    const add = (c, label, w = 112) => { const f = document.createElement('figure'); f.style.cssText = 'margin:0;color:#fff;font:11px sans-serif'; c.style.width = w + 'px'; c.style.height = w + 'px'; f.append(c, Object.assign(document.createElement('figcaption'), { textContent: label })); sheet.append(f); };
    for (const id of ids) add(A.card(m2, id, 0, 256), id);
    for (const id of ['can_drink', 'pet_clear', 'paper_news', 'trash_misc', 'battery_aa']) add(A.card(m2, id, 1, 256), id + ' v1');
    for (const id of ['paper_news', 'trash_misc']) add(A.card(m2, id, 2, 256), id + ' v2');
    for (const it of m2.conveyor.slice(0, 6)) add(A.card(m2, it.art, it.variant, 256), it.id + ' ' + it.art);
    for (const v of [3, 4]) add(A.card(m2, 'battery_aa', v, 256), 'conveyor battery v' + v);
    add(A.scene(M.flood, 'S1', 'inconvenience', 320), 'm1 S1 inconvenience', 150);
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
  assert.ok(r2.s1Dry > 10, 'm1 S1 inconvenience shows a dry alley ' + r2.s1Dry);
  assert.ok(r2.batteryDiff, 'conveyor batteries differ from training cards');

  // 3 임무: 거리 풍경 카드(지금·옛·비·밤·저녁) = 사진(assets/cards/city/, Codex 2026-11-08), 장소 아이콘 4종, 길 안내 결과 컷(Canvas) — 시트 _shot-cardart-m3.png
  // 카드 그림이 사진이라 사진이 다 온 뒤에 잰다(그 전엔 Canvas로 그려져 비교가 섞임)
  await page.waitForFunction(() => DR.CardArt.photosReady(), null, { timeout: 15000 });
  const r3 = await page.evaluate(async () => {
    document.querySelectorAll('body > div[style*="z-index:99"]').forEach((e) => e.remove());
    const A = DR.CardArt, M = DR.Missions, m3 = M.m3;
    const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const std = (c) => { const d = px(c); let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; } return Math.sqrt(s2 / n - (s / n) ** 2); };
    const out = { bad: [], scenes: 0 };
    const ids = [...Object.keys(m3.cardTypes), ...m3.fakes.map((f) => f.id)];
    for (const id of ids) for (const v of [0, 1, 2]) if (std(A.card(m3, id, v, 256)) <= 10) out.bad.push(id + ' v' + v);
    const icons = ['day', 'night', 'flood_deep', 'flood_shallow', 'wet', 'dry', 'unknown', 'dog', 'cat', ...M.m2.labels.map((l) => l.id), ...m3.labels.map((l) => l.id)];
    out.iconUnique = new Set(icons.map((n) => A.icon(n, 64).toDataURL())).size;
    for (const s of m3.scenes) for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) if (std(A.scene(m3, s.id, o, 320)) > 10) out.scenes++;
    out.outcomesDiffer = new Set(['neutral', 'pass', 'danger', 'inconvenience'].map((o) => A.scene(m3, 'S4', o, 320).toDataURL())).size;
    // 바뀌기 전 사진은 그림 내용이 다르다(같은 장소 지금 사진과 픽셀이 많이 다름)
    const diff = (a, b) => { const x = px(a), y = px(b); let d = 0; for (let i = 0; i < x.length; i += 4) d += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); return d / (x.length / 4); };
    out.oldDiff = ['station', 'river', 'crossing'].map((p) => diff(A.card(m3, p + '_now', 0, 128), A.card(m3, 'o_' + p, 0, 128)));
    // 한 장면의 두 조합(지금 / 비·밤·저녁)은 이름표가 같다(장소) → 그림만 보고 한눈에 구별돼야 한다(달리는 중 카드·작은 썸네일 모두).
    // 버그(사용자 2026-11-02): '비 오는 학교 앞'이 맑은 날 횡단보도와 거의 같아(차이 35, 다른 장면은 300+) '비 오는 날 카드가 안 나온다'고 느꼈다
    out.condDiff = m3.scenes.map((sc) => {
      const [a, b] = sc.combos.map((cb) => cb.keys[0]);
      return { scene: sc.id, a, b, min: Math.min(...[0, 1, 2].map((v) => diff(A.card(m3, a, v, 128), A.card(m3, b, v, 128))), diff(A.thumb(A.card(m3, a, 0, 256), 24), A.thumb(A.card(m3, b, 0, 256), 24))) };
    });
    // 모든 카드 종류·옛 사진(가짜)·개인정보 카드 = 사진(한 임무 전체를 한꺼번에 — 일부만 사진이면 그림 방식 차이가 가짜 단서)
    out.notPhoto = ids.concat(m3.privacy.cards.map((d) => d.id)).filter((id) => !A.card(m3, id, 0, 256, 1).photo);
    out.photoIds = ids.map((id) => A.card(m3, id, 1, 256, 5).photo);
    // 가린 개인정보 카드: 같은 사진 위에 가림(흐리게·막대)이 얹혀 있다
    out.masked = m3.privacy.cards.map((d) => { const p = A.card(m3, d.id, 0, 256, 4), mk = A.card(m3, d.id + '#masked', 0, 256, 4); return { id: d.id, photo: p.photo, maskedPhoto: mk.photo, diff: diff(p, mk) }; });
    // 사진을 못 읽음 → 그 카드는 Canvas 거리 그림(분실물 대체 그림이 아님), 가린 모습은 canvasMask 자리
    const keep = { s: A._photos.station_now, p: A._photos.station_plate };
    const bad = new Image(); A._photos.station_now = bad; A._photos.station_plate = bad;
    await new Promise((res) => { bad.onerror = res; bad.onload = res; bad.src = 'assets/cards/city/__missing.webp'; });
    const fb = A.card(m3, 'station_now', 0, 256), fbp = A.card(m3, 'p_station_plate', 0, 256), fbm = A.card(m3, 'p_station_plate#masked', 0, 256);
    const rg = (c, r) => { const d = c.getContext('2d').getImageData(Math.round(r.x * 256), Math.round(r.y * 256), Math.round(r.w * 256), Math.round(r.h * 256)).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += (d[i] + d[i + 1] + d[i + 2]) / 3; return t / (d.length / 4); };
    const cm = m3.privacy.cards[1].canvasMask[0], inner = { x: cm.x + cm.w * 0.12, y: cm.y + cm.h * 0.12, w: cm.w * 0.76, h: cm.h * 0.76 };
    out.fallback = { photo: fb.photo || '', std: std(fb), plateStd: std(fbp), plateMean: rg(fbp, inner), maskedMean: rg(fbm, inner) };
    A._photos.station_now = keep.s; A._photos.station_plate = keep.p;
    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99;background:#111;display:flex;flex-wrap:wrap;gap:6px;padding:6px;overflow:hidden';
    const add = (c, label, w = 112) => { const f = document.createElement('figure'); f.style.cssText = 'margin:0;color:#fff;font:11px sans-serif'; c.style.width = w + 'px'; c.style.height = w + 'px'; f.append(c, Object.assign(document.createElement('figcaption'), { textContent: label })); sheet.append(f); };
    for (const id of ids) add(A.card(m3, id, 0, 256), id);
    for (const id of ['station_now', 'market_old', 'crossing_now']) add(A.card(m3, id, 1, 256), id + ' v1');
    for (const id of ['station_now', 'o_station', 'river_now', 'o_river', 'crossing_now', 'o_crossing', 'market_now', 'market_old']) add(A.thumb(A.card(m3, id, 0, 256), 24), 'thumb ' + id, 80);
    for (const d of m3.privacy.cards) { add(A.card(m3, d.id, 0, 256, 4), d.id); add(A.card(m3, d.id + '#masked', 0, 256, 4), d.id + ' 가림'); }
    add(fb, 'station_now 대체(Canvas)'); add(fbm, 'plate 대체 가림');
    for (const l of m3.labels) add(A.icon(l.id, 64), l.text, 56);
    for (const s of m3.scenes) for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) add(A.scene(m3, s.id, o, 320), s.id + ' ' + o, 130);
    document.body.append(sheet);
    return out;
  });
  await page.screenshot({ path: shotPath('cardart-m3') });
  assert.deepEqual(r3.bad, [], 'm3 blank art');
  assert.equal(r3.iconUnique, 20, 'icons unique incl. m3');
  assert.equal(r3.scenes, 16, 'm3 scenes');
  assert.equal(r3.outcomesDiffer, 4, 'm3 outcomes differ');
  assert.ok(r3.oldDiff.every((d) => d > 15), 'old photos show the old landmark ' + r3.oldDiff.map((d) => d.toFixed(1)));
  console.log('m3 oldDiff', r3.oldDiff.map((d) => d.toFixed(1)).join(' '), '| condDiff', r3.condDiff.map((c) => c.scene + ' ' + c.min.toFixed(1)).join(' '));
  // 문턱 150 → 100(2026-11-08 사진으로 바뀌며): Canvas 때 버그 = 35, 나머지 300+. 사진은 같은 골목의 낮 ↔ 저녁(등불·노을빛) 144, 맑은 ↔ 비 오는 학교 앞 112(S1·S3는 300+) —
  // 눈으로 보면 한눈에 다르다(_shot-cardart-m3.png). 35 같은 '거의 같은 그림'은 여전히 걸러진다
  for (const c of r3.condDiff) assert.ok(c.min > 100,'scene condition visible at a glance: ' + c.scene + ' ' + c.a + ' vs ' + c.b + ' = ' + c.min.toFixed(1));
  assert.deepEqual(r3.notPhoto, [], 'every m3 card kind, outdated photo and private card is a photo');
  assert.deepEqual(r3.photoIds, ['station_now', 'station_rain', 'market_now', 'market_old', 'market_eve_old', 'river_now', 'river_night', 'crossing_now', 'crossing_rain', 'station_old', 'river_old', 'crossing_old']);
  assert.deepEqual(r3.masked.map((m) => [m.id, m.photo, m.maskedPhoto]), [['p_river_people', 'river_people', 'river_people'], ['p_station_plate', 'station_plate', 'station_plate']]);
  for (const m of r3.masked) assert.ok(m.diff > 0.3, m.id + ' masked version drawn: ' + m.diff);
  assert.equal(r3.fallback.photo, '', 'missing m3 photo → Canvas');
  assert.ok(r3.fallback.std > 10 && r3.fallback.plateStd > 10, 'Canvas street art drawn ' + JSON.stringify(r3.fallback));
  assert.ok(r3.fallback.plateMean > 60 && r3.fallback.maskedMean < 40, 'Canvas fallback plate covered by canvasMask ' + JSON.stringify(r3.fallback));

  // 4 임무: 손글씨 답안(같은 붓), 번호 아이콘 7종, "?" 단서, 채점 결과 컷, 결판 선배 답안 — 시트 _shot-cardart-m4.png(24칸 썸네일 = 게임 크기)
  const r4 = await page.evaluate(() => {
    document.querySelectorAll('body > div[style*="z-index:99"]').forEach((e) => e.remove());
    const A = DR.CardArt, M = DR.Missions, m4 = M.m4;
    const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const std = (c) => { const d = px(c); let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; } return Math.sqrt(s2 / n - (s / n) ** 2); };
    const diff = (a, b) => { const x = px(a), y = px(b); let d = 0; for (let i = 0; i < x.length; i += 4) d += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); return d / (x.length / 4); };
    const out = { bad: [], scenes: 0, clues: 0 };
    const ids = [...Object.keys(m4.cardTypes), ...m4.fakes.map((f) => f.id), ...m4.ambiguous.map((a) => a.id)];
    for (const id of ids) for (const v of [0, 1, 2]) if (std(A.card(m4, id, v, 256)) <= 10) out.bad.push(id + ' v' + v);
    out.variantDiff = A.card(m4, 'neat_3', 0, 256).toDataURL() !== A.card(m4, 'neat_3', 1, 256).toDataURL();
    const digits = ['1', '2', '3', '4', '5', '7', '8'];
    out.iconUnique = new Set(digits.map((n) => A.icon(n, 64).toDataURL())).size;
    for (const s of m4.scenes) for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) if (std(A.scene(m4, s.id, o, 320)) > 10) out.scenes++;
    out.outcomesDiffer = new Set(['neutral', 'pass', 'danger', 'inconvenience'].map((o) => A.scene(m4, 'S4', o, 320).toDataURL())).size;
    for (const q of m4.ambiguous) q.clues.forEach((_, i) => { if (std(A.clue(m4, q.id, i, 256)) > 5) out.clues++; });
    out.sheets = [true, false, null].map((x) => A.sheet(m4, 'senior', x, 360).toDataURL()).length === 3 && A.sheet(m4, 'senior', true, 360) !== A.sheet(m4, 'senior', false, 360);
    // 닮은 짝은 썸네일에서 서로 다르다(같은 그림이 아니다)
    const T = (id) => A.thumb(A.card(m4, id, 0, 256), 24);
    out.pairs = [['neat_1', 'flag_1'], ['flag_1', 'slant_1'], ['neat_3', 'loop_3'], ['angular_2', 'round_5'], ['neat_2', 'angular_2']].map(([a, b]) => diff(T(a), T(b)));
    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99;background:#111;display:flex;flex-wrap:wrap;gap:6px;padding:6px;overflow:hidden';
    const add = (c, label, w = 112) => { const f = document.createElement('figure'); f.style.cssText = 'margin:0;color:#fff;font:11px sans-serif'; c.style.width = w + 'px'; c.style.height = w + 'px'; f.append(c, Object.assign(document.createElement('figcaption'), { textContent: label })); sheet.append(f); };
    // 큰 그림(크게 보기 크기 비슷)
    for (const id of ids) add(A.card(m4, id, 0, 256), id, 120);
    for (const id of ['flag_1', 'slant_1', 'loop_3']) add(A.card(m4, id, 1, 256), id + ' v1', 120);
    // 24칸 썸네일 = 검수 격자·달리기 카드와 같은 크기: 1·7(깃발 1), 3·8(고리 3), 2·5 짝을 나란히
    for (const id of ['neat_1', 'flag_1', 'slant_1', 'x_17', 'neat_3', 'loop_3', 'x_38', 'neat_2', 'angular_2', 'x_25', 'neat_5', 'round_5', 'neat_4', 'table_4', 'x_scribble', 'q_25', 'q_35']) add(T(id), 't ' + id, 72);
    for (const n of digits) add(A.icon(n, 64), n, 40);
    for (const q of m4.ambiguous) q.clues.forEach((_, i) => add(A.clue(m4, q.id, i, 256), q.id + ' clue' + i, 100));
    for (const o of ['neutral', 'pass', 'danger', 'inconvenience']) add(A.scene(m4, 'S2', o, 320), 'S2 ' + o, 100);
    for (const s of ['S1', 'S3', 'S4']) add(A.scene(m4, s, 'neutral', 320), s, 100);
    add(A.sheet(m4, 'senior', false, 360), 'senior ✕', 140); add(A.sheet(m4, 'senior', true, 360), 'senior ○', 140);
    document.body.append(sheet);
    return out;
  });
  await page.screenshot({ path: shotPath('cardart-m4') });

  // 튜토리얼 개·고양이 = 사진(assets/cards/animals/, 카드 번호 % 8) · 썸네일 48칸 · 사진을 못 읽으면 Canvas 그림
  await page.waitForFunction(() => DR.CardArt.photosReady(), null, { timeout: 10000 });
  const rt = await page.evaluate(async () => {
    document.querySelectorAll('body > div[style*="z-index:99"]').forEach((e) => e.remove());
    const A = DR.CardArt, t = DR.Missions.tutorial;
    const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const std = (c) => { const d = px(c); let s = 0, s2 = 0; const n = d.length / 4; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; } return Math.sqrt(s2 / n - (s / n) ** 2); };
    const out = {};
    out.dogs = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => A.card(t, 'dog', n % 3, 256, n).photo);
    out.cats = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => A.card(t, 'cat', n % 3, 256, n).photo);
    out.noN = A.card(t, 'dog', 1, 256).photo; // 번호 없이 부르면 variant로 고름
    out.std = std(A.card(t, 'cat', 0, 256, 3));
    const th = A.thumb(A.card(t, 'dog', 0, 192, 4), 24);
    out.thumb = th.width + 'x' + th.height;
    out.m1NotPhoto = !A.card(DR.Missions.flood, 'day_deep', 0, 256, 5).photo;
    // 2 임무 분리배출 사진(assets/cards/recycle/, Codex 2026-11-08): 14장이 다 와야 m2 데이터에 켠다 — 지금은 모두 Canvas.
    // 사진 구조 자체는 가짜 임무로 확인: art.photo / art.photos(카드 번호로 번갈아) / variant 3↑(컨베이어 '처음 보는 물건') = Canvas 물건 그림
    const m2 = DR.Missions.m2;
    out.m2 = Object.keys(m2.cardTypes).concat(m2.fakes.map((f) => f.id)).filter((id) => !A.card(m2, id, 0, 256, 1).photo); // 사진이 아닌 카드(없어야 함)
    out.m2trash = [0, 1, 2, 3].map((n) => A.card(m2, 'trash_misc', 0, 256, n).photo);
    out.m2fakes = ['f_receipt', 'f_toothbrush', 'f_battery'].map((id) => A.card(m2, id, 0, 256, 1).photo);
    const fake = { id: 'zz', cardTypes: { a: { art: { object: 'can_drink', photo: 'can_drink' } }, p: { art: { object: 'paper_news', photos: ['paper_news', 'paper_box'] } } } };
    out.m2photo = A.card(fake, 'a', 0, 256, 1).photo;
    out.m2paper = [0, 1, 2].map((n) => A.card(fake, 'p', 0, 256, n).photo);
    const cv = A.card(fake, 'a', 3, 256);
    out.m2conveyor = { photo: cv.photo || '', std: std(cv) };
    // 사진을 못 읽음(없는 파일) → 그 번호의 카드는 Canvas 그림(빈 그림 아님), 다른 사진은 그대로
    const keep = A._photos.d03;
    const bad = new Image(); A._photos.d03 = bad;
    await new Promise((res) => { bad.onerror = res; bad.onload = res; bad.src = 'assets/cards/animals/__missing.webp'; });
    const fb = A.card(t, 'dog', 2, 256, 2);
    out.fallback = { photo: fb.photo || '', std: std(fb), id: A.photoId(t, 'dog', 2), other: A.card(t, 'dog', 0, 256, 3).photo };
    A._photos.d03 = keep;
    // 사람 눈 시트: 사진 16장(384 → 128) + 48칸 썸네일 + 대비용 Canvas 그림
    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99;background:#111;display:flex;flex-wrap:wrap;gap:6px;padding:6px;overflow:hidden';
    const add = (c, label, w = 128) => { const f = document.createElement('figure'); f.style.cssText = 'margin:0;color:#fff;font:11px sans-serif'; c.style.width = w + 'px'; c.style.height = w + 'px'; c.style.imageRendering = 'pixelated'; f.append(c, Object.assign(document.createElement('figcaption'), { textContent: label })); sheet.append(f); };
    for (let n = 0; n < 8; n++) add(A.card(t, 'dog', n % 3, 256, n), 'dog n' + n);
    for (let n = 0; n < 8; n++) add(A.card(t, 'cat', n % 3, 256, n), 'cat n' + n);
    for (let n = 0; n < 4; n++) add(A.thumb(A.card(t, n % 2 ? 'cat' : 'dog', 0, 192, n), 24), 'thumb48 n' + n, 96);
    add(fb, 'fallback(Canvas)');
    document.body.append(sheet);
    return out;
  });
  await page.screenshot({ path: shotPath('cardart-tutorial') });
  assert.deepEqual(rt.dogs, ['d01', 'd02', 'd03', 'd04', 'd05', 'd06', 'd07', 'd08', 'd01'], 'dog photos by card number');
  assert.deepEqual(rt.cats, ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08'], 'cat photos by card number');
  assert.equal(rt.noN, 'd02');
  assert.ok(rt.std > 10, 'photo not blank');
  assert.equal(rt.thumb, '192x192', 'photo thumb = 48 cells × 4');
  assert.ok(rt.m1NotPhoto, 'other missions keep Canvas art');
  assert.deepEqual(rt.m2, [], 'every m2 card kind and fake is a photo (14 arrived 2026-11-08)');
  assert.deepEqual(rt.m2trash, ['trash_glove', 'trash_sponge', 'trash_tissue', 'trash_glove'], 'general trash rotates by card number');
  assert.deepEqual(rt.m2fakes, ['receipt', 'toothbrush', 'battery_aa']);
  assert.equal(rt.m2photo, 'can_drink');
  assert.deepEqual(rt.m2paper, ['paper_news', 'paper_box', 'paper_news'], 'newspaper and box alternate');
  assert.equal(rt.m2conveyor.photo, '', 'conveyor variant = Canvas');
  assert.ok(rt.m2conveyor.std > 30, 'conveyor object drawn, not a gray box: ' + rt.m2conveyor.std);
  assert.equal(rt.fallback.photo, '', 'missing photo → Canvas art');
  assert.equal(rt.fallback.id, '');
  assert.ok(rt.fallback.std > 10, 'fallback art drawn');
  assert.equal(rt.fallback.other, 'd04', 'other photos still used');
  // 일부러 없앤 사진 파일만 허용
  for (let i = errors.length - 1; i >= 0; i--) if (/__missing\.webp/.test(errors[i])) errors.splice(i, 1);
  assert.deepEqual(r4.bad, [], 'm4 blank art');
  assert.ok(r4.variantDiff, 'm4 variants differ');
  assert.equal(r4.iconUnique, 7, 'digit icons unique');
  assert.equal(r4.scenes, 16, 'm4 scenes');
  assert.equal(r4.outcomesDiffer, 4, 'm4 outcomes differ');
  assert.equal(r4.clues, 4, 'm4 clues');
  assert.ok(r4.sheets, 'senior sheet read/unread');
  assert.ok(r4.pairs.every((d) => d > 3), 'look-alike pairs still differ ' + r4.pairs.map((d) => d.toFixed(1)));
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
