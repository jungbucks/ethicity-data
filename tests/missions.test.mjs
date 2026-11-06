// 임무 데이터 형식·기획서 일치 검증
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const Rng = require('../js/rng.js');
const m1 = require('../missions/legacy-flood.js');
const tutorial = require('../missions/tutorial.js');
const cast = require('../missions/cast.js');

const combos = (m) => m.scenes.flatMap((s) => s.combos);

test('m1 combos reference existing card keys', () => {
  for (const c of combos(m1)) for (const k of c.keys) assert.ok(m1.cardTypes[k], k);
});

test('m1 scenes match the plan', () => {
  assert.deepEqual(m1.scenes.map((s) => s.id), ['S1', 'S2', 'S3', 'S4']);
  assert.equal(m1.scenes.find((s) => s.id === 'S4').emphasis, 'low');
  assert.deepEqual(combos(m1).filter((c) => c.boundary).map((c) => c.id).sort(), ['S3_night_neon', 'S4_night_muddy']);
});

test('ambiguous cards point at real keys and labels', () => {
  for (const q of m1.ambiguous) {
    assert.ok(m1.cardTypes[q.truthKey], q.id);
    assert.ok(m1.labelOptions.some((o) => o.id === q.correctLabel), q.id);
  }
  assert.equal(m1.ambiguous.length, 3);
});

test('every combo is fillable within the bag', () => {
  const keys = new Set(combos(m1).flatMap((c) => c.keys));
  const minCards = [...keys].reduce((n, k) => n + Math.max(...combos(m1).filter((c) => c.keys.includes(k)).map((c) => c.need)), 0);
  assert.ok(minCards <= m1.bag, `${minCards} > ${m1.bag}`);
  for (const k of keys) assert.ok(m1.counts[k] >= 2, k);
});

test('no forbidden copy', () => {
  const txt = JSON.stringify([m1, tutorial]);
  assert.ok(!/지하차도|%|AI가 틀렸|당신이 실패/.test(txt));
});


test('tutorial needs 5 dogs and 5 cats in a 10-card bag', () => {
  assert.equal(tutorial.bag, 10);
  assert.deepEqual(tutorial.scenes[0].combos.map((c) => [c.keys[0], c.need]), [['dog', 5], ['cat', 5]]);
});

test('cast covers every speaker', () => {
  for (const m of [m1, tutorial]) {
    const lines = Object.values(m.story).filter(Array.isArray).flat();
    for (const l of lines) assert.ok(cast[l.who], l.who);
  }
});

test('config has the tuning keys', () => {
  for (const k of ['baseSpeed', 'speedRamp', 'laneWidth', 'catchLead', 'perfectWindow', 'grabBuffer', 'wallSlow', 'wallPenalty', 'rareWallGapSec', 'laneMoveSec', 'bagFullRush', 'finish', 'swipeMin', 'maxDt', 'ambiguousWeight', 'maxSupplements', 'supplementFreeSlots', 'randomSeed']) assert.ok(k in cfg, k);
});

test('rng is deterministic', () => {
  const a = Rng.create(5), b = Rng.create(5);
  assert.equal(a.next(), b.next());
});

// 1 임무 가짜(spec §4)
const Cards = require('../js/cards.js');
const { judge } = require('../js/judge.js');
const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };

test('m1 fakes are well-formed', () => {
  assert.deepEqual(m1.fakes.map((f) => f.id), ['f_pool', 'f_fountain', 'f_fridge']);
  for (const f of m1.fakes) {
    assert.ok(m1.cardTypes[f.label], f.id);
    assert.ok(f.truth === null || m1.cardTypes[f.truth], f.id);
    assert.ok(f.count >= 1 && f.name && f.art, f.id);
    assert.match(f.line, /^우리가 넣은 데이터에 .+\.$/, f.id);
  }
});

test('m1 fake scenes', () => {
  const at = (id) => Cards.scenesForLabel(m1, m1.fakes.find((f) => f.id === id).label);
  assert.deepEqual(at('f_pool'), ['S1']);
  assert.deepEqual(at('f_fountain'), ['S1']);
  assert.deepEqual(at('f_fridge'), ['S3', 'S4']);
});

test('m1 passes in 30 cards avoiding fakes, fails with two', () => {
  const bag = bagOf({ ...ALL2, day_deep: 5, day_shallow: 5, day_wet: 3, day_dry: 3, night_wet: 6 });
  assert.equal(bag.length, 30);
  assert.equal(judge(m1, bag, cfg).allPass, true);
  const two = bag.slice(2).concat([{ id: 'x1', fakeId: 'f_fridge' }, { id: 'x2', fakeId: 'f_fridge' }]);
  assert.deepEqual(judge(m1, two, cfg).scenes.map((s) => s.pass), [true, true, false, false]);
});

test('m1 outcomeText has three kinds and chains to m2', () => {
  for (const k of ['pass', 'inconvenience', 'danger']) assert.ok(m1.outcomeText[k], k);
  assert.equal(m1.next, 'm2');
});

test('m1 bot says it labelled everything', () => {
  assert.ok(m1.story.intro.some((l) => l.who === 'bot' && /이름표/.test(l.text)));
});

test('no forbidden copy in fake lines', () => {
  assert.ok(!/지하차도|%|AI가 틀렸|당신이 실패/.test(JSON.stringify(m1.fakes)));
});

// 2 임무 「분리배출 분류 AI」(spec §5)
const m2 = require('../missions/m2.js');
const M2_ALL2 = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };
const fakesOf = (id, n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: id + '_' + i, fakeId: id, ...extra }));

test('m2 well-formed', () => {
  assert.equal(m2.id, 'm2');
  assert.deepEqual(m2.labels.map((l) => l.id), ['can', 'pet', 'pack', 'paper', 'vinyl', 'battery', 'trash']);
  const labelIds = new Set(m2.labels.map((l) => l.id));
  for (const [k, t] of Object.entries(m2.cardTypes)) {
    assert.ok(labelIds.has(t.label), k);
    assert.deepEqual(t.icons, [t.label], k);
    assert.ok(t.name && t.art, k);
    assert.ok(m2.counts[k] >= 2, k);
  }
  assert.equal(m2.cardTypes.battery_aa.hazard, true);
  for (const c of combos(m2)) for (const k of c.keys) assert.ok(m2.cardTypes[k], c.id);
  for (const f of m2.fakes) {
    assert.ok(labelIds.has(f.label), f.id);
    assert.ok(f.truth === null || m2.cardTypes[f.truth], f.id);
    assert.match(f.line, /^우리가 넣은 데이터에 .+\.$/, f.id);
  }
  for (const s of m2.scenes) assert.ok(s.cuts.danger && s.cuts.inconvenience && s.passLine, s.id);
  const comboIds = new Set(combos(m2).map((c) => c.id)), fakeIds = new Set(m2.fakes.map((f) => f.id));
  for (const it of m2.conveyor) {
    assert.ok(m2.cardTypes[it.art] || fakeIds.has(it.art), it.id);
    assert.ok(labelIds.has(it.bin) && labelIds.has(it.wrongBin) && it.bin !== it.wrongBin, it.id);
    assert.ok(it.variant >= 3, it.id);
    assert.ok(m2.scenes.some((s) => s.id === it.scene), it.id);
    for (const c of it.causes) assert.ok(comboIds.has(c) || fakeIds.has(c) || /^(contaminated|danger):S[1-4]$/.test(c), it.id + ' ' + c);
  }
  assert.ok(m2.conveyor.length >= 10 && m2.conveyor.length <= 14);
  for (const s of m2.scenes) assert.ok(m2.conveyor.some((it) => it.scene === s.id && it.art === 'battery_aa' && it.causes.includes('danger:' + s.id)), 'battery item per scene ' + s.id);
});

test('m2 scene art names the wrong bin its inconvenience cut shows (review)', () => {
  for (const s of m2.scenes) {
    assert.ok(m2.labels.some((l) => l.id === s.art.wrongBin), s.id);
    const right = m2.cardTypes[s.art.focus[0]] ? m2.cardTypes[s.art.focus[0]].label : m2.cardTypes[m2.fakes.find((f) => f.id === s.art.focus[0]).truth].label;
    assert.notEqual(s.art.wrongBin, right, s.id);
  }
  assert.equal(m2.scenes[2].art.wrongBin, 'paper'); // S3 문구: 종이 함에 영수증과 우유팩이 섞였다
});

test('m2 conveyor bins match the real sorting rules', () => {
  const truthLabel = (art) => (m2.cardTypes[art] ? m2.cardTypes[art].label : m2.cardTypes[m2.fakes.find((f) => f.id === art).truth].label);
  for (const it of m2.conveyor) assert.equal(it.bin, truthLabel(it.art), it.id);
  // 영수증·칫솔 = 종량제(일반쓰레기), 건전지 = 전용 수거, 종이팩 ≠ 종이, 찌그러진 투명 페트도 투명 페트
  assert.equal(m2.fakes.find((f) => f.id === 'f_receipt').truth, 'trash_misc');
  assert.equal(m2.fakes.find((f) => f.id === 'f_toothbrush').truth, 'trash_misc');
  assert.equal(m2.cardTypes.pack_milk.label, 'pack');
  assert.equal(m2.cardTypes.pet_crushed.label, 'pet');
});

test('m2 passes in 30 cards avoiding fakes', () => {
  const bag = bagOf({ ...M2_ALL2, can_drink: 5, pet_clear: 5, vinyl_bag: 4, paper_news: 4, pack_milk: 4 });
  assert.equal(bag.length, 30);
  assert.equal(judge(m2, bag, cfg).allPass, true);
});

test('m2 fixing fakes also passes', () => {
  const bag = bagOf({ ...M2_ALL2, trash_misc: 0 }).concat(fakesOf('f_receipt', 2, { label: 'trash' }));
  assert.equal(judge(m2, bag, cfg).allPass, true);
  const unfixed = bagOf({ ...M2_ALL2, trash_misc: 0 }).concat(fakesOf('f_receipt', 2));
  const s3 = judge(m2, unfixed, cfg).scenes[2];
  assert.equal(s3.pass, false);
  assert.deepEqual(s3.contaminated, ['f_receipt']);
});

test('m2 every scene can fail on its own', () => {
  const only = (drop) => judge(m2, bagOf({ ...M2_ALL2, [drop]: 0 }), cfg).scenes.map((s) => s.pass);
  assert.deepEqual(only('can_tin'), [false, true, true, true]);
  assert.deepEqual(only('pet_crushed'), [true, false, true, true]);
  assert.deepEqual(only('pack_milk'), [true, true, false, true]);
  assert.deepEqual(only('battery_aa'), [true, true, true, false]);
  assert.equal(judge(m2, bagOf({ ...M2_ALL2, battery_aa: 0 }), cfg).scenes[3].failKind, 'danger');
});

test('f_battery x2 fails S1 and S4 as danger', () => {
  const r = judge(m2, bagOf(M2_ALL2).concat(fakesOf('f_battery', 2)), cfg);
  assert.deepEqual(r.scenes.map((s) => s.failKind), ['danger', null, null, 'danger']);
});

test('m2 fake cat cannot be fixed', () => {
  for (const l of m2.labels) assert.equal(Cards.isMislabeled(m2, { id: 'c', fakeId: 'f_cat', label: l.id }), true, l.id);
});

test('no forbidden copy (m2)', () => {
  assert.ok(!/지하차도|%|AI가 틀렸|당신이 실패/.test(JSON.stringify(m2)));
});

test('cast covers every speaker (m2)', () => {
  const lines = Object.values(m2.story).flatMap((v) => (Array.isArray(v) ? v : v && v.who ? [v] : []));
  for (const l of lines) assert.ok(cast[l.who], l.who);
  assert.equal(cast.sorter.name, '선별장 직원');
  assert.ok(m2.story.recordLine.firstTry && m2.story.recordLine.supplemented);
  assert.ok(m2.story.intro.some((l) => l.who === 'senior'));
  assert.ok(m2.story.intro.some((l) => l.who === 'bot' && /이름표/.test(l.text)));
  assert.equal(m2.story.conveyorIntro.text, '그럼, 실제로 돌려 보자.');
});

test('config has conveyor step', () => {
  assert.ok(cfg.conveyor && cfg.conveyor.step > 0);
});

// [2] 1 임무 S1이 오염으로 '불편' 실패할 때: 그림과 문구가 같은 말("물이 없는 옆 골목까지 막혔다")
test('m1 S1 inconvenience says the dry side alley was closed', () => {
  const s1 = m1.scenes[0];
  assert.match(s1.cuts.inconvenience, /물이 없는 옆 골목/);
  assert.equal(s1.art.inconvenience.water, 'dry');
});
test('every combo names what was missing (what), no fixed sentence', () => {
  for (const m of [m1, m2, tutorial]) for (const c of combos(m)) { assert.ok(c.what, c.id); assert.equal(c.missingLine, undefined, c.id); }
});

// 대화 초상 표정(face): 지정이 없으면 기본. 쓸 수 있는 값만
test('dialogue faces are valid', () => {
  const m3 = require('../missions/m3.js');
  const ok = new Set([undefined, 'basic', 'happy', 'worried', 'explain']);
  const all = [];
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.who && v.text) all.push(v); else Object.values(v).forEach(walk); } };
  for (const m of [tutorial, m1, m2, m3]) walk(m.story);
  assert.ok(all.length > 50);
  for (const l of all) assert.ok(ok.has(l.face), l.who + ' ' + l.face);
  assert.ok(all.filter((l) => l.face).length >= 25, 'most emotional lines carry a face');
});

// 4 임무 동기 줄기(설계 §5.8): 1~3 임무 도입에 동기의 "이상한 건 빼자" 한 줄씩 — 정답을 말하지 않는다
test('peer says "leave the odd ones out" once in each of missions 1~3 (never the answer)', () => {
  const m3 = require('../missions/m3.js');
  const want = {
    m1: [m1, '흙탕물처럼 애매한 사진은 그냥 빼자. 이상한 건 AI만 헷갈려.', (i, l) => l[i - 1].who === 'peer' && /자격 딴 동기/.test(l[i - 1].text)],
    m2: [m2, '찌그러진 페트병 같은 건 빼자. 이상한 건 빼는 게 깔끔하잖아.', (i, l) => l[i - 1].who === 'sorter' && /추가 경보/.test(l[i + 1].text)],
    m3: [m3, '옛날 사진은 그냥 다 빼면 되겠네. 이상한 건 빼는 게 제일 안전해.', (i, l) => l[i - 1].who === 'peer' && /누가 이런 걸 시킨 거지/.test(l[i - 1].text)]
  };
  for (const [id, [m, text, where]] of Object.entries(want)) {
    const lines = m.story.intro, hits = lines.filter((l) => l.who === 'peer' && /빼/.test(l.text));
    assert.equal(hits.length, 1, id);
    assert.equal(hits[0].text, text, id);
    assert.equal(hits[0].face, 'basic', id);
    assert.ok(where(lines.indexOf(hits[0]), lines), id + ' position');
    assert.ok(!lines.some((l) => l.who === 'peer' && /넣자|지키자/.test(l.text)), id + ' never says the answer');
  }
});
