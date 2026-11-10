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

// 스와이프는 손가락을 떼기 전에, 문턱을 넘는 순간 레인을 옮긴다(휴대폰 반응 속도)
const { tracker } = require('../js/input.js');

test('swipe fires on move as soon as it crosses the threshold, once per touch', () => {
  const t = tracker(cfg);
  t.start(150, 500);
  assert.equal(t.move(170, 501), null);
  assert.equal(t.move(181, 502), 'right');
  assert.equal(t.move(260, 505), null, '한 번 밀기 = 한 칸');
  assert.equal(t.end(260, 505), 'done', '뗄 때는 이미 처리됨(잡기 아님)');
});

test('tap and slow swipe still resolve on release', () => {
  const t = tracker(cfg);
  t.start(200, 500);
  assert.equal(t.end(203, 502), 'tap');
  t.start(200, 500);
  assert.equal(t.end(160, 500), 'left', '움직임 이벤트 없이 떼도 밀기로');
  assert.equal(t.end(160, 500), null, '시작 없이 떼면 아무 일 없음');
});

test('vertical drag never moves a lane', () => {
  const t = tracker(cfg);
  t.start(200, 300);
  assert.equal(t.move(200, 400), null);
  assert.equal(t.move(210, 520), null);
  assert.equal(t.end(210, 520), null);
});
