// 빛의 다리 겉모습 데이터(설계 2026-11-07): 바닥 위에서 카드·벽이 잘 보이는지(대비), 임무·구역별 모습
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../js/bridge-look.js');
const CARD = '#f4f1ff', WALL = '#ff5fb0';

test('night deck: card ≥ 7, wall ≥ 4.5, edge brighter than lane', () => {
  assert.ok(L.contrast(CARD, L.PALETTE.night.deck) >= 7);
  assert.ok(L.contrast(WALL, L.PALETTE.night.deck) >= 4.5);
  assert.ok(L.PALETTE.night.edgeOpacity > L.PALETTE.night.laneOpacity);
});

test('day deck: darker than sky, card ≥ 4.5, wall ≥ 2.2', () => {
  assert.ok(L.contrast(L.PALETTE.day.deck, '#8fc8e8') >= 1.4, 'deck darker than sky');
  assert.ok(L.contrast(CARD, L.PALETTE.day.deck) >= 4.5);
  assert.ok(L.contrast(WALL, L.PALETTE.day.deck) >= 2.2);
});

// 리뷰 I1: 실제 벽은 반투명(opacity) 노이즈(흰·분홍·진분홍)라 섞인 색으로 재야 한다
const blend = (fg, bg, a) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, '0')).join('');
for (const time of ['night', 'day']) {
  test(time + ' wall as drawn (noise colors blended at wall opacity): every cell ≥ 2, mean ≥ 2.5', () => {
    const P = L.PALETTE[time], cs = P.wall.noise.map((c) => L.contrast(blend(c, P.deck, P.wall.opacity), P.deck));
    assert.ok(cs.every((c) => c >= 2), time + ' cells ' + cs.map((c) => c.toFixed(2)));
    assert.ok(cs.reduce((a, b) => a + b, 0) / cs.length >= 2.5, time + ' mean');
  });
}
test('night wall keeps the original look (opacity 0.72, white/pink/magenta)', () => {
  assert.equal(L.PALETTE.night.wall.opacity, 0.72);
  assert.deepEqual(L.PALETTE.night.wall.noise, ['#ffffff', '#ff5fb0', '#c2307f']);
});

test('contrast is symmetric and 21 for black/white', () => {
  assert.equal(Math.round(L.contrast('#000000', '#ffffff')), 21);
  assert.equal(L.contrast('#16162f', '#ff5fb0'), L.contrast('#ff5fb0', '#16162f'));
});

test('looks: tutorial night, m1 3 distinct night zones, m3 4 day zones with props', () => {
  assert.equal(L.look('tutorial', null).time, 'night');
  const m1 = ['S1', 'S2', 'S3'].map((z) => L.look('m1', z));
  assert.ok(m1.every((l) => l.time === 'night'));
  assert.equal(new Set(m1.map((l) => l.tint + '|' + l.lightMix.join())).size, 3);
  const m3 = ['S1', 'S2', 'S3', 'S4'].map((z) => L.look('m3', z));
  assert.ok(m3.every((l) => l.time === 'day'));
  assert.deepEqual(m3.map((l) => l.rain), [false, false, false, true]);
  assert.ok(m3[1].lanterns && m3[1].tint, 'S2 evening');
  assert.ok(m3[2].river);
  assert.ok(m3[3].wet);
  assert.ok(m1.concat(m3).every((l) => Math.abs(l.lightMix.reduce((a, b) => a + b, 0) - 1) < 1e-9));
  assert.equal(L.look('m9', 'S1').id, L.look('tutorial', null).id, 'unknown → tutorial look');
  assert.equal(L.look('m3', 'S9').id, L.look('m3', 'S1').id, 'unknown zone of a known mission → its first zone');
});

// 2차 실내 무대(설계 2026-11-08 실내 무대, 2026-11-09): 실제 장소 색 — 보라는 1차 데이터 세계(다리)만. 바닥은 카드보다 어둡게
const hue = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return null;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const sat = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return (Math.max(...v) - Math.min(...v)) / 255; };
const notPurple = (hex) => { const h = hue(hex); return h === null || sat(hex) < 0.12 || h < 245 || h > 325; };
const ROOMS = ['sorting', 'grading', 'office'];
for (const room of ROOMS) {
  test(room + ' floor: dark under white cards (≥ 4.5), pink walls readable (blended, each ≥ 2, mean ≥ 2.5), real-place colors (no purple)', () => {
    const P = L.PALETTE[room];
    assert.ok(P, room);
    assert.ok(L.contrast(CARD, P.deck) >= 4.5, 'card ' + L.contrast(CARD, P.deck).toFixed(2));
    assert.ok(L.contrast(CARD, P.ground) >= 2.5, 'card vs floor beside the belt');
    const cs = P.wall.noise.map((c) => L.contrast(blend(c, P.deck, P.wall.opacity), P.deck));
    assert.ok(cs.every((c) => c >= 2), room + ' cells ' + cs.map((c) => c.toFixed(2)));
    assert.ok(cs.reduce((a, b) => a + b, 0) / cs.length >= 2.5, room + ' mean');
    for (const k of ['deck', 'seam', 'lane', 'edge', 'side', 'fog', 'ground']) assert.ok(notPurple(P[k]), room + ' ' + k + ' ' + P[k] + ' is purple');
    assert.ok(L.contrast(P.deck, P.fog) >= 1.5, 'belt darker than the far floor/fog (reads as a lane)');
    assert.ok(P.edgeOpacity > P.laneOpacity);
  });
}
test('rooms: sorting = dark green rubber belt, grading = dark navy belt, office = darker and warmer than grading', () => {
  assert.ok(hue(L.PALETTE.sorting.deck) > 90 && hue(L.PALETTE.sorting.deck) < 170, 'green');
  assert.ok(hue(L.PALETTE.grading.deck) > 195 && hue(L.PALETTE.grading.deck) < 240, 'navy');
  const o = hue(L.PALETTE.office.deck);
  assert.ok(o < 45 || o > 345, 'warm');
  assert.ok(L.contrast(L.PALETTE.office.fog, '#000000') < L.contrast(L.PALETTE.grading.fog, '#000000'), 'office darker');
});
test('bins keep the card-border hue (intended cue) but sit darker than the cards', () => {
  for (const c of ['#d9534f', '#3a8fd9', '#25bdb0', '#c9a227', '#d977a8', '#2fae6b', '#7d8290']) {
    const d = L.dimBin(c);
    assert.ok(Math.abs((hue(d) ?? 0) - (hue(c) ?? 0)) < 2, c + ' hue kept');
    assert.ok(L.contrast(d, '#000000') < L.contrast(c, '#000000'), c + ' darker');
  }
});
test('indoor looks: m2 four sorting-hall zones, m4 S1–S3 grading centre + S4 teachers\' office, day city through the windows', () => {
  const m2 = ['S1', 'S2', 'S3', 'S4'].map((z) => L.look('m2', z));
  assert.ok(m2.every((l) => l.room === 'sorting' && l.time === 'day' && l.art === 'assets/title/int-sorting.webp'));
  assert.equal(new Set(m2.map((l) => l.id)).size, 4);
  assert.equal(new Set(m2.map((l) => l.window)).size, 4, 'afternoon light shifts a little per zone');
  const m4 = ['S1', 'S2', 'S3', 'S4'].map((z) => L.look('m4', z));
  assert.deepEqual(m4.map((l) => l.room), ['grading', 'grading', 'grading', 'office']);
  assert.equal(m4[0].art, 'assets/title/int-grading.webp');
  assert.equal(m4[3].art, 'assets/title/int-teachers-office.webp');
  assert.ok(m2.concat(m4).every((l) => l.time === 'day' && !l.rain && l.window), 'day city + time-of-day tint');
  assert.ok(m2.concat(m4).every((l) => notPurple('#' + l.window.match(/\d+/g).slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join(''))), 'tints are real light, not purple');
  assert.deepEqual(L.INDOOR_ART.sort(), ['assets/title/int-grading.webp', 'assets/title/int-sorting.webp', 'assets/title/int-teachers-office.webp']);
  assert.equal(L.look('m4', 'S9').id, L.look('m4', 'S1').id);
  // 1차 모습은 그대로
  assert.equal(L.look('tutorial', null).room, undefined);
  assert.equal(L.look('m3', 'S2').room, undefined);
});
test('indoor art files exist as webp, each ≤ 400KB (PNG originals are not shipped)', async () => {
  const fs = await import('node:fs');
  for (const f of L.INDOOR_ART) {
    const p = new URL('../' + f, import.meta.url);
    assert.ok(fs.existsSync(p), f);
    assert.ok(fs.statSync(p).size <= 400 * 1000, f + ' size');
  }
});
