// 결승 "도착" 표지판(2026-11-12, js/finish-banner.js) — 결승선 통과에만 · 솟기·튕김 곡선 · 멈출 자리 계산 · 시간(어두워지기 전에 다 서 있음)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const B = require('../js/finish-banner.js');

test('banner only when crossing the finish line, never on knockout', () => {
  assert.equal(B.shows('arrive'), true);
  assert.equal(B.shows('knockout'), false);
  assert.equal(B.shows(undefined), false);
});

test('rise: hidden at 0, rest at 1, small bounce, never dips below 0', () => {
  const sec = cfg.finish.bannerRise;
  assert.equal(B.rise(0, sec, false), 0);
  assert.equal(B.rise(sec, sec, false), 1);
  assert.equal(B.rise(sec * 3, sec, false), 1);
  let max = 0, maxAt = 0;
  for (let i = 0; i <= 1000; i++) {
    const t = sec * i / 1000, r = B.rise(t, sec, false);
    assert.ok(r >= 0, 'no dip at ' + t);
    if (r > max) { max = r; maxAt = t; }
  }
  assert.ok(max > 1.05 && max < 1.15, 'overshoot ~10%: ' + max);
  assert.ok(maxAt > sec * 0.5 && maxAt < sec, 'bounce in the second half: ' + maxAt);
});

test('posts stay planted: the bounce never lifts the bottom above the road', () => {
  const sec = cfg.finish.bannerRise;
  for (let i = 0; i <= 1000; i++) assert.ok(B.bottomAt(B.rise(sec * i / 1000, sec, false)) < 0, 'bottom below road at step ' + i);
  assert.equal(B.bottomAt(0), -B.H, 'fully hidden: top at road level');
  assert.ok(Math.abs(B.bottomAt(1) + B.SINK) < 1e-9, 'rest: posts sunk SINK m');
  assert.ok(B.bottomAt(1) + B.H - B.PANEL_H > 1.2, 'sign panel stands above head height');
});

test('reduced motion: in place from the start (no rise, no bounce)', () => {
  for (const t of [0, 0.1, 0.3, 1]) assert.equal(B.rise(t, cfg.finish.bannerRise, true), 1);
});

test('stopDistance matches the per-step deceleration used by run3d (f.t += dt, then speed)', () => {
  for (const speed0 of [16, 20, 30]) {
    const slow = cfg.finish.slow;
    let t = 0, z = 0;
    for (let i = 0; i < 200; i++) { t += 0.02; z += speed0 * Math.pow(1 - Math.min(1, t / slow), B.SLOW_POW) * 0.02; }
    const d = B.stopDistance(speed0, slow);
    assert.ok(Math.abs(d - z) < 0.5, speed0 + ': ' + d + ' vs ' + z);
  }
  assert.equal(B.stopDistance(20, 0), 0, 'reduced motion: stops at once');
  assert.equal(B.placeZ(100, 20, 0, cfg.finish.bannerAhead), 100 + cfg.finish.bannerAhead);
});

test('centerX: road centre in the middle lane, toward the camera line otherwise (symmetric)', () => {
  assert.equal(B.centerX(0, 6.4, 6), 0);
  const a = B.centerX(1.8, 6.4, 6), b = B.centerX(-1.8, 6.4, 6);
  assert.ok(Math.abs(a + b) < 1e-9);
  assert.ok(a > 0 && a < 1.8, a);
});

test('timing: settled well before the screen darkens; finish total unchanged (slow 1.2 + fade 0.8)', () => {
  const f = cfg.finish;
  assert.ok(f.bannerRise > 0.3 && f.bannerRise < 1, 'well under a second');
  assert.ok(B.holdSec(f) >= 0.6, 'at rest for ' + B.holdSec(f) + 's before the fade');
  assert.ok(f.gateFade > 0 && f.gateFade <= f.bannerRise, 'passed gate fades out while the sign rises');
  assert.equal(f.slow + f.fade, 2.0);
  assert.equal(f.reducedFade, 0.3);
});

test('index.html loads finish-banner.js before run3d.js', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const a = html.indexOf('js/finish-banner.js'), b = html.indexOf('js/run3d.js');
  assert.ok(a > 0 && a < b);
});
