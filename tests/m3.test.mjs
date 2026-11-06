// 3 임무 「길 안내 AI」(설계 2026-11-01 §4): 오래된 자료 — 날짜 + 도시 변경 기록, 지금도 그대로인 옛 사진은 지킨다
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rareWallOf, cardsOf } from './walls-helper.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const Rng = require('../js/rng.js');
const Cards = require('../js/cards.js');
const { judge, missingLine } = require('../js/judge.js');
const Conveyor = require('../js/conveyor.js');
const Stream = require('../js/stream.js');
const cast = require('../missions/cast.js');
const m1 = require('../missions/legacy-flood.js'), m2 = require('../missions/m2.js'), tut = require('../missions/tutorial.js');
const m3 = require('../missions/m3.js');

const combos = (m) => m.scenes.flatMap((s) => s.combos);
const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const fk = (id, n) => Array.from({ length: n }, (_, i) => ({ id: id + '_' + i, fakeId: id }));
const ALL = { station_now: 2, station_rain: 2, market_now: 2, market_old: 1, market_eve_old: 2, river_now: 2, river_night: 2, crossing_now: 2, crossing_rain: 2 };

test('m3 well-formed', () => {
  assert.equal(m3.id, 'm3');
  assert.equal(m3.relabel, false);
  assert.deepEqual(m3.labels.map((l) => l.id), ['station', 'market', 'river', 'crossing']);
  const labelIds = new Set(m3.labels.map((l) => l.id));
  for (const [k, t] of Object.entries(m3.cardTypes)) {
    assert.ok(labelIds.has(t.label), k); assert.deepEqual(t.icons, [t.label], k);
    assert.ok(t.name && t.art && Array.isArray(t.dates) && t.dates.length === 3, k);
    assert.ok(m3.counts[k] >= 2, k);
  }
  for (const f of m3.fakes) {
    assert.ok(labelIds.has(f.label) && f.truth === null && f.name && f.art && f.dates.length === 3, f.id);
    assert.match(f.line, /^우리가 넣은 데이터에 .+\.$/, f.id);
  }
  for (const c of combos(m3)) { assert.ok(c.what, c.id); for (const k of c.keys) assert.ok(m3.cardTypes[k], c.id); }
  assert.deepEqual(m3.scenes.map((s) => s.id), ['S1', 'S2', 'S3', 'S4']);
  assert.equal(m3.scenes[3].emphasis, 'low');
  for (const s of m3.scenes) assert.ok(s.passLine && s.cuts.danger && s.cuts.inconvenience, s.id);
  // 도시 변경 기록: 장소마다 한 줄
  assert.deepEqual(m3.changeLog.map((c) => c.label).sort(), ['crossing', 'market', 'river', 'station']);
  assert.ok(!/지하차도|지하보도|%|AI가 틀렸|당신이 실패/.test(JSON.stringify(m3)));
});

test('every card carries a shooting date (dates are never a tell by themselves)', () => {
  for (const id of [...Object.keys(m3.cardTypes), ...m3.fakes.map((f) => f.id)]) {
    for (const v of [0, 1, 2]) assert.match(Cards.dateOf(m3, { key: m3.cardTypes[id] ? id : undefined, fakeId: m3.cardTypes[id] ? undefined : id, id: 'c' + v }, v), /^\d{4}년 \d{1,2}월$/, id);
  }
  // 지금도 그대로인 옛 사진과 바뀐 곳의 옛 사진 둘 다 옛 날짜(날짜만으로 고르면 안 된다)
  assert.ok(m3.cardTypes.market_old.dates.every((d) => +d.slice(0, 4) <= 2021));
  assert.ok(m3.fakes.every((f) => f.dates.every((d) => +d.slice(0, 4) <= 2023)));
});

test('m3 passes in 30 cards keeping the old-but-unchanged market photos', () => {
  const bag = bagOf({ ...ALL, station_now: 7, river_now: 5, crossing_now: 4, market_old: 4 });
  assert.equal(bag.length, 30);
  assert.equal(judge(m3, bag, cfg).allPass, true);
});

test('removing every old-dated photo fails the market scene only (principle 2)', () => {
  const r = judge(m3, bagOf({ ...ALL, market_old: 0, market_eve_old: 0 }), cfg);
  assert.deepEqual(r.scenes.map((s) => s.pass), [true, false, true, true]);
  assert.equal(missingLine(m3, 'S2_market', 2), '우리가 넣은 데이터에는 시장 골목 사진이 부족했다.');
});

test('every scene can fail on its own; S4 danger', () => {
  const only = (drop) => judge(m3, bagOf({ ...ALL, [drop]: 0 }), cfg).scenes.map((s) => s.pass);
  assert.deepEqual(only('station_rain'), [false, true, true, true]);
  assert.deepEqual(only('market_eve_old'), [true, false, true, true]);
  assert.deepEqual(only('river_night'), [true, true, false, true]);
  assert.deepEqual(only('crossing_now'), [true, true, true, false]);
  assert.equal(judge(m3, bagOf({ ...ALL, crossing_now: 0 }), cfg).scenes[3].failKind, 'danger');
});

test('outdated photos of a changed place stack on that place; the old overpass is danger', () => {
  const r = judge(m3, bagOf(ALL).concat(fk('o_crossing', 2)), cfg);
  assert.deepEqual(r.scenes.map((s) => s.failKind), [null, null, null, 'danger']);
  const r2 = judge(m3, bagOf(ALL).concat(fk('o_station', 2)), cfg);
  assert.deepEqual(r2.scenes.map((s) => s.failKind), ['inconvenience', null, null, null]);
  assert.equal(judge(m3, bagOf(ALL).concat(fk('o_river', 1)), cfg).allPass, true, 'one is harmless on first submit');
  assert.equal(Cards.harm(m3, { fakeId: 'o_crossing' }), 'danger');
  assert.equal(Cards.harm(m3, { fakeId: 'o_station' }), 'inconvenience');
});

test('screen counts follow the attached label (outdated photo shows as that place)', () => {
  assert.equal(Cards.displayKey(m3, { fakeId: 'o_station' }), 'station_now');
  assert.equal(Cards.cardLabel(m3, { fakeId: 'o_crossing' }), '학교 앞 횡단보도');
  assert.equal(Cards.cardLabel(m3, { key: 'market_old' }), '시장 골목');
});

// 길 안내 시연(컨베이어와 같은 원인 규칙)
const sortG = (bag, named) => Conveyor.sort({ ...m3, conveyor: m3.guide }, judge(m3, bag, cfg, { named }));
test('guide: every cause has a question; all right when nothing failed', () => {
  const causes = new Set(m3.guide.flatMap((g) => g.causes));
  for (const c of combos(m3)) assert.ok(causes.has(c.id), c.id);
  for (const f of m3.fakes) assert.ok(causes.has(f.id), f.id);
  for (const s of ['S1', 'S3', 'S4']) assert.ok(causes.has('contaminated:' + s), s);
  assert.ok(causes.has('danger:S4'));
  for (const g of m3.guide) { assert.ok(g.q && g.right && g.wrong && g.scene, g.id); assert.equal(g.bin, 'right'); assert.equal(g.wrongBin, 'wrong'); }
  assert.ok(sortG(bagOf(ALL)).every((o) => o.correct && !o.emergency));
});
test('guide: passing scenes all right, danger scene <=> stop (random bags)', () => {
  const rng = Rng.create(3), keys = Object.keys(m3.cardTypes);
  for (let n = 0; n < 80; n++) {
    const bag = [];
    for (let i = 0; i < 30; i++) {
      if (rng.next() < 0.25) bag.push({ id: 'f' + i, fakeId: m3.fakes[Math.floor(rng.next() * m3.fakes.length)].id });
      else bag.push({ id: 'k' + i, key: keys[Math.floor(rng.next() * keys.length)] });
    }
    const r = judge(m3, bag, cfg), out = Conveyor.sort({ ...m3, conveyor: m3.guide }, r);
    for (const s of r.scenes) {
      if (s.pass) assert.ok(out.filter((o) => o.scene === s.id).every((o) => o.correct), n + ' ' + s.id);
      assert.equal(s.failKind === 'danger', out.some((o) => o.scene === s.id && o.emergency), n + ' ' + s.id);
    }
  }
});

// 구역·코스
test('m3 run: four zones, counts, fakes late in their zone and never in the first 15%, rare walls', () => {
  for (const seed of [3301, 3302, 1, 42]) {
    const c = Stream.build(m3, cfg, { seed });
    assert.deepEqual(c.zones.map((z) => z.id), ['S1', 'S2', 'S3', 'S4']);
    const cards = c.items.filter((i) => i.kind === 'card');
    for (const [key, count] of Object.entries(m3.counts)) assert.equal(cards.filter((i) => i.key === key).length, count, key);
    for (const it of cards) {
      const z = c.zones.find((zz) => zz.id === it.zoneId);
      if (it.fakeId) { assert.ok(it.z >= c.length * 0.15 && it.z >= (z.start + z.end) / 2 - 1e-9, it.fakeId); }
      if (m3.cardTypes[it.key]?.rare) assert.ok(rareWallOf(c, it), it.key);
    }
    assert.deepEqual(c, Stream.build(m3, cfg, { seed }));
  }
});
test('flood, m2 courses unchanged by m3', () => {
  const before = JSON.parse(fs.readFileSync(new URL('./fixtures/courses-before-m3.json', import.meta.url)));
  for (const seed of [1101, 1102, 42]) assert.deepEqual(cardsOf(Stream.build(m1, cfg, { seed })), cardsOf(before['m1_' + seed]));
  for (const seed of [2201, 2202, 42]) assert.deepEqual(cardsOf(Stream.build(m2, cfg, { seed })), cardsOf(before['m2_' + seed]));
  assert.deepEqual(cardsOf(Stream.build(m1, cfg, { seed: 1102, focusCounts: { night_deep: 2 } })), cardsOf(before.m1_sup));
  assert.deepEqual(cardsOf(Stream.build(m2, cfg, { seed: 2202, focusCounts: { battery_aa: 2 } })), cardsOf(before.m2_sup));
});

// 이야기·잇기
test('m3 story: speakers, record line from m2, reveal with and without a record', () => {
  const lines = Object.values(m3.story).flatMap((v) => (Array.isArray(v) ? v : v && v.who ? [v] : []));
  for (const l of lines) assert.ok(cast[l.who], l.who);
  assert.equal(cast.courier.name, '택배 기사');
  assert.equal(m2.next, 'm3');
  assert.equal(m3.next, 'm4', 'm3 chains to m4');
  // 가상 시험 이름은 "새빛 진학 평가" 하나(4 임무와 같은 이름)
  assert.match(JSON.stringify(m3.story), /새빛 진학 평가/);
  assert.ok(!/입학 평가/.test(JSON.stringify(m3)), 'old exam name gone');
  assert.ok(m3.story.recordLine.firstTry && m3.story.recordLine.supplemented);
  const rv = m3.story.reveal;
  assert.match(rv.withRecord.text, /\{mission\}/); assert.match(rv.withRecord.text, /\{scene\}/);
  assert.ok(rv.withoutRecord.text && rv.before.length && rv.after.length);
  assert.ok(!/바보|못했|한심|틀렸잖/.test(JSON.stringify(rv)), 'no shaming');
  assert.ok(rv.before.some((l) => l.who === 'senior' && /불꽃/.test(l.text)), '그 불꽃, 나였어');
  // 정체 공개 장면 그림(대화창 뒤 bg) — 게임 폴더 안 실제 파일
  assert.equal(rv.bg, 'assets/story/reveal-senior.webp');
  assert.ok(fs.existsSync(new URL('../' + rv.bg, import.meta.url)), rv.bg);
});

// 리뷰 반영
test('review I1: no kind name marks a photo as old; market photos count as one kind on screen', () => {
  for (const [k, t] of Object.entries(m3.cardTypes)) assert.ok(!/예전|옛|오래/.test(t.name), k + ' ' + t.name);
  assert.equal(Cards.displayKey(m3, { key: 'market_old' }), 'market_now');
  assert.deepEqual(Cards.labelCounts(m3, [{ key: 'market_old' }, { key: 'market_now' }, { key: 'market_old' }]), { market_now: 3 });
});
test('review I3/I4: each S1/S2/S3 combo has its own failure line matching what is missing', () => {
  const r = judge(m3, bagOf({ ...ALL, station_rain: 0 }), cfg).scenes[0];
  assert.doesNotMatch(r.failLine, /빌딩/, 'rain missing ≠ old building');
  const m = judge(m3, bagOf({ ...ALL, market_old: 0, market_eve_old: 0 }), cfg).scenes[1];
  assert.match(m.failLine, /2015년 뒤로 그대로/);
  for (const id of ['S1_station_now', 'S1_station_rain', 'S2_market', 'S2_market_eve', 'S3_river_now', 'S3_river_night']) {
    const c = combos(m3).find((x) => x.id === id);
    assert.ok(c.fail && c.fail.kind === 'inconvenience' && c.fail.line, id);
  }
});
test('review: m3 run hint points at the date, not picture-vs-label', () => {
  assert.ok(m3.fakeHint && !/이름표/.test(m3.fakeHint));
});
