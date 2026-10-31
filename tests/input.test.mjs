// 터치 스와이프·탭 구분
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const { classify } = require('../js/input.js');

test('swipe vs tap', () => {
  assert.equal(classify(40, 5, cfg), 'right');
  assert.equal(classify(-40, 5, cfg), 'left');
  assert.equal(classify(5, 5, cfg), 'tap');
  assert.equal(classify(10, 60, cfg), null);
});

test('swipe threshold is inclusive', () => {
  assert.equal(classify(30, 0, cfg), 'right');
  assert.equal(classify(29, 0, cfg), 'tap');
});
