// 도시 복구 그림 자리 계산(js/city-look.js): 좁은 화면 object-position, 그림 좌표 → 틀 좌표, 케이블 빛·새 구역 열림 자리
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Look = require('../js/city-look.js');
const config = require('../js/config.js');
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);

test('time values live in config.city (feedback h)', () => {
  assert.equal(config.city.line, 0.4);
  assert.equal(config.city.reveal, 0.6);
  assert.equal(config.city.button, 0.8);
  assert.equal(config.city.flash, 0.3);
  const c = config.city;
  assert.ok(c.line + c.reveal + c.flash + c.text <= 2, 'the art sequence + text fade stays under 2 s');
  assert.ok(c.cableY > 0.8 && c.cableY < 1, 'cable height inside the bottom fifth of the art');
});

test('wide view (8:3 box = whole art): nothing moves, image fraction = box fraction', () => {
  assert.equal(Look.scale(false), 1);
  for (let to = 1; to <= 5; to++) assert.equal(Look.posX(to, 1), 0.5);
  near(Look.toBox(0.3, 1, 0.5), 0.3, 'same place');
});

test('narrow view (4:3 box): half the art shows, new zone near the middle, both layers share the position', () => {
  assert.equal(Look.scale(true), 2);
  // object-position x = 시작 칸 / 움직일 수 있는 폭 — 새 구역 중심 (to-0.5)*20%가 틀 가운데로(양 끝은 벽에 붙음)
  near(Look.posX(1, 2), 0, 'zone 1 hugs the left edge');
  near(Look.posX(2, 2), 0.1, 'zone 2');
  near(Look.posX(3, 2), 0.5, 'zone 3 = middle');
  near(Look.posX(4, 2), 0.9, 'zone 4');
  near(Look.posX(5, 2), 1, 'zone 5 hugs the right edge');
  for (const to of [2, 3, 4]) near(Look.toBox(Look.center(to), 2, Look.posX(to, 2)), 0.5, `zone ${to} center sits mid-box`);
  near(Look.toBox(Look.center(1), 2, 0), 0.2, 'zone 1 center at 20% (as close as it gets)');
  near(Look.toBox(Look.center(5), 2, 1), 0.8, 'zone 5 center at 80%');
  // 새 구역 칸 전체가 틀 안에 보인다
  for (let to = 1; to <= 5; to++) {
    const p = Look.posX(to, 2);
    assert.ok(Look.toBox((to - 1) / 5, 2, p) >= -1e-9 && Look.toBox(to / 5, 2, p) <= 1 + 1e-9, `zone ${to} fully inside`);
  }
});

test('layout: cable from the right end of zone `from` (left end when 0) to the center of zone `to`; reveal = the new zone only', () => {
  const a = Look.layout(2, 3, false);
  near(a.cableFrom, 0.4, 'cable starts at from*20%');
  near(a.cableTo, 0.5, 'cable ends at the center of zone 3');
  near(a.revealFrom, 0.4, 'reveal left'); near(a.revealTo, 0.6, 'reveal right');
  assert.equal(a.final, false);
  const z = Look.layout(0, 1, false);
  near(z.cableFrom, 0, 'from 0 = left end'); near(z.cableTo, 0.1, 'center of zone 1');
  // 좁은 화면: 같은 계산을 틀 좌표로(2배 확대 − 밀린 만큼)
  const n = Look.layout(2, 3, true);
  near(n.pos, 0.5, 'pos'); near(n.cableFrom, 0.3, 'narrow cable start'); near(n.cableTo, 0.5, 'narrow cable end = mid');
  near(n.revealFrom, 0.3, 'narrow reveal left'); near(n.revealTo, 0.7, 'narrow reveal right');
  // 틀 밖은 0~1로 자른다
  const n1 = Look.layout(0, 1, true);
  near(n1.cableFrom, 0, 'clamped'); near(n1.revealFrom, 0, 'clamped');
});

test('layout: the last cell (to = 5) sweeps the whole cable and the jump 2 → 5 opens zones 3..5', () => {
  const f = Look.layout(4, 5, false);
  assert.equal(f.final, true);
  near(f.cableFrom, 0, 'whole cable from the left'); near(f.cableTo, 1, 'to the right end');
  near(f.revealFrom, 0.8, 'zone 5'); near(f.revealTo, 1, 'zone 5 right');
  const j = Look.layout(2, 5, false);
  near(j.revealFrom, 0.4, 'zones 3..5 open together'); near(j.revealTo, 1, 'to the right end');
  const n = Look.layout(4, 5, true);
  near(n.cableFrom, 0, 'narrow sweep clamped'); near(n.cableTo, 1, 'narrow sweep clamped');
});

test('css(): percent strings for the screen (wide and narrow sets)', () => {
  const v = Look.css(2, 3);
  assert.equal(v['--city-pos-w'], '50%');
  assert.equal(v['--city-pos-n'], '50%');
  assert.equal(v['--city-cable-left-w'], '40%');
  assert.equal(v['--city-cable-len-w'], '10%', 'cable length = end − start');
  assert.equal(v['--city-cable-left-n'], '30%');
  assert.equal(v['--city-cable-len-n'], '20%');
  assert.equal(v['--city-clip-l-n'], '30%');
  assert.equal(v['--city-clip-r-n'], '30%', 'inset right = 100% − right edge');
  assert.equal(v['--city-clip-r-w'], '40%');
});
