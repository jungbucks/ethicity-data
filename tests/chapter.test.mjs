// 챕터 끝(설계 2026-11-08 ②): 다른 용도 요청 + 개념 질문 + 짧은 생각 — 데이터 규칙과 저장(옛 기록은 빈 값)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Save = require('../js/save.js');
const M = { m1: require('../missions/m1.js'), m2: require('../missions/m2.js'), m3: require('../missions/m3.js'), m4: require('../missions/m4.js') };
const flood = require('../missions/legacy-flood.js'), tut = require('../missions/tutorial.js');
const BAD = /[—%]|\p{Extended_Pictographic}/u;

const FROM = { m1: '○○마트 마케팅팀', m2: '구청 단속 담당', m3: '근처 상점 광고 회사', m4: '○○학원' };
const CONCEPT = { m1: /모습/, m2: /이름표/, m3: /옛|오래/, m4: /독특|크게 기운/ };

for (const [id, m] of Object.entries(M)) {
  test(id + ': request from the right sender, three choices, refusing is the one best answer', () => {
    const ce = m.chapterEnd;
    assert.ok(ce, id);
    assert.equal(ce.from, FROM[id]);
    assert.ok(ce.message && ce.message.length <= 90, 'short message');
    assert.equal(ce.choices.length, 3);
    assert.equal(new Set(ce.choices.map((c) => c.id)).size, 3);
    const best = ce.choices.filter((c) => c.best);
    assert.equal(best.length, 1);
    assert.equal(best[0].id, 'refuse', 'refusing protects the most');
    assert.ok(ce.choices[0].id !== 'refuse' || ce.choices[1].id !== 'refuse', 'order');
    for (const c of ce.choices) assert.ok(c.text && c.feedback && c.short, id + ' ' + c.id);
  });
  test(id + ': one concept question on that chapter\'s concept, one correct answer', () => {
    const q = m.chapterEnd.concept;
    assert.match(q.question, CONCEPT[id]);
    assert.equal(q.choices.length, 3);
    assert.equal(q.choices.filter((c) => c.correct).length, 1);
    for (const c of q.choices) assert.ok(c.text && c.feedback, c.id);
  });
  test(id + ': reflection frame has two blanks; all new copy is short, no emoji, no em dash, no %', () => {
    const ce = m.chapterEnd;
    assert.equal((ce.frame.match(/___/g) || []).length, 2);
    const texts = [ce.message, ce.frame, ce.concept.question, ...ce.choices.flatMap((c) => [c.text, c.feedback, c.short]), ...ce.concept.choices.flatMap((c) => [c.text, c.feedback])];
    for (const t of texts) { assert.ok(!BAD.test(t), t); assert.ok(t.length <= 90, t); }
  });
}
test('pseudonymization only as one line (m3 route, m4 handwriting)', () => {
  const fb = (m) => m.chapterEnd.choices.map((c) => c.feedback).join(' ');
  assert.match(fb(M.m3), /이름을 지워도 다니는 길이 그 사람을 알려 줘/);
  assert.match(fb(M.m4), /이름만 지워도 필체.답으로 누군지 알 수 있어/);
  assert.ok(!/가명|법률|법적|보호법/.test(JSON.stringify(Object.values(M).map((m) => m.chapterEnd))), 'no legal terms');
});
test('tutorial and the old flood mission have no chapter end', () => {
  assert.equal(tut.chapterEnd, undefined);
  assert.equal(flood.chapterEnd, undefined);
});

test('Save.chapterOf: old records (no chapter) → empty values; keeps valid answers only', () => {
  assert.deepEqual(Save.chapterOf({}, 'm1'), { req: { first: null, last: null }, concept: { first: null, last: null }, note: '' });
  assert.deepEqual(Save.chapterOf({ m1: { cleared: true } }, 'm1'), { req: { first: null, last: null }, concept: { first: null, last: null }, note: '' });
  const recs = { m2: { cleared: true, chapter: { req: { first: 'consent', last: 'refuse' }, concept: { first: 'b', last: 'a' }, note: '이름표를 꼭 본다' } } };
  assert.deepEqual(Save.chapterOf(recs, 'm2'), recs.m2.chapter);
  assert.deepEqual(Save.chapterOf({ m3: { chapter: { req: 5, concept: null, note: 7 } } }, 'm3'), { req: { first: null, last: null }, concept: { first: null, last: null }, note: '' });
  assert.deepEqual(Save.chapterOf(null, 'm1').note, '');
});
test('chapter answers live in records → "처음부터" (clear) removes them', () => {
  const m = new Map(), st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  Save.setRecord('m1', { cleared: true, chapter: { req: { first: 'refuse', last: 'refuse' }, concept: { first: 'a', last: 'a' }, note: '모습' } }, st);
  assert.equal(Save.chapterOf(Save.records(st), 'm1').note, '모습');
  Save.clear(st);
  assert.equal(Save.chapterOf(Save.records(st), 'm1').note, '');
});

test('1 임무 챕터 끝 문장(플레이테스트 2026-11-12): 답이 안 되던 선택지 둘을 바꾸고 피드백을 또렷하게 — id·구조는 그대로', () => {
  const ce = M.m1.chapterEnd, by = (list, id) => list.find((c) => c.id === id);
  assert.deepEqual(ce.choices.map((c) => c.id), ['consent', 'refuse', 'erase'], 'ids unchanged (saved first/last values)');
  assert.equal(by(ce.choices, 'erase').text, '이미 받은 연락처니까 그냥 나눠 준다');
  assert.equal(by(ce.choices, 'erase').feedback, '연락처는 물건을 돌려주려고 받은 거야. 다른 일에 쓰면, 그 사람은 내 번호가 어디로 갔는지 모르게 돼.');
  assert.equal(by(ce.choices, 'consent').feedback, '동의를 묻는 문자도 결국 그 번호를 원래 목적과 다르게 쓰는 일이야. 물건을 돌려주는 일과 상관없는 부탁이라면 거절이 가장 안전해.');
  assert.equal(by(ce.choices, 'refuse').feedback, '맞아. 모은 목적 안에서만 쓰는 게 원칙이야.');
  assert.deepEqual(ce.concept.choices.map((c) => c.id), ['a', 'b', 'c']);
  assert.equal(by(ce.concept.choices, 'c').text, '사진을 많이 모으면 접힌 모습도 저절로 알게 된다');
  assert.equal(by(ce.concept.choices, 'c').feedback, '수거봇의 3,000장처럼 많아도 같은 모습만 있으면 소용없어. 빠진 모습을 넣어야 알아봐.');
  assert.ok(M.m1.story.intro.some((l) => /3,000장/.test(l.text)), '3,000장은 1 임무 도입 대사에 나온 숫자');
});
