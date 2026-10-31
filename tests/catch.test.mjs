// 잡기 규칙 — 넓은 판정 구간, 레인 이동 직전·직후 허용, 가방 가득, 퍼펙트(연출만)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const { phase, grabber } = require('../js/catch.js');

const card = (z, lane = 1, uid = 'a') => ({ uid, kind: 'card', key: 'day_deep', lane, z });
const st = (over) => ({ now: 0, items: [], runnerZ: 0, speed: 16, lane: 1, bagCount: 0, bagMax: 30, taken: new Set(), ...over });

test('phase boundaries', () => {
  assert.equal(phase(card(16 * 0.7), 0, 16, cfg), 'active');
  assert.equal(phase(card(16 * 0.71), 0, 16, cfg), 'far');
  assert.equal(phase(card(-16 * 0.13), 0, 16, cfg), 'passed');
});

test('grabs nearest active card in own lane only', () => {
  const g = grabber(cfg); g.press(0);
  const r = g.update(st({ items: [card(8, 1, 'far'), card(3, 1, 'near'), card(1, 0, 'other')] }));
  assert.equal(r.item.uid, 'near');
});

test('walls are never grabbed', () => {
  const g = grabber(cfg); g.press(0);
  assert.equal(g.update(st({ items: [{ uid: 'w', kind: 'wall', lane: 1, z: 2 }] })), null);
});

test('no press, no grab', () => {
  assert.equal(grabber(cfg).update(st({ items: [card(2)] })), null);
});

test('one press grabs one card', () => {
  const g = grabber(cfg); g.press(0);
  const s = st({ items: [card(2, 1, 'x'), card(4, 1, 'y')] });
  assert.ok(g.update(s));
  assert.equal(g.update(s), null);
});

test('press just before lane change still grabs in new lane', () => {
  const g = grabber(cfg); g.press(0);
  const items = [card(3, 2, 'r')];
  assert.equal(g.update(st({ items, now: 0.05, lane: 1 })), null);
  assert.equal(g.update(st({ items, now: 0.12, lane: 2 })).item.uid, 'r');
});

test('buffer expires', () => {
  const g = grabber(cfg); g.press(0);
  const items = [card(3, 2, 'r')];
  g.update(st({ items, now: 0.1, lane: 1 }));
  assert.equal(g.update(st({ items, now: 0.2, lane: 2 })), null);
});

test('press before a card is active waits within the buffer', () => {
  const g = grabber(cfg); g.press(0);
  assert.equal(g.update(st({ items: [card(12, 1, 'k')], now: 0.05 })), null);
  assert.equal(g.update(st({ items: [card(12, 1, 'k')], now: 0.1, runnerZ: 2 })).item.uid, 'k');
});

test('full bag', () => {
  const g = grabber(cfg); g.press(0);
  assert.deepEqual(g.update(st({ items: [card(2)], bagCount: 30 })), { full: true });
  assert.equal(g.update(st({ items: [card(2)] })), null);
});

test('perfect only at contact', () => {
  const g = grabber(cfg); g.press(0);
  assert.equal(g.update(st({ items: [card(1)] })).perfect, true);
  const h = grabber(cfg); h.press(0);
  assert.equal(h.update(st({ items: [card(5)] })).perfect, false);
});

test('taken cards are skipped', () => {
  const g = grabber(cfg); g.press(0);
  assert.equal(g.update(st({ items: [card(2, 1, 't')], taken: new Set(['t']) })), null);
});

test('slowed runner keeps the same catch distance (wall hit must not shrink the window)', () => {
  assert.equal(phase(card(16 * 0.65), 0, 8, cfg), 'active');
  const g = grabber(cfg); g.press(0);
  assert.equal(g.update(st({ items: [card(5.8, 1, 'behind-wall')], speed: 8 })).item.uid, 'behind-wall');
});

test('press just after contact still grabs', () => {
  assert.equal(phase(card(-16 * 0.1), 0, 16, cfg), 'active');
  const g = grabber(cfg); g.press(0);
  assert.equal(g.update(st({ items: [card(-1, 1, 'late')] })).item.uid, 'late');
});

test('perfect works on both sides of contact', () => {
  const g = grabber(cfg); g.press(0);
  assert.equal(g.update(st({ items: [card(-0.8)] })).perfect, true);
});
