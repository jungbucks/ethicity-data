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
  assert.equal(L.look('m2', 'S1').id, L.look('tutorial', null).id, 'unknown → tutorial look');
  assert.equal(L.look('m3', 'S9').id, L.look('m3', 'S1').id, 'unknown zone of a known mission → its first zone');
});
