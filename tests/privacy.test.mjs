// 목적 밖 개인정보 카드(설계 2026-11-08 ①): 데이터 규칙·코스 표시·제출 판정
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
require('../js/rng.js');
require('../js/cards.js');
const Privacy = require('../js/privacy.js');
const Stream = require('../js/stream.js');
const Judge = require('../js/judge.js');
const M = { m1: require('../missions/m1.js'), m2: require('../missions/m2.js'), m3: require('../missions/m3.js'), m4: require('../missions/m4.js') };
const flood = require('../missions/legacy-flood.js'), tut = require('../missions/tutorial.js');
const SEEDS = [1, 2, 7, 42, 999, 1101, 2201, 3301, 4401];
const strip = (c) => ({ ...c, items: c.items.map(({ privateId, glitch, ...it }) => it) }); // 지지직 표시(glitch)는 개인정보 카드를 빼고 고르므로 함께 뺀다 — glitch.test가 따로 지킴

test('every mission 1~4 has 2~3 private cards; on for all four (m1·m2 photos exist)', () => {
  for (const [id, m] of Object.entries(M)) {
    assert.ok(m.privacy && Array.isArray(m.privacy.cards), id);
    assert.ok(m.privacy.cards.length >= 2 && m.privacy.cards.length <= 3, id);
    assert.equal(m.privacy.on, true, id + ' on');
  }
  assert.equal(Privacy.on(flood), false);
  assert.equal(Privacy.on(tut), false);
});

test('photo private cards point at existing webp files', () => {
  const dirs = { m1: 'lost-found', m2: 'recycle' };
  for (const [id, dir] of Object.entries(dirs)) for (const d of M[id].privacy.cards) {
    assert.ok(d.art.photo, id + ' ' + d.id + ' is a photo');
    assert.ok(fs.existsSync(new URL(`../assets/cards/${dir}/${d.art.photo}.webp`, import.meta.url)), d.art.photo);
  }
});

test('private cards are only common shapes: not rare, not in a danger combo, not m4 S4, mask regions inside the card', () => {
  for (const [id, m] of Object.entries(M)) for (const d of m.privacy.cards) {
    const t = m.cardTypes[d.key];
    assert.ok(t, id + ' ' + d.key);
    assert.ok(!t.rare, id + ' ' + d.key + ' is common');
    assert.ok(!t.displayAs && !/_old$/.test(d.key), 'not an old photo');
    const combos = m.scenes.flatMap((s) => s.combos.filter((c) => c.keys.includes(d.key)).map((c) => ({ ...c, scene: s.id })));
    assert.ok(combos.length, d.key + ' used');
    assert.ok(combos.every((c) => !c.danger), d.key + ' not in a danger combo');
    if (id === 'm4') assert.ok(combos.every((c) => c.scene !== 'S4'), 'm4 not S4');
    assert.ok(['mask', 'remove'].includes(d.fix), d.id);
    assert.ok(d.mask && d.mask.length, d.id + ' has mask regions');
    // canvasMask = 사진이 없을 때 Canvas 대체 그림 위 자리(3 임무 — 사진과 Canvas의 얼굴·번호판 자리가 다르다)
    for (const r of d.mask.concat(d.canvasMask || [])) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1 && r.y + r.h <= 1, d.id);
      assert.ok(['bar', 'blur'].includes(r.look), d.id);
    }
  }
  // 설계 표: m2만 빼기, 나머지는 가리기
  assert.ok(M.m2.privacy.cards.every((d) => d.fix === 'remove'));
  for (const id of ['m1', 'm3', 'm4']) assert.ok(M[id].privacy.cards.every((d) => d.fix === 'mask'), id);
});

test('course marks private cards: deterministic, outside the first 15%, only on the first run, nothing else changes', () => {
  for (const [id, m] of Object.entries(M)) for (const seed of SEEDS) {
    const c = Stream.build(m, cfg, { seed });
    const marked = c.items.filter((it) => it.privateId);
    assert.equal(marked.length, m.privacy.cards.length, id + ' ' + seed);
    for (const it of marked) {
      const d = Privacy.def(m, it.privateId);
      assert.equal(it.kind, 'card');
      assert.equal(it.key, d.key);
      assert.ok(it.z >= c.length * 0.15, 'not in the first 15%');
    }
    assert.deepEqual(Stream.build(m, cfg, { seed }), c, 'same seed same course');
    const off = { ...m, privacy: { ...m.privacy, on: false } };
    assert.deepEqual(strip(c), strip(Stream.build(off, cfg, { seed })), 'only privateId was added');
    const sup = Stream.build(m, cfg, { seed, focusCounts: { [m.privacy.cards[0].key]: 2 } });
    assert.equal(sup.items.filter((it) => it.privateId).length, 0, 'no private cards in a supplement run');
  }
  for (const seed of SEEDS) assert.equal(Stream.build(flood, cfg, { seed }).items.filter((it) => it.privateId).length, 0);
});

test('check: untouched → unhandled, masked a must-remove card → mustRemove, handled → ok', () => {
  const m1 = M.m1, d = m1.privacy.cards[0];
  assert.deepEqual(Privacy.check(m1, [{ id: 'c1', key: 'umbrella_open' }]), { ok: true, reason: null, open: 0, handled: 0 });
  // 일부만 가림: 남은 장 수(open)와 가린 장 수(handled)를 같이 돌려준다 → 감독관이 "아직 n장 더"를 말한다(2026-11-10)
  {
    const m4 = M.m4, [a, b] = m4.privacy.cards;
    const two = [{ id: 'c1', key: a.key, privateId: a.id, masked: true }, { id: 'c2', key: b.key, privateId: b.id }];
    assert.deepEqual(Privacy.check(m4, two), { ok: false, reason: 'unhandled', open: 1, handled: 1 });
    two[1].masked = true;
    assert.deepEqual(Privacy.check(m4, two), { ok: true, reason: null, open: 0, handled: 2 });
    // 남은 장 수 + 어느 종류인지({kind} = 남은 카드에 붙은 이름표, 플레이테스트 2026-11-12) — 어느 카드인지는 말하지 않는다
    assert.equal(Privacy.text(m4, 'blockMore'), '잘 가린 답안지도 있어. 학생 이름이 적힌 답안지가 {kind} 답안지 중에 아직 {n}장 더 있어.');
    assert.equal(Privacy.text(m1, 'blockMore'), '잘 가린 사진도 있어. 개인정보가 담긴 사진이 {kind} 사진 중에 아직 {n}장 더 있어.');
    // 빼서 줄였을 때(2026-11-14): 칭찬 말머리('잘 가린') 없이 남은 장 수와 종류만
    assert.equal(Privacy.text(m1, 'blockMoreRemoved'), '개인정보가 담긴 사진이 {kind} 사진 중에 아직 {n}장 더 있어.');
    assert.equal(Privacy.text(m4, 'blockMoreRemoved'), '학생 이름이 적힌 답안지가 {kind} 답안지 중에 아직 {n}장 더 있어.');
    assert.equal(Privacy.left(m4, two), 2);
    assert.match(Privacy.text(m1, 'blockLook'), /{kind} 사진 테두리를 잠깐 밝혀 둘게/);
    assert.match(Privacy.text(m4, 'blockLook'), /{kind} 답안지 테두리/);
    // openCards = check의 open과 같은 카드(가방 항목 그대로)
    two[1].masked = false;
    assert.deepEqual(Privacy.openCards(m4, two).map((c) => c.id), ['c2']);
    assert.equal(Privacy.openCards(m4, two).length, Privacy.check(m4, two).open);
    two[1].masked = true;
    assert.deepEqual(Privacy.openCards(m4, two), []);
    assert.deepEqual(Privacy.openCards(m1, [{ id: 'c1', key: 'umbrella_open' }]), []);
    assert.ok(Privacy.text(m4, 'blockUnhandled2').includes('검수에서 다시 살펴봐')); // 임무에 없는 키는 공통 문구
    assert.equal(typeof m4.privacy.cards[0].art.name, 'string');
  }
  assert.equal(Privacy.check(m1, [{ id: 'c2', key: d.key, privateId: d.id }]).reason, 'unhandled');
  assert.equal(Privacy.check(m1, [{ id: 'c2', key: d.key, privateId: d.id, masked: true }]).ok, true);
  const m2 = M.m2, f = m2.privacy.cards[0];
  assert.equal(Privacy.check(m2, [{ id: 'c3', key: f.key, privateId: f.id }]).reason, 'unhandled');
  assert.equal(Privacy.check(m2, [{ id: 'c3', key: f.key, privateId: f.id, masked: true }]).reason, 'mustRemove');
  // 둘 다 있으면 빼야 하는 쪽 문장이 먼저(그 카드는 이미 학생이 골랐으니)
  assert.equal(Privacy.check(m2, [{ id: 'c3', key: f.key, privateId: f.id, masked: true }, { id: 'c4', key: f.key, privateId: f.id }]).reason, 'mustRemove');
  assert.equal(Privacy.check(m2, []).ok, true);
  // 꺼진 임무는 언제나 ok
  assert.equal(Privacy.check({ ...m1, privacy: { ...m1.privacy, on: false } }, [{ id: 'c2', key: d.key, privateId: d.id }]).ok, true);
});

test('mask: only private cards can be masked; masked card counts as its normal kind', () => {
  const m4 = M.m4, d = m4.privacy.cards[0];
  const plain = { id: 'c1', key: 'neat_data' }, priv = { id: 'c2', key: d.key, privateId: d.id };
  assert.equal(Privacy.canMask(m4, plain), false);
  assert.equal(Privacy.canMask(m4, priv), true);
  assert.equal(Privacy.toggleMask(m4, plain), false);
  assert.equal(plain.masked, undefined);
  assert.equal(Privacy.toggleMask(m4, priv), true);
  assert.equal(priv.masked, true);
  const bag = [priv, { id: 'c3', key: d.key }];
  assert.equal(Judge.judge(m4, bag, cfg).scenes.length, 4);
  const C = require('../js/cards.js');
  assert.equal(C.displayKey(m4, priv), d.key);
  assert.equal(C.artId(priv), d.id + '#masked');
  assert.equal(Privacy.toggleMask(m4, priv), false);
  assert.equal('masked' in priv, false);
  assert.equal(C.artId(priv), d.id);
  assert.equal(C.artId({ id: 'c9', key: 'neat_data' }), 'neat_data');
});

test('wasted: maskable private cards caught then removed (the "could have masked" line)', () => {
  const m1 = M.m1, [a, b] = m1.privacy.cards;
  const caught = Privacy.caught(m1, [{ id: 'c1', key: a.key, privateId: a.id }, { id: 'c2', key: b.key, privateId: b.id }, { id: 'c3', key: 'umbrella_open' }]);
  assert.deepEqual(caught, ['c1', 'c2']);
  assert.equal(Privacy.wasted(m1, caught, [{ id: 'c2', key: b.key, privateId: b.id, masked: true }]), 1);
  assert.equal(Privacy.wasted(m1, caught, []), 2);
  assert.equal(Privacy.wasted(m1, [], []), 0);
  // 빼야 하는 카드(m2)는 셈 밖
  const m2 = M.m2, f = m2.privacy.cards[0];
  assert.deepEqual(Privacy.caught(m2, [{ id: 'c1', key: f.key, privateId: f.id }]), []);
});

// 검수 안내 한 줄 = 그 임무 카드의 실제 처리 방법(리뷰 2026-11-13 — 공통 안내 "가려야 해요"가 2 임무에도 떠서,
//   안내대로 얼굴을 가린 학생이 "가리는 걸로 안 돼. 빼야 해."로 막혔다). 가리기 카드만 = "가려야", 빼기 카드만 = "빼야"(+ 가리지 말라),
//   섞인 임무 = 둘 다. 카드가 바뀌면 이 검사가 안내를 고치라고 알려 준다.
const fixesOf = (m) => [...new Set(m.privacy.cards.map((d) => d.fix))].sort();
const says = (note) => ({ mask: /가려야/.test(note), remove: /빼야/.test(note), noMask: /가리지 말고|가려도 안/.test(note) });
test('inspect note matches each mission\'s private-card fix types (mask / remove / both)', () => {
  const all = { ...M, flood, tutorial: tut };
  let checked = 0;
  for (const [id, m] of Object.entries(all)) {
    if (!Privacy.on(m)) continue;
    const fixes = fixesOf(m), note = Privacy.text(m, 'inspectNote'), s = says(note);
    for (const f of fixes) assert.ok(f === 'mask' || f === 'remove', id + ' fix ' + f);
    if (fixes.includes('mask')) assert.ok(s.mask, id + ' has mask cards → note says 가려야: ' + note);
    else assert.ok(!s.mask, id + ' has no mask card → note must not say 가려야: ' + note);
    if (fixes.includes('remove')) assert.ok(s.remove, id + ' has remove cards → note says 빼야: ' + note);
    else assert.ok(!s.remove, id + ' has no remove card → note must not say 빼야: ' + note);
    if (fixes.length === 1 && fixes[0] === 'remove') assert.ok(s.noMask, id + ' remove-only → note says masking is not enough: ' + note);
    checked++;
  }
  assert.equal(checked, 4, 'm1~m4 all have private cards on');
  // 지금 카드 구성(확인용): 1·3·4 임무 가리기, 2 임무 빼기
  assert.deepEqual(['m1', 'm2', 'm3', 'm4'].map((id) => fixesOf(M[id]).join('+')), ['mask', 'remove', 'mask', 'mask']);
  // 가리기 임무 안내는 교사 지시 문장 그대로(2026-11-12) — 1·3 임무 공통, 4 임무 답안지
  assert.equal(Privacy.text(M.m1, 'inspectNote'), '개인정보가 있는 사진은 눌러서 중요한 정보를 가려야 해요.');
  assert.equal(Privacy.text(M.m3, 'inspectNote'), Privacy.TEXT.inspectNote);
  assert.equal(Privacy.text(M.m4, 'inspectNote'), '학생 이름이 적힌 답안지는 눌러서 이름을 가려야 해요.');
  // 2 임무 안내는 감독관이 막는 말(가리는 걸로 안 돼, 빼야 해)과 같은 방향
  assert.match(Privacy.text(M.m2, 'blockMustRemove2'), /빼야/);
  assert.notEqual(Privacy.text(M.m2, 'inspectNote'), Privacy.TEXT.inspectNote);
});
// 섞인 임무를 만들면 안내가 두 처리를 모두 말해야 한다(지금은 없음 — 검사 함수 자체 확인)
test('inspect note rule: a mixed mission needs both instructions', () => {
  const mixed = { privacy: { on: true, cards: [{ id: 'a', key: 'k', fix: 'mask' }, { id: 'b', key: 'k', fix: 'remove' }] } };
  assert.deepEqual(fixesOf(mixed), ['mask', 'remove']);
  const s = says(Privacy.text(mixed, 'inspectNote'));
  assert.equal(s.mask && s.remove, false, 'the shared note alone does not cover a mixed mission');
});

test('privacy copy: short, no emoji, no em dash, no %', () => {
  const texts = [...Object.values(Privacy.TEXT)];
  for (const m of Object.values(M)) if (m.privacy.text) texts.push(...Object.values(m.privacy.text)); // 임무별 문구도
  for (const t of texts) {
    assert.ok(!/[—%]|\p{Extended_Pictographic}/u.test(t), t);
    assert.ok(t.length <= 60, t);
  }
});
