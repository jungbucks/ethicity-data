// 조사 공용 함수(플레이테스트 9) — 한글 받침 · 숫자(1·3·6·7·8·0 받침) · 영문(L·M·N·R 받침) · 끝의 따옴표/괄호 · 으로/로 · 문장 틀
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const J = require('../js/josa.js');

test('한글 받침: 이/가 · 을/를 · 은/는 · 과/와', () => {
  assert.equal(J.attach('우유팩', '이'), '우유팩이');
  assert.equal(J.attach('비닐봉지', '이'), '비닐봉지가');
  assert.equal(J.attach('통조림 캔', '을'), '통조림 캔을');
  assert.equal(J.attach('건전지', '을'), '건전지를');
  assert.equal(J.attach('영수증', '은'), '영수증은');
  assert.equal(J.attach('칫솔', '와'), '칫솔과');
  assert.equal(J.attach('페트병', '와'), '페트병과');
  assert.equal(J.attach('고양이', '과'), '고양이와');
  // 어느 쪽을 줘도 같은 결과
  assert.equal(J.attach('비닐봉지', '가'), '비닐봉지가');
  assert.equal(J.attach('우유팩', '를'), '우유팩을');
});

test('숫자로 끝나면 읽는 소리로: 1·3·6·7·8·0 받침, 2·4·5·9 없음', () => {
  const has = { 0: true, 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: true, 8: true, 9: false };
  for (const [d, b] of Object.entries(has)) {
    assert.equal(J.attach('흘려 쓴 ' + d, '이'), '흘려 쓴 ' + d + (b ? '이' : '가'), d);
    assert.equal(J.attach('번호 ' + d, '을'), '번호 ' + d + (b ? '을' : '를'), d);
    assert.equal(J.attach(d, '은'), d + (b ? '은' : '는'), d);
  }
  assert.equal(J.attach('10', '이'), '10이'); // 십
});

test('영문으로 끝나면: L·M·N·R 받침, 그 밖은 없음(대소문자 같음)', () => {
  for (const c of 'LMNRlmnr') assert.equal(J.attach('AI ' + c, '이'), 'AI ' + c + '이', c);
  for (const c of 'ABCDEFGHIJKOPQSTUVWXYZ') assert.equal(J.attach(c, '이'), c + '가', c);
  assert.equal(J.attach('AI', '은'), 'AI는');
});

test('끝의 따옴표·괄호·마침표는 건너뛰고 앞 글자로 본다', () => {
  assert.equal(J.attach("'종이'", '으로'), "'종이'로");
  assert.equal(J.attach('“캔”', '으로'), '“캔”으로');
  assert.equal(J.attach('우산(접힌)', '이'), '우산(접힌)이');
});

test('으로/로: 받침 없음·ㄹ 받침·1·7·8·L·R = 로, 그 밖 받침 = 으로', () => {
  assert.equal(J.attach('종이', '으로'), '종이로');
  assert.equal(J.attach('일반쓰레기', '로'), '일반쓰레기로');
  assert.equal(J.attach('투명 페트', '으로'), '투명 페트로');
  assert.equal(J.attach('비닐', '으로'), '비닐로');
  assert.equal(J.attach('캔', '으로'), '캔으로');
  assert.equal(J.attach('종이팩', '로'), '종이팩으로');
  for (const d of '178') assert.equal(J.attach(d, '으로'), d + '로', d);
  for (const d of '360') assert.equal(J.attach(d, '으로'), d + '으로', d);
  assert.equal(J.attach('L', '으로'), 'L로');
  assert.equal(J.attach('M', '으로'), 'M으로');
});

test('예전 judge 모양 josa(word, a, b)도 같은 규칙', () => {
  assert.equal(J.josa('흘려 쓴 1', '이', '가'), '이');
  assert.equal(J.josa('또박또박 쓴 2', '이', '가'), '가');
  assert.equal(J.ro('3'), '으로');
});

test('문장 틀: {what:이} {what:을} {what} {label:으로} — 여러 이름은 "A와 B", 셋 이상 "A, B, C"', () => {
  assert.equal(J.fill('{what:이} 엉뚱한 함으로 갔다.', { what: ['찌그러진 페트병'] }), '찌그러진 페트병이 엉뚱한 함으로 갔다.');
  assert.equal(J.fill('{what:이} 엉뚱한 함으로 갔다.', { what: ['찌그러진 페트병', '비닐봉지'] }), '찌그러진 페트병과 비닐봉지가 엉뚱한 함으로 갔다.');
  assert.equal(J.fill('{what:을} 못 읽었다.', { what: ['우유팩', '신문지', '흘려 쓴 1'] }), '우유팩, 신문지, 흘려 쓴 1을 못 읽었다.');
  assert.equal(J.fill('{what:이} {label:으로} 갔다.', { what: '칫솔', label: '투명 페트' }), '칫솔이 투명 페트로 갔다.');
  assert.equal(J.fill('{what} 그대로', { what: '캔' }), '캔 그대로');
  assert.equal(J.fill('없는 {x:이}', {}), '없는 ');
});

test('결과 문구 틀(judge missingLine·contaminationLine)도 공용 조사를 쓴다', () => {
  const { missingLine, contaminationLine } = require('../js/judge.js');
  const m4 = require('../missions/m4.js');
  assert.match(missingLine(m4, 'S2_cur_ai', 1), /흘려 쓴 인공지능이 부족했다/);
  assert.match(missingLine(m4, 'S4_scrawl', 0), /아주 흘려 쓴 머신러닝이 없었다/);
  // 플레이어가 만든 오표기: 끝 괄호는 건너뛴다 → "'date(보기에 없는 낱말)'로", 받침 ㅇ → "'머신러닝'으로"
  assert.match(contaminationLine(m4, 'mis:neat_ai:date', false), /낱말\)'로 들어갔다/);
  assert.match(contaminationLine(m4, 'mis:neat_ai:ml', false), /'머신러닝'으로 들어갔다/);
});
