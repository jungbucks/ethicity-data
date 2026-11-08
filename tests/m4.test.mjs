// 4 임무 「채점 AI」 낱말 손글씨판(설계 2026-11-08 m4-words, 흐름은 2026-11-01 §5 그대로):
// 이름표 = 보기 낱말 4개(데이터·알고리즘·인공지능·머신러닝). 카드 세 갈래 — ① 이상해 보이지만 맞음 · ② 이상하고 틀림 · ③ 깔끔하지만 틀림.
// 판단 기준은 "모양이 이상한가"가 아니라 "글씨와 이름표 낱말이 맞는가". 이상한 걸 다 빼면 S4(결판)는 반드시 실패
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rareWallOf, cardsOf } from './walls-helper.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const Rng = require('../js/rng.js');
const Cards = require('../js/cards.js');
const Judge = require('../js/judge.js');
const { judge } = Judge;
const Stream = require('../js/stream.js');
const cast = require('../missions/cast.js');
const m1 = require('../missions/legacy-flood.js'), m2 = require('../missions/m2.js'), m3 = require('../missions/m3.js');
const m4 = require('../missions/m4.js');

const combos = (m) => m.scenes.flatMap((s) => s.combos);
const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const fk = (id, n, label) => Array.from({ length: n }, (_, i) => Object.assign({ id: id + '_' + i, fakeId: id }, label ? { label } : {}));
const WORDS = ['data', 'algo', 'ai', 'ml'];
// 첫 판 통과 최소 가방(16장): 또박또박 4 · 흘려 쓴 인공지능 2 · 흘려 쓴 알고리즘 2 · 'AI' 2 · 'data' 2 · '머신 러닝' 2 · 아주 흘린 머신러닝 2
const MIN = { neat_data: 1, neat_algo: 1, neat_ai: 1, neat_ml: 1, cur_ai: 2, cur_algo: 2, alt_ai: 2, alt_data: 2, alt_ml: 2, scrawl_ml: 2 };
const kinds = (r) => r.scenes.map((s) => s.failKind);
const ODD = Object.keys(m4.cardTypes).filter((k) => m4.cardTypes[k].group === 1);

test('m4 well-formed: labels are the four words, two off-list words only on fakes', () => {
  assert.equal(m4.id, 'm4');
  assert.equal(m4.title, '채점 AI');
  assert.deepEqual([m4.bag, m4.runSeconds, m4.supplementSeconds, m4.seed, m4.fires], [30, 90, 30, 4401, 8]);
  assert.deepEqual(m4.labels.map((l) => [l.id, l.text]), [['data', '데이터'], ['algo', '알고리즘'], ['ai', '인공지능'], ['ml', '머신러닝']]);
  assert.deepEqual(m4.labelOptions.map((l) => l.id), WORDS);
  assert.deepEqual(m4.labelExtra.map((l) => [l.id, l.short]), [['date', '데이트'], ['en_ai', 'AI']]);
  for (const l of m4.labelExtra) assert.match(l.text, /보기에 없는 낱말/);
  assert.equal(m4.labelStyle, 'word');
  assert.equal(m4.showdownScene, 'S4');
  assert.equal(m4.rareLate, undefined, 'S2~S4 hold no plain cards to swap with — walls mark the odd ones instead');
  assert.deepEqual(m4.zones.map((z) => z.title), ['또박또박 쓴 답', '흘려 쓴 답', '다른 표현', '선배의 옛 답안']);
  for (const [k, t] of Object.entries(m4.cardTypes)) {
    assert.ok(WORDS.includes(t.label), k); assert.deepEqual(t.icons, [t.label], k);
    assert.ok(t.name && t.art && t.art.word && t.art.hand, k);
    assert.ok(!/헷갈|틀린|못 쓴|악필|엉망|삐뚤|이상한/.test(t.name), k + ' name gives nothing away');
    assert.equal(!!t.rare, t.group === 1, k + ' odd-looking-but-right = rare');
  }
  for (const f of m4.fakes) {
    assert.ok(WORDS.includes(f.label) || f.label === 'date' || f.label === 'en_ai', f.id);
    assert.ok(Array.isArray(f.scenes) && f.scenes.length && !f.scenes.includes('S4'), f.id + ' never aims at S4');
    assert.match(f.line, /^우리가 넣은 데이터에 .+\.$/, f.id);
    assert.ok(typeof f.cut === 'string' && f.cut.length > 8, f.id + ' cut');
    assert.ok([2, 3].includes(f.group), f.id);
  }
  for (const c of combos(m4)) { assert.ok(c.what && c.item, c.id); for (const k of c.keys) assert.ok(m4.cardTypes[k], c.id + ' ' + k); }
  assert.deepEqual(m4.scenes.map((s) => s.id), ['S1', 'S2', 'S3', 'S4']);
  assert.equal(m4.scenes[3].emphasis, 'low');
  for (const s of m4.scenes) assert.ok(s.passLine && s.cuts.danger && s.cuts.inconvenience, s.id);
  assert.deepEqual(m4.ambiguous.map((a) => [a.id, a.truthKey, a.correctLabel]), [['q_ai', 'cur_ai', 'ai'], ['q_algo', 'cur_algo', 'algo']]);
  for (const a of m4.ambiguous) { assert.deepEqual(a.icons, ['unknown']); assert.equal(a.clues.length, 2); }
  assert.ok(m4.cutTemplate && m4.cutTemplate.inconvenience && m4.cutTemplate.danger);
  assert.equal(cast.grader.name, '채점 담당 선생님');
});

test('three kinds of card: ③ neat-but-wrong = 4, ① odd-but-right about twice ② odd-and-wrong', () => {
  const g3 = m4.fakes.filter((f) => f.group === 3), g2 = m4.fakes.filter((f) => f.group === 2);
  const n3 = g3.reduce((n, f) => n + f.count, 0), n2 = g2.reduce((n, f) => n + f.count, 0);
  const n1 = ODD.reduce((n, k) => n + m4.counts[k], 0);
  assert.equal(n3, 4, '③ = 4 (highest difficulty)');
  for (const f of g3) { assert.equal(f.art.hand, 'neat', f.id); assert.ok(WORDS.includes(f.label), f.id + ' wrong word from the list'); }
  for (const f of g2) assert.ok(!f.art.hand || f.art.hand !== 'neat' || f.art.alt, f.id + ' looks odd');
  assert.ok(n1 / n2 >= 1.8 && n1 / n2 <= 2.5, `①:② = ${n1}:${n2}`);
  // 결판 장면(S4)은 ①만으로 채워진다 — 이상한 걸 다 빼면 반드시 실패
  for (const c of m4.scenes[3].combos) for (const k of c.keys) assert.equal(m4.cardTypes[k].group, 1, k);
  // ③은 반듯한 글씨 + 보기 안의 다른 낱말(예: 반듯한 '알고리즘'에 '인공지능')
  for (const f of g3) assert.notEqual(f.label, m4.cardTypes[f.truth].label, f.id);
  // 코스 합계: 평범 12 + ① 19 + ② 9 + ③ 4 + "?" 2 = 46
  const total = Object.values(m4.counts).reduce((a, b) => a + b, 0) + m4.fakes.reduce((n, f) => n + f.count, 0) + m4.ambiguous.length;
  assert.equal(total, 46);
});

test('label text: the four words and the off-list words', () => {
  assert.equal(Cards.labelText(m4, 'ai'), '인공지능');
  assert.match(Cards.labelText(m4, 'date'), /^데이트.*보기에 없는 낱말/);
  assert.equal(Cards.labelShort(m4, 'date'), '데이트');
  assert.equal(Cards.labelShort(m4, 'en_ai'), 'AI');
  assert.equal(Cards.labelShort(m4, 'ml'), '머신러닝');
  assert.match(Cards.cardLabel(m4, { fakeId: 'x_date' }), /보기에 없는 낱말/);
  assert.equal(Cards.cardLabel(m4, { key: 'cur_ai' }), '인공지능');
  assert.equal(Cards.cardLabel(m4, { fakeId: 'x_neat_algo' }), '인공지능', '③ shows a normal-looking label');
  assert.equal(Cards.cardLabel(m4, { ambiguousId: 'q_ai' }), '?');
  assert.equal(Cards.cardLabel(m4, { ambiguousId: 'q_ai', assigned: null }), '? (넣지 않기)');
  assert.equal(Cards.cardLabel(m4, { ambiguousId: 'q_ai', assigned: 'algo' }), '알고리즘');
  assert.deepEqual(Cards.iconsOf(m4, { ambiguousId: 'q_ai', assigned: 'ai' }), ['ai']);
  // 화면 개수: 붙은 이름표의 보통 종류(정체를 드러내지 않음), 보기 밖 낱말은 그 이름표 자체
  assert.equal(Cards.displayKey(m4, { fakeId: 'x_neat_algo' }), 'neat_ai');
  assert.equal(Cards.displayKey(m4, { ambiguousId: 'q_ai', assigned: 'algo' }), 'neat_algo');
  assert.deepEqual(Cards.labelCounts(m4, [{ fakeId: 'x_date' }, { fakeId: 'x_date' }, { fakeId: 'x_ai_raw' }]), { date: 2, en_ai: 1 });
  // 달리기 색: 보기 밖 낱말도 같은 결(색으로 정체를 드러내지 않음)
  for (const id of WORDS.concat(['date', 'en_ai'])) assert.match(Cards.labelColors[id], /^#[0-9a-f]{6}$/i, id);
});

test('the minimum 16-card bag passes the first submit and reads the senior answer', () => {
  const bag = bagOf(MIN);
  assert.equal(bag.length, 16);
  const r = judge(m4, bag, cfg);
  assert.equal(r.allPass, true);
  assert.equal(Judge.readable(m4, r), true);
});

test('every scene can fail on its own; S2·S4 danger (looks like another word), S1·S3 inconvenience (to a person)', () => {
  const only = (drop) => kinds(judge(m4, bagOf({ ...MIN, ...drop }), cfg));
  assert.deepEqual(only({ neat_data: 0 }), ['inconvenience', null, null, null]);
  assert.deepEqual(only({ cur_ai: 1 }), [null, 'danger', null, null]);
  assert.deepEqual(only({ cur_algo: 0 }), [null, 'danger', null, null]);
  assert.deepEqual(only({ alt_ai: 1 }), [null, null, 'inconvenience', null]);
  assert.deepEqual(only({ alt_data: 0 }), [null, null, 'inconvenience', null]);
  assert.deepEqual(only({ scrawl_ml: 1 }), [null, null, null, 'danger']);
  assert.deepEqual(only({ alt_ml: 1 }), [null, null, 'inconvenience', 'inconvenience'], "'머신 러닝' is shared by S3 and S4");
  assert.match(judge(m4, bagOf({ ...MIN, cur_ai: 0 }), cfg).scenes[1].failLine, /'알고리즘'으로 읽었다/);
  const s4 = judge(m4, bagOf({ ...MIN, scrawl_ml: 0 }), cfg).scenes[3];
  assert.match(s4.failLine, /'인공지능'으로 읽었다/);
  assert.equal(Judge.readable(m4, judge(m4, bagOf({ ...MIN, scrawl_ml: 0 }), cfg)), false);
  assert.equal(Judge.readable(m4, judge(m4, bagOf({ ...MIN, alt_ml: 0 }), cfg)), false);
});

test('principle: "throw out everything odd-looking" always fails S4 (random bags)', () => {
  const rng = Rng.create(4), keys = Object.keys(m4.cardTypes).filter((k) => m4.cardTypes[k].group !== 1);
  for (let n = 0; n < 200; n++) {
    const bag = [];
    for (let i = 0; i < 30; i++) {
      const x = rng.next();
      if (x < 0.15) bag.push({ id: 'f' + i, fakeId: m4.fakes[Math.floor(rng.next() * m4.fakes.length)].id });
      else if (x < 0.2) bag.push({ id: 'q' + i, ambiguousId: m4.ambiguous[Math.floor(rng.next() * 2)].id, assigned: WORDS[Math.floor(rng.next() * 4)] });
      else bag.push({ id: 'k' + i, key: keys[Math.floor(rng.next() * keys.length)] });
    }
    const r = judge(m4, bag, cfg);
    assert.equal(r.scenes[3].pass, false, 'bag ' + n);
    assert.equal(Judge.readable(m4, r), false);
  }
});

test('instinct: keeping every neat card (③ included) contaminates S1 as danger; fixing ③ counts as neat', () => {
  const r = judge(m4, bagOf(MIN).concat(fk('x_neat_algo', 2)), cfg);
  assert.deepEqual(kinds(r), ['danger', null, null, null]);
  assert.deepEqual(r.scenes[0].contaminated, ['x_neat_algo']);
  // 한 장씩 두 종류도 오염(한 장면에 틀린 이름표 2장 이상)
  assert.equal(judge(m4, bagOf(MIN).concat(fk('x_neat_algo', 1), fk('x_neat_data', 1)), cfg).scenes[0].failKind, 'danger');
  assert.equal(judge(m4, bagOf(MIN).concat(fk('x_neat_algo', 1)), cfg).allPass, true, 'one is harmless on the first submit');
  // 맞는 낱말로 고치면 그 반듯한 글씨로 센다
  const fixed = judge(m4, bagOf({ ...MIN, neat_algo: 0, neat_data: 0 }).concat(fk('x_neat_algo', 1, 'algo'), fk('x_neat_data', 1, 'data')), cfg);
  assert.equal(fixed.allPass, true);
  assert.equal(Cards.harm(m4, { fakeId: 'x_neat_data' }), 'danger');
});

test('② cursive with a swapped word = S2 danger; fixing counts as the cursive word', () => {
  assert.deepEqual(kinds(judge(m4, bagOf(MIN).concat(fk('x_algo_ai', 2)), cfg)), [null, 'danger', null, null]);
  assert.equal(judge(m4, bagOf({ ...MIN, cur_algo: 0 }).concat(fk('x_algo_ai', 2, 'algo')), cfg).allPass, true);
  assert.equal(judge(m4, bagOf({ ...MIN, cur_ai: 1 }).concat(fk('x_ai_algo', 1, 'ai')), cfg).allPass, true);
});

test("② off-list words ('데이트', 'AI'): two = S3 danger; fixing to the list word counts; they never fill a combo", () => {
  assert.deepEqual(kinds(judge(m4, bagOf(MIN).concat(fk('x_date', 2)), cfg)), [null, null, 'danger', null]);
  assert.deepEqual(kinds(judge(m4, bagOf(MIN).concat(fk('x_date', 1), fk('x_ai_raw', 1)), cfg)), [null, null, 'danger', null]);
  assert.equal(judge(m4, bagOf({ ...MIN, alt_data: 0 }).concat(fk('x_date', 2, 'data')), cfg).allPass, true);
  assert.equal(judge(m4, bagOf({ ...MIN, alt_ai: 0 }).concat(fk('x_ai_raw', 2, 'ai')), cfg).allPass, true);
  for (const id of ['x_date', 'x_ai_raw']) {
    const r = judge(m4, fk(id, 1), cfg);
    for (const s of r.scenes) for (const c of m4.scenes.find((x) => x.id === s.id).combos) assert.equal((s.missingHave[c.id] || 0), 0, id + ' ' + c.id);
  }
  assert.deepEqual(Cards.scenesForLabel(m4, 'date'), []);
  assert.deepEqual(Cards.scenesForLabel(m4, 'en_ai'), []);
});

test('the scribble cannot be fixed; two of them = S1 inconvenience', () => {
  const f = m4.fakes.find((x) => x.id === 'x_scribble');
  assert.equal(f.truth, null);
  for (const l of WORDS) assert.equal(Cards.isMislabeled(m4, { fakeId: 'x_scribble', label: l }), true, l);
  assert.deepEqual(kinds(judge(m4, bagOf(MIN).concat(fk('x_scribble', 2)), cfg)), ['inconvenience', null, null, null]);
});

test('"?" cards: right word counts twice, wrong word counts nothing', () => {
  assert.equal(judge(m4, bagOf({ ...MIN, cur_ai: 0 }).concat([{ id: 'q', ambiguousId: 'q_ai', assigned: 'ai' }]), cfg).allPass, true);
  assert.equal(judge(m4, bagOf({ ...MIN, cur_algo: 0 }).concat([{ id: 'q', ambiguousId: 'q_algo', assigned: 'algo' }]), cfg).allPass, true);
  const r = judge(m4, bagOf({ ...MIN, cur_ai: 0 }).concat([{ id: 'q', ambiguousId: 'q_ai', assigned: 'algo' }]), cfg);
  assert.equal(r.scenes[1].pass, false);
  assert.deepEqual(r.mislabeled, ['q']);
});

test('fakeScenes: data scenes while the original label stays, label scenes once changed', () => {
  assert.deepEqual(Cards.fakeScenes(m4, { fakeId: 'x_scribble' }), ['S1']);
  assert.deepEqual(Cards.fakeScenes(m4, { fakeId: 'x_neat_algo' }), ['S1']);
  assert.deepEqual(Cards.fakeScenes(m4, { fakeId: 'x_date' }), ['S3']);
  assert.deepEqual(Cards.fakeScenes(m4, { fakeId: 'x_algo_ai', label: 'ml' }), Cards.scenesForLabel(m4, 'ml'));
});

test('readable ignores contamination (only the S4 combos count)', () => {
  const bag = bagOf(MIN).concat([{ id: 'w1', key: 'neat_ai', label: 'ml' }, { id: 'w2', key: 'neat_ai', label: 'ml' }]);
  const r = judge(m4, bag, cfg);
  assert.equal(r.scenes[3].pass, false);
  assert.ok(r.scenes[3].contaminated.length);
  assert.equal(Judge.readable(m4, r), true);
});

test('copy: no digits-era words, no real exam/school names, no %, no shaming handwriting words', () => {
  const txt = JSON.stringify(m4);
  assert.ok(!/%|지하차도|못 쓴|악필|엉망|삐뚤|수능|모의고사|학력평가|대학/.test(txt));
  assert.ok(!/선택지|번호|크게 기운|표 안|[1-8]번|1을 7|3을 8/.test(JSON.stringify(m4.story) + JSON.stringify(m4.scenes) + JSON.stringify(m4.chapterEnd)), 'digit-era copy is gone');
  for (const m of [m3, m4]) for (const hit of JSON.stringify(m).match(/[^"]*때문에 떨어졌[^"]*/g) || []) assert.match(hit, /생각|믿/, hit);
});

// 코스: 구역 4개, 가짜는 자기 구역 뒤쪽 절반, ①("?" 포함) 앞엔 벽
test('m4 run: four zones, counts, fakes late in their own zone, walls before odd-but-right', () => {
  for (const seed of [4401, 1, 42, 7]) {
    const c = Stream.build(m4, cfg, { seed });
    assert.deepEqual(c.zones.map((z) => z.id), ['S1', 'S2', 'S3', 'S4']);
    const cards = c.items.filter((i) => i.kind === 'card');
    for (const [key, count] of Object.entries(m4.counts)) assert.equal(cards.filter((i) => i.key === key).length, count, key);
    for (const f of m4.fakes) assert.equal(cards.filter((i) => i.fakeId === f.id).length, f.count, f.id);
    for (const it of cards) {
      const z = c.zones.find((zz) => zz.id === it.zoneId);
      assert.ok(it.z >= z.start && it.z < z.end, it.uid);
      if (it.fakeId) {
        const f = m4.fakes.find((x) => x.id === it.fakeId);
        assert.equal(it.zoneId, f.scenes[f.scenes.length - 1], it.fakeId);
        assert.ok(it.z >= c.length * 0.15 && it.z >= (z.start + z.end) / 2 - 1e-9, it.fakeId + ' late');
      }
      if (it.ambiguousId || m4.cardTypes[it.key]?.rare) assert.ok(rareWallOf(c, it), it.uid + ' wall');
    }
    assert.deepEqual(c, Stream.build(m4, cfg, { seed }));
  }
});

// 스냅숏은 앞뒤 간격(cardStaggerSec, 2026-11-09) 전 배치 — 간격 0으로 만든 코스와 비교한다(stream.test가 실제 코스와의 관계를 지킨다)
const flat = { ...cfg, cardStaggerSec: 0 };
test('flood, m2, m3 courses unchanged by m4', () => {
  const before = JSON.parse(fs.readFileSync(new URL('./fixtures/courses-before-m4.json', import.meta.url)));
  for (const seed of [1101, 1102, 42]) assert.deepEqual(cardsOf(Stream.build(m1, flat, { seed })), cardsOf(before['m1_' + seed]));
  for (const seed of [2201, 2202, 42]) assert.deepEqual(cardsOf(Stream.build(m2, flat, { seed })), cardsOf(before['m2_' + seed]));
  for (const seed of [3301, 3302, 42]) assert.deepEqual(cardsOf(Stream.build(m3, flat, { seed })), cardsOf(before['m3_' + seed]));
});

test('m3 → m4: record line from mission 3, exam name only "새빛 진학 평가"', () => {
  assert.equal(m3.next, 'm4');
  assert.match(m4.story.recordLine.firstTry, /^3 임무/);
  assert.ok(m4.story.recordLine.supplemented);
  assert.match(m4.story.guideBrief, /새빛 진학 평가/);
  assert.match(m4.story.guideBrief, /데이터·알고리즘·인공지능·머신러닝/);
});

test('briefing samples: 3~4 real answer cards, never the senior style (that is for the showdown)', () => {
  const s = m4.briefSamples;
  assert.ok(s.length >= 3 && s.length <= 4);
  for (const x of s) { assert.ok(m4.cardTypes[x.art], x.art); assert.ok(x.cap); }
  assert.ok(!s.some((x) => x.art === 'scrawl_ml'));
  assert.ok(s.some((x) => m4.cardTypes[x.art].group === 1), 'shows at least one odd-but-right answer');
});

// 채점 시연(2 임무 컨베이어와 같은 원인 규칙)
const Conveyor = require('../js/conveyor.js');
const sortGr = (bag, named) => Conveyor.sort(m4, judge(m4, bag, cfg, { named }), m4.grading);
test('grading: well-formed sheets, every cause has a sheet, one real wrong answer', () => {
  const comboIds = new Set(combos(m4).map((c) => c.id)), fakeIds = new Set(m4.fakes.map((f) => f.id));
  const words = new Set(WORDS.concat(['date', 'en_ai']));
  assert.ok(m4.grading.length >= 11 && m4.grading.length <= 14);
  for (const g of m4.grading) {
    assert.ok(m4.cardTypes[g.art], g.id + ' art');
    assert.ok(WORDS.includes(g.chose) && WORDS.includes(g.answer), g.id);
    assert.equal(g.chose, m4.cardTypes[g.art].label, g.id + ' the sheet shows what the student wrote');
    assert.ok(['o', 'x'].includes(g.bin) && ['x', 'hold'].includes(g.wrongBin), g.id);
    for (const c of g.causes) assert.ok(comboIds.has(c) || /^(contaminated|danger):S[1-4]$/.test(c) || (/^any:/.test(c) && fakeIds.has(c.slice(4))), g.id + ' ' + c);
    if (g.hazard) { assert.equal(g.wrongBin, 'x', g.id); assert.ok(words.has(g.read) && g.read !== g.chose, g.id + ' misread'); }
    if (g.bin === 'o') assert.equal(g.chose, g.answer, g.id);
    assert.ok(g.variant >= 3, g.id + ' an unseen sheet');
  }
  const causes = new Set(m4.grading.flatMap((g) => g.causes));
  for (const c of comboIds) assert.ok(causes.has(c), c);
  for (const f of fakeIds) assert.ok(causes.has('any:' + f) || f === 'x_scribble', f);
  for (const s of ['S1', 'S2', 'S3', 'S4']) assert.ok(causes.has('danger:' + s), s);
  const real = m4.grading.filter((g) => g.bin === 'x');
  assert.equal(real.length, 1);
  assert.deepEqual(real[0].causes, []);
  assert.ok(sortGr(bagOf(MIN)).every((o) => o.correct && !o.emergency));
});
test('grading: passing scenes all right, danger scene <=> stop, real wrong answer always right (random bags, relabels too)', () => {
  const rng = Rng.create(44), keys = Object.keys(m4.cardTypes), L = WORDS.concat(['date', 'en_ai']);
  for (let n = 0; n < 400; n++) {
    const bag = [];
    for (let i = 0; i < 30; i++) {
      const x = rng.next();
      if (x < 0.2) {
        const c = { id: 'f' + i, fakeId: m4.fakes[Math.floor(rng.next() * m4.fakes.length)].id };
        if (rng.next() < 0.3) c.label = WORDS[Math.floor(rng.next() * 4)];
        bag.push(c);
      } else if (x < 0.25) bag.push({ id: 'q' + i, ambiguousId: m4.ambiguous[Math.floor(rng.next() * 2)].id, assigned: WORDS[Math.floor(rng.next() * 4)] });
      else {
        const c = { id: 'k' + i, key: keys[Math.floor(rng.next() * keys.length)] };
        if (rng.next() < 0.08) c.label = L[Math.floor(rng.next() * 4)];
        bag.push(c);
      }
    }
    const r = judge(m4, bag, cfg), out = Conveyor.sort(m4, r, m4.grading);
    for (const s of r.scenes) {
      if (s.pass) assert.ok(out.filter((o) => o.scene === s.id).every((o) => o.correct), n + ' ' + s.id);
      assert.equal(s.failKind === 'danger', out.some((o) => o.scene === s.id && o.emergency), n + ' ' + s.id + ' ' + JSON.stringify(s));
    }
    const real = out.find((o) => o.correctBin === 'x');
    assert.ok(real.correct && real.bin === 'x');
  }
});
test("grading: '데이트' on 'data' → the data sheet gets ✕ read as 데이트, with a stop; missing 'AI' → person", () => {
  const out = sortGr(bagOf(MIN).concat(fk('x_date', 2)));
  const d = out.find((o) => o.art === 'alt_data' && o.emergency);
  assert.ok(d && !d.correct && d.bin === 'x');
  assert.equal(m4.grading.find((g) => g.id === d.id).read, 'date');
  const t = sortGr(bagOf({ ...MIN, alt_ai: 0 }));
  assert.ok(t.filter((o) => !o.correct).length >= 1);
  assert.ok(t.filter((o) => !o.correct).every((o) => o.bin === 'hold' && !o.emergency));
});

// 결판 · 동기 합류 · 보충 보장
const Showdown = require('../js/showdown.js');
test('peer cards: 2 very-cursive 머신러닝 + 2 spaced 머신 러닝; peer cards alone make S4 readable', () => {
  const add = Showdown.peerCards(m4, [], false);
  assert.deepEqual(add.map((c) => c.key).sort(), ['alt_ml', 'alt_ml', 'scrawl_ml', 'scrawl_ml']);
  assert.equal(Judge.readable(m4, judge(m4, Showdown.peerCards(m4, [], true), cfg)), true);
});
test('showdown guarantee: random bags + random removals (never fixed ones) always end readable', () => {
  const rng = Rng.create(46), keys = Object.keys(m4.cardTypes);
  const pick = (a) => a[Math.floor(rng.next() * a.length)];
  const randomCard = (id) => (rng.next() < 0.15 ? { id, fakeId: pick(m4.fakes).id } : { id, key: pick(keys) });
  for (let n = 0; n < 500; n++) {
    let bag = Array.from({ length: Math.floor(rng.next() * 30) }, (_, i) => randomCard('a' + i));
    const st = { supplements: 0, peer: 'none' };
    let rounds = 0, readable = false, extra = 0;
    for (;;) {
      readable = Judge.readable(m4, judge(m4, bag, cfg));
      if (readable) break;
      const mode = Showdown.peerMode(st, cfg);
      st.peer = mode === 'removable' ? 'joined' : 'fixed';
      const add = Showdown.peerCards(m4, bag, mode !== 'removable');
      if (mode === 'resubmit') { bag = bag.concat(add); extra++; assert.ok(extra <= 1); continue; }
      bag = bag.filter((c) => c.fixed || rng.next() < 0.6);
      bag.forEach((c) => { if (!c.fixed && !c.fakeId && rng.next() < 0.1) c.label = pick(WORDS); });
      st.supplements++;
      bag = bag.concat(Array.from({ length: Math.floor(rng.next() * 8) }, (_, i) => randomCard('s' + st.supplements + '_' + i))).concat(add);
      bag = bag.filter((c) => c.fixed || rng.next() < 0.85);
      rounds++;
      assert.ok(rounds <= cfg.maxSupplements + 1, 'bag ' + n + ' did not converge');
    }
    assert.ok(readable, 'bag ' + n);
  }
});
test('m4 story: speakers in cast, backdrops exist, showdown copy in words, no scolding', () => {
  const lines = [];
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.who && v.text) lines.push(v); else Object.values(v).forEach(walk); } };
  walk(m4.story);
  assert.ok(lines.length > 25);
  for (const l of lines) { assert.ok(cast[l.who], l.who); assert.ok([undefined, 'basic', 'happy', 'worried', 'explain'].includes(l.face), l.who + ' ' + l.face); }
  const sd = m4.story.showdown;
  for (const f of [sd.bg, m4.story.after.bg, 'assets/characters/grader-portraits.png', 'assets/title/mission-m4.webp']) assert.ok(fs.existsSync(new URL('../' + f, import.meta.url)), f);
  assert.match(sd.readPass.text, /머신러닝 · ○/);
  assert.match(sd.readFail.text, /인공지능 · ✕/);
  assert.match(sd.readHold.text, /보기에 없는 낱말 · 사람 채점/);
  assert.ok(sd.sheetCap && sd.sheetCap.pass && sd.sheetCap.fail && sd.sheetCap.hold && sd.sheetAlt);
  assert.ok(sd.fail.some((l) => l.text === '봐, 또 지웠잖아.'));
  assert.ok(sd.peerJoin.some((l) => l.who === 'peer' && /이상한 건 빼자/.test(l.text) && /모아 뒀어/.test(l.text)));
  assert.ok(m4.story.intro.some((l) => l.who === 'peer' && /빼자/.test(l.text)), 'the peer still says "let us drop odd ones"');
  assert.match(sd.peerFixed.text, /같이 책임질게/);
  assert.match(sd.peerBox.text, /챙겨 왔어/);
  assert.ok(!/바보|한심|틀렸잖|네 탓|잘못했/.test(JSON.stringify(m4.story)));
});
