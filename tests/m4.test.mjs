// 4 임무 「채점 AI」(설계 2026-11-01 §5): 이름표 = 선택지 번호 1~5, 1↔7·3↔8·2↔5 오독, 드문 글씨를 지켜야 결판(S4)을 읽는다
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const Rng = require('../js/rng.js');
const Cards = require('../js/cards.js');
const Judge = require('../js/judge.js');
const { judge } = Judge;
const Stream = require('../js/stream.js');
const cast = require('../missions/cast.js');
const m1 = require('../missions/m1.js'), m2 = require('../missions/m2.js'), m3 = require('../missions/m3.js'), tut = require('../missions/tutorial.js');
const m4 = require('../missions/m4.js');

const combos = (m) => m.scenes.flatMap((s) => s.combos);
const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const fk = (id, n, label) => Array.from({ length: n }, (_, i) => Object.assign({ id: id + '_' + i, fakeId: id }, label ? { label } : {}));
// 첫 판 통과 최소 가방(16장): 또박또박 5 · 흘려 쓴 1 ×2 · 흘려 쓴 3 ×2 · 각진 2 ×2 + 둥근 5 ×1 · 표 답 ×2 · 크게 기운 1 ×2
const MIN = { neat_1: 1, neat_2: 1, neat_3: 1, neat_4: 1, neat_5: 1, flag_1: 2, loop_3: 2, angular_2: 2, round_5: 1, table_4: 2, slant_1: 2 };
const kinds = (r) => r.scenes.map((s) => s.failKind);

test('m4 well-formed: labels are choice numbers 1~5, 7 and 8 only on fakes', () => {
  assert.equal(m4.id, 'm4');
  assert.equal(m4.title, '채점 AI');
  assert.deepEqual([m4.bag, m4.runSeconds, m4.supplementSeconds, m4.seed, m4.fires], [30, 90, 30, 4401, 8]);
  assert.deepEqual(m4.labels.map((l) => l.id), ['1', '2', '3', '4', '5']);
  assert.deepEqual(m4.labelOptions.map((l) => l.id), ['1', '2', '3', '4', '5']);
  assert.deepEqual(m4.labelExtra.map((l) => l.id), ['7', '8']);
  assert.equal(m4.labelStyle, 'digit');
  assert.equal(m4.showdownScene, 'S4');
  const ids = new Set(m4.labels.map((l) => l.id));
  assert.equal(Object.keys(m4.cardTypes).length, 11);
  for (const [k, t] of Object.entries(m4.cardTypes)) {
    assert.ok(ids.has(t.label), k); assert.deepEqual(t.icons, [t.label], k);
    assert.ok(t.name && t.art, k);
    assert.ok(!/헷갈|틀린|못 쓴|악필|엉망|삐뚤/.test(t.name), k + ' name gives nothing away');
  }
  for (const f of m4.fakes) {
    assert.ok(ids.has(f.label) || f.label === '7' || f.label === '8', f.id);
    assert.ok(Array.isArray(f.scenes) && f.scenes.length && !f.scenes.includes('S4'), f.id + ' never aims at S4');
    assert.match(f.line, /^우리가 넣은 데이터에 .+\.$/, f.id);
  }
  assert.ok(m4.fakes.filter((f) => f.label === '7' || f.label === '8').length === 2);
  for (const c of combos(m4)) { assert.ok(c.what, c.id); for (const k of c.keys) assert.ok(m4.cardTypes[k], c.id + ' ' + k); }
  assert.deepEqual(m4.scenes.map((s) => s.id), ['S1', 'S2', 'S3', 'S4']);
  assert.equal(m4.scenes[3].emphasis, 'low');
  for (const s of m4.scenes) assert.ok(s.passLine && s.cuts.danger && s.cuts.inconvenience, s.id);
  // 코스 합계 47장(보통 35 + 가짜 10 + "?" 2)
  const total = Object.values(m4.counts).reduce((a, b) => a + b, 0) + m4.fakes.reduce((n, f) => n + f.count, 0) + m4.ambiguous.length;
  assert.equal(total, 47);
  assert.deepEqual(m4.ambiguous.map((a) => [a.id, a.truthKey, a.correctLabel]), [['q_25', 'angular_2', '2'], ['q_35', 'loop_3', '3']]);
  for (const a of m4.ambiguous) { assert.deepEqual(a.icons, ['unknown']); assert.equal(a.clues.length, 2); }
  assert.equal(cast.grader.name, '채점 담당 선생님');
  assert.equal(cast.grader.color, '#7BE0A0');
});

test('label text: 1~5 and the off-choice 7·8', () => {
  assert.equal(Cards.labelText(m4, '1'), '1번');
  assert.match(Cards.labelText(m4, '7'), /^7번.*선택지에 없는 번호/);
  assert.match(Cards.cardLabel(m4, { fakeId: 'x_17' }), /선택지에 없는 번호/);
  assert.equal(Cards.cardLabel(m4, { key: 'flag_1' }), '1번');
  // "?" 카드 라벨: 시간대 없이
  assert.equal(Cards.cardLabel(m4, { ambiguousId: 'q_25' }), '?');
  assert.equal(Cards.cardLabel(m4, { ambiguousId: 'q_25', assigned: null }), '? (넣지 않기)');
  assert.equal(Cards.cardLabel(m4, { ambiguousId: 'q_25', assigned: '5' }), '5번');
  assert.deepEqual(Cards.iconsOf(m4, { ambiguousId: 'q_25' }), ['unknown']);
  assert.deepEqual(Cards.iconsOf(m4, { ambiguousId: 'q_25', assigned: '2' }), ['2']);
  // 화면 개수: "?"는 붙인 번호의 보통 종류(맞았는지 드러내지 않음), 7·8은 어느 종류로도 세지 않음
  assert.equal(Cards.displayKey(m4, { ambiguousId: 'q_25', assigned: '2' }), 'neat_2');
  assert.equal(Cards.displayKey(m4, { ambiguousId: 'q_25', assigned: '5' }), 'neat_5');
  assert.equal(Cards.displayKey(m4, { fakeId: 'x_17' }), '7', 'counted under its own label 7, like the bag label');
  assert.deepEqual(Cards.labelCounts(m4, [{ fakeId: 'x_17' }, { fakeId: 'x_17' }, { fakeId: 'x_38' }]), { 7: 2, 8: 1 });
  assert.equal(Cards.displayKey(m4, { fakeId: 'x_25' }), 'neat_5');
});

test('the minimum 16-card bag passes the first submit', () => {
  const bag = bagOf(MIN);
  assert.equal(bag.length, 16);
  assert.equal(judge(m4, bag, cfg).allPass, true);
  assert.equal(Judge.readable(m4, judge(m4, bag, cfg)), true);
});

test('every scene can fail on its own; S2 and S4 are danger, S1 and S3 inconvenience', () => {
  const only = (drop) => kinds(judge(m4, bagOf({ ...MIN, ...drop }), cfg));
  assert.deepEqual(only({ neat_1: 0, neat_2: 0, neat_3: 0, neat_4: 0, neat_5: 3 }), ['inconvenience', null, null, null]);
  assert.deepEqual(only({ flag_1: 1 }), [null, 'danger', null, null]);
  assert.deepEqual(only({ loop_3: 0 }), [null, 'danger', null, null]);
  assert.deepEqual(only({ angular_2: 1, round_5: 1 }), [null, 'danger', null, null]);
  assert.deepEqual(only({ slant_1: 1 }), [null, null, null, 'danger']);
  const s2 = judge(m4, bagOf({ ...MIN, flag_1: 0 }), cfg).scenes[1];
  assert.match(s2.failLine, /7로 읽었다/);
  assert.match(judge(m4, bagOf({ ...MIN, loop_3: 0 }), cfg).scenes[1].failLine, /8로 읽었다/);
  assert.match(judge(m4, bagOf({ ...MIN, angular_2: 0, round_5: 0 }), cfg).scenes[1].failLine, /5로 읽었다/);
});

test('dropping the big slanted 1 = S4 danger "read as 7, a number that does not exist"', () => {
  const r = judge(m4, bagOf({ ...MIN, slant_1: 0 }), cfg);
  const s4 = r.scenes[3];
  assert.equal(s4.failKind, 'danger');
  assert.match(s4.failLine, /7로 읽었다/);
  assert.match(s4.failLine, /있지도 않은 번호/);
  assert.equal(Judge.readable(m4, r), false);
});

test('dropping the table answers fails S3 and S4 as inconvenience', () => {
  const r = judge(m4, bagOf({ ...MIN, table_4: 0 }), cfg);
  assert.deepEqual(kinds(r), [null, null, 'inconvenience', 'inconvenience']);
  assert.equal(Judge.readable(m4, r), false);
});

test('principle: removing every big slanted 1 and table answer always fails S4 (random bags)', () => {
  const rng = Rng.create(4), keys = Object.keys(m4.cardTypes).filter((k) => k !== 'slant_1' && k !== 'table_4');
  for (let n = 0; n < 200; n++) {
    const bag = [];
    for (let i = 0; i < 30; i++) {
      const x = rng.next();
      if (x < 0.15) bag.push({ id: 'f' + i, fakeId: m4.fakes[Math.floor(rng.next() * m4.fakes.length)].id });
      else if (x < 0.2) bag.push({ id: 'q' + i, ambiguousId: m4.ambiguous[Math.floor(rng.next() * 2)].id, assigned: String(1 + Math.floor(rng.next() * 5)) });
      else bag.push({ id: 'k' + i, key: keys[Math.floor(rng.next() * keys.length)] });
    }
    const r = judge(m4, bag, cfg);
    assert.equal(r.scenes[3].pass, false, 'bag ' + n);
    assert.equal(Judge.readable(m4, r), false);
  }
});

test("'7' on a hooked 1: two of them = S2 danger; fixing to 1 counts as the hooked 1", () => {
  const r = judge(m4, bagOf(MIN).concat(fk('x_17', 2)), cfg);
  assert.deepEqual(kinds(r), [null, 'danger', null, null]);
  assert.deepEqual(r.scenes[1].contaminated, ['x_17']);
  assert.equal(judge(m4, bagOf(MIN).concat(fk('x_17', 1)), cfg).allPass, true, 'one is harmless on first submit');
  // 1로 고치면 흘려 쓴 1로 셈 — 흘려 쓴 1이 없어도 고친 2장으로 S2 통과
  const fixed = judge(m4, bagOf({ ...MIN, flag_1: 0 }).concat(fk('x_17', 2, '1')), cfg);
  assert.equal(fixed.allPass, true);
  assert.equal(Cards.harm(m4, { fakeId: 'x_17' }), 'danger');
});

test("'8' on a looped 3 and '5' on an angular 2 work the same way", () => {
  assert.deepEqual(kinds(judge(m4, bagOf(MIN).concat(fk('x_38', 2)), cfg)), [null, 'danger', null, null]);
  assert.equal(judge(m4, bagOf({ ...MIN, loop_3: 0 }).concat(fk('x_38', 2, '3')), cfg).allPass, true);
  assert.deepEqual(kinds(judge(m4, bagOf(MIN).concat(fk('x_25', 2)), cfg)), [null, 'danger', null, null]);
  assert.equal(judge(m4, bagOf({ ...MIN, angular_2: 0 }).concat(fk('x_25', 2, '2')), cfg).allPass, true);
  // 2에 '5'는 S2에만 쌓인다(또박또박 5를 쓰는 S1·S3은 오염시키지 않음)
  const t = judge(m4, bagOf(MIN).concat(fk('x_25', 2)), cfg);
  assert.equal(t.scenes[0].pass && t.scenes[2].pass, true);
});

test('the scribble cannot be fixed; two of them = S1 inconvenience', () => {
  const f = m4.fakes.find((x) => x.id === 'x_scribble');
  assert.equal(f.truth, null);
  for (const l of ['1', '2', '3', '4', '5']) assert.equal(Cards.isMislabeled(m4, { fakeId: 'x_scribble', label: l }), true, l);
  assert.deepEqual(kinds(judge(m4, bagOf(MIN).concat(fk('x_scribble', 2)), cfg)), ['inconvenience', null, null, null]);
});

test('"?" cards: right label counts twice, wrong label counts nothing', () => {
  const r = judge(m4, bagOf({ ...MIN, angular_2: 0, round_5: 2 }).concat([{ id: 'q', ambiguousId: 'q_25', assigned: '2' }]), cfg);
  assert.equal(r.allPass, true, '2 + round 5 ×2 = 4 ≥ 3? (q counts 2)');
  const r2 = judge(m4, bagOf({ ...MIN, loop_3: 0 }).concat([{ id: 'q', ambiguousId: 'q_35', assigned: '3' }]), cfg);
  assert.equal(r2.allPass, true);
  const r3 = judge(m4, bagOf({ ...MIN, loop_3: 0 }).concat([{ id: 'q', ambiguousId: 'q_35', assigned: '5' }]), cfg);
  assert.equal(r3.scenes[1].pass, false);
  assert.deepEqual(r3.mislabeled, ['q']);
});

test('7 and 8 labels never fill any combo', () => {
  for (const id of ['x_17', 'x_38']) {
    const r = judge(m4, fk(id, 1), cfg);
    for (const s of r.scenes) for (const c of m4.scenes.find((x) => x.id === s.id).combos) assert.equal((s.missingHave[c.id] || 0), 0, id + ' ' + c.id);
  }
  assert.deepEqual(Cards.scenesForLabel(m4, '7'), []);
  assert.deepEqual(Cards.scenesForLabel(m4, '8'), []);
});

test('fakeScenes: data scenes while the original label stays, label scenes once changed', () => {
  assert.deepEqual(Cards.fakeScenes(m4, { fakeId: 'x_scribble' }), ['S1']);
  assert.deepEqual(Cards.fakeScenes(m4, { fakeId: 'x_17' }), ['S2']);
  assert.deepEqual(Cards.fakeScenes(m4, { fakeId: 'x_25', label: '4' }), Cards.scenesForLabel(m4, '4'));
  // 1~3 임무엔 fake.scenes가 없다 → 지금 규칙 그대로
  assert.deepEqual(Cards.fakeScenes(m2, { fakeId: 'f_battery' }), Cards.scenesForLabel(m2, 'can'));
});

test('readable ignores contamination (only the S4 combos count)', () => {
  // 플레이어가 또박또박 3을 '1'로 잘못 고쳐 2장 → S4까지 오염될 수 있지만 결판은 조합만 본다
  const bag = bagOf(MIN).concat([{ id: 'w1', key: 'neat_3', label: '1' }, { id: 'w2', key: 'neat_3', label: '1' }]);
  const r = judge(m4, bag, cfg);
  assert.equal(r.scenes[3].pass, false);
  assert.ok(r.scenes[3].contaminated.length);
  assert.equal(Judge.readable(m4, r), true);
});

test('result copy: no real exam/school names, no %, no shaming handwriting words', () => {
  const txt = JSON.stringify(m4);
  assert.ok(!/%|지하차도|못 쓴|악필|엉망|삐뚤|수능|모의고사|학력평가|대학/.test(txt));
  for (const m of [m3, m4]) {
    const all = JSON.stringify(m);
    for (const hit of all.match(/[^"]*때문에 떨어졌[^"]*/g) || []) assert.match(hit, /생각|믿/, hit);
  }
});

// 코스: 구역 4개, 7·8 가짜는 S2 구역 뒤쪽 절반, 희귀 카드 앞 벽
test('m4 run: four zones, counts, fakes late in their own zone, rare walls', () => {
  for (const seed of [4401, 1, 42]) {
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
      if (it.ambiguousId || m4.cardTypes[it.key]?.rare) assert.ok(c.items.some((w) => w.kind === 'wall' && w.lane === it.lane && Math.abs(w.z - (it.z - cfg.rareWallGap)) < 1e-8), it.uid);
    }
    assert.deepEqual(c, Stream.build(m4, cfg, { seed }));
  }
});

// 손이 닿는지: 한 줄(같은 z)엔 카드를 하나만 잡을 수 있다 → 첫 판 최소 16장을 서로 다른 줄에서 채울 수 있어야 한다
function reachable(m, course) {
  const rows = new Map();
  for (const it of course.items) if (it.kind === 'card' && it.key) {
    const k = it.z.toFixed(6);
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push(it.key);
  }
  const rowList = [...rows.values()];
  // 필요 칸: 조합마다 need장(같은 key를 쓰는 조합은 큰 쪽 하나로 — 한 카드가 여러 장면에 함께 센다)
  const slots = [];
  const seen = new Set();
  for (const c of combos(m)) {
    const sig = c.keys.join(',');
    if (seen.has(sig)) continue;
    const need = Math.max(...combos(m).filter((o) => o.keys.join(',') === sig).map((o) => o.need));
    seen.add(sig);
    for (let i = 0; i < need; i++) slots.push(new Set(c.keys));
  }
  const match = new Array(rowList.length).fill(-1);
  function tryAssign(s, visited) {
    for (let r = 0; r < rowList.length; r++) {
      if (visited[r] || !rowList[r].some((k) => slots[s].has(k))) continue;
      visited[r] = true;
      if (match[r] < 0 || tryAssign(match[r], visited)) { match[r] = s; return true; }
    }
    return false;
  }
  return slots.every((_, s) => tryAssign(s, []));
}
test('reach: every needed card can be caught from distinct rows (16 seeds + the shipped seed)', () => {
  for (const seed of [4401, ...Array.from({ length: 16 }, (_, i) => i + 1)]) assert.ok(reachable(m4, Stream.build(m4, cfg, { seed })), 'seed ' + seed);
});

test('tutorial and missions 1~3 courses unchanged by m4', () => {
  const before = JSON.parse(fs.readFileSync(new URL('./fixtures/courses-before-m4.json', import.meta.url)));
  for (const seed of [1101, 1102, 42]) assert.deepEqual(Stream.build(m1, cfg, { seed }), before['m1_' + seed]);
  for (const seed of [2201, 2202, 42]) assert.deepEqual(Stream.build(m2, cfg, { seed }), before['m2_' + seed]);
  for (const seed of [3301, 3302, 42]) assert.deepEqual(Stream.build(m3, cfg, { seed }), before['m3_' + seed]);
  assert.deepEqual(Stream.build(m1, cfg, { seed: 1102, focusCounts: { night_deep: 2 } }), before.m1_sup);
  assert.deepEqual(Stream.build(m2, cfg, { seed: 2202, focusCounts: { battery_aa: 2 } }), before.m2_sup);
  assert.deepEqual(Stream.build(m3, cfg, { seed: 3302, focusCounts: { market_now: 2 } }), before.m3_sup);
  assert.deepEqual(Stream.build(tut, cfg, { seed: 7 }), before.tut_7);
});

test('m3 → m4: record line from mission 3, exam name only "새빛 진학 평가"', () => {
  assert.equal(m3.next, 'm4');
  assert.ok(m4.story.recordLine.firstTry && m4.story.recordLine.supplemented);
  assert.match(m4.story.recordLine.firstTry, /^3 임무/);
  for (const m of [m3, m4]) assert.ok(!/입학 평가/.test(JSON.stringify(m)));
});

// 채점 시연(2 임무 컨베이어와 같은 원인 규칙): 답안지마다 원인, 통과 장면은 모두 맞게, 위험 장면 ⇔ 멈춤
const Conveyor = require('../js/conveyor.js');
const sortGr = (bag, named) => Conveyor.sort(m4, judge(m4, bag, cfg, { named }), m4.grading);
test('grading: well-formed sheets, every cause has a sheet, one real wrong answer', () => {
  const comboIds = new Set(combos(m4).map((c) => c.id)), fakeIds = new Set(m4.fakes.map((f) => f.id));
  assert.ok(m4.grading.length >= 11 && m4.grading.length <= 14, 'about 12 sheets');
  for (const g of m4.grading) {
    assert.ok(m4.cardTypes[g.art], g.id + ' art');
    assert.ok(['1', '2', '3', '4', '5'].includes(g.chose), g.id);
    assert.ok(['o', 'x'].includes(g.bin) && ['x', 'hold'].includes(g.wrongBin), g.id);
    for (const c of g.causes) assert.ok(comboIds.has(c) || /^(contaminated|danger):S[1-4]$/.test(c) || (/^any:/.test(c) && fakeIds.has(c.slice(4))), g.id + ' ' + c);
    if (g.hazard) { assert.equal(g.wrongBin, 'x', g.id); assert.ok(g.read && g.read !== g.chose, g.id + ' misread'); }
    if (g.bin === 'o') assert.equal(g.chose, g.answer, g.id);
  }
  const causes = new Set(m4.grading.flatMap((g) => g.causes));
  for (const c of comboIds) assert.ok(causes.has(c), c);
  for (const f of fakeIds) assert.ok(causes.has(f) || causes.has('any:' + f) || f === 'x_scribble', f);
  for (const s of ['S1', 'S2', 'S3', 'S4']) assert.ok(causes.has('contaminated:' + s) || causes.has('danger:' + s), s);
  const real = m4.grading.filter((g) => g.bin === 'x');
  assert.equal(real.length, 1);
  assert.deepEqual(real[0].causes, []);
  assert.notEqual(real[0].chose, real[0].answer);
  // 선배 답안은 시연에 넣지 않는다(결판에서 따로)
  assert.ok(!m4.grading.some((g) => g.senior));
  assert.ok(sortGr(bagOf(MIN)).every((o) => o.correct && !o.emergency));
});
test('grading: passing scenes all right, danger scene <=> stop, real wrong answer always right (random bags, relabels too)', () => {
  const rng = Rng.create(44), keys = Object.keys(m4.cardTypes), L = ['1', '2', '3', '4', '5'];
  for (let n = 0; n < 400; n++) {
    const bag = [];
    for (let i = 0; i < 30; i++) {
      const x = rng.next();
      if (x < 0.2) {
        const c = { id: 'f' + i, fakeId: m4.fakes[Math.floor(rng.next() * m4.fakes.length)].id };
        if (rng.next() < 0.3) c.label = L[Math.floor(rng.next() * 5)];
        bag.push(c);
      } else if (x < 0.25) bag.push({ id: 'q' + i, ambiguousId: m4.ambiguous[Math.floor(rng.next() * 2)].id, assigned: L[Math.floor(rng.next() * 5)] });
      else {
        const c = { id: 'k' + i, key: keys[Math.floor(rng.next() * keys.length)] };
        if (rng.next() < 0.08) c.label = L[Math.floor(rng.next() * 5)];
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
test("grading: '7' on hooked 1s → the hooked 1 sheet gets ✕ read as 7, with a stop", () => {
  const out = sortGr(bagOf(MIN).concat(fk('x_17', 2)));
  const flag = out.find((o) => o.art === 'flag_1');
  assert.equal(flag.correct, false); assert.equal(flag.bin, 'x'); assert.ok(flag.emergency);
  assert.equal(m4.grading.find((g) => g.id === flag.id).read, '7');
  // 표 답을 빼면 사람 채점(멈춤 없음)
  const t = sortGr(bagOf({ ...MIN, table_4: 0 }));
  assert.ok(t.filter((o) => !o.correct).every((o) => o.bin === 'hold' && !o.emergency));
});

// 결판 · 동기 합류 · 보충 보장(설계 §5.6): 보충을 다 써도 못 읽는 경우는 없다
const Showdown = require('../js/showdown.js');
test('peer mode by supplements left: 2 = removable, 1 = fixed, 0 = resubmit', () => {
  const max = cfg.maxSupplements;
  assert.equal(max, 2);
  assert.equal(Showdown.peerMode({ supplements: 0 }, cfg), 'removable');
  assert.equal(Showdown.peerMode({ supplements: 1 }, cfg), 'fixed');
  assert.equal(Showdown.peerMode({ supplements: 2 }, cfg), 'resubmit');
});
test('peer cards: 4 new cards (2 big slanted 1, 2 table answers); already in the bag → only made fixed', () => {
  const add = Showdown.peerCards(m4, [], false);
  assert.deepEqual(add.map((c) => c.key).sort(), ['slant_1', 'slant_1', 'table_4', 'table_4']);
  assert.ok(add.every((c) => c.peer && !c.fixed && /^peer_/.test(c.id)));
  const bag = add.slice(0, 3).map((c) => ({ ...c, label: '2' })); // 하나는 빠졌고, 남은 건 이름표를 바꿨다
  const again = Showdown.peerCards(m4, bag, true);
  assert.equal(again.length, 1, 'only the missing one is new');
  assert.ok(again[0].fixed);
  assert.ok(bag.every((c) => c.fixed && c.label === undefined), 'existing ones fixed and back to their own label');
  // 동기 카드만으로 결판 장면의 조합이 찬다
  assert.equal(Judge.readable(m4, judge(m4, Showdown.peerCards(m4, [], true), cfg)), true);
});
test('showdown guarantee: random bags + random removals (never fixed ones) always end readable', () => {
  const rng = Rng.create(46), keys = Object.keys(m4.cardTypes), L = ['1', '2', '3', '4', '5'];
  const pick = (a) => a[Math.floor(rng.next() * a.length)];
  const randomCard = (id) => (rng.next() < 0.15 ? { id, fakeId: pick(m4.fakes).id } : { id, key: pick(keys) });
  for (let n = 0; n < 500; n++) {
    let bag = Array.from({ length: Math.floor(rng.next() * 30) }, (_, i) => randomCard('a' + i));
    const st = { supplements: 0, peer: 'none' };
    let rounds = 0, readable = false, extraResubmit = 0;
    for (;;) {
      readable = Judge.readable(m4, judge(m4, bag, cfg));
      if (readable) break;
      const mode = Showdown.peerMode(st, cfg);
      st.peer = mode === 'removable' ? 'joined' : 'fixed';
      const add = Showdown.peerCards(m4, bag, mode !== 'removable');
      if (mode === 'resubmit') { bag = bag.concat(add); extraResubmit++; assert.ok(extraResubmit <= 1, 'one resubmit outside the count'); continue; }
      // 보충 준비: 고정이 아닌 카드를 무작위로 빼고(드문 글씨 포함), 이름표도 가끔 바꾼다
      bag = bag.filter((c) => c.fixed || rng.next() < 0.6);
      bag.forEach((c) => { if (!c.fixed && !c.fakeId && rng.next() < 0.1) c.label = pick(L); });
      st.supplements++;
      // 보충 달리기에서 무작위 카드 + 동기 카드
      const fresh = Array.from({ length: Math.floor(rng.next() * 8) }, (_, i) => randomCard('s' + st.supplements + '_' + i));
      bag = bag.concat(fresh).concat(add);
      // 보충 뒤 검수에서도 고정 아닌 카드는 뺄 수 있다
      bag = bag.filter((c) => c.fixed || rng.next() < 0.85);
      rounds++;
      assert.ok(rounds <= cfg.maxSupplements + 1, 'bag ' + n + ' did not converge');
    }
    assert.ok(readable, 'bag ' + n);
  }
});
test('m4 story: speakers in cast, grader portrait/thumbnail/backdrops exist, no shaming', () => {
  const lines = [];
  const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.who && v.text) lines.push(v); else Object.values(v).forEach(walk); } };
  walk(m4.story);
  assert.ok(lines.length > 25);
  for (const l of lines) { assert.ok(cast[l.who], l.who); assert.ok([undefined, 'basic', 'happy', 'worried', 'explain'].includes(l.face), l.who + ' ' + l.face); }
  const sd = m4.story.showdown;
  assert.equal(sd.bg, 'assets/story/showdown-senior.webp');
  assert.equal(m4.story.after.bg, 'assets/story/senior-after.webp');
  for (const f of [sd.bg, m4.story.after.bg, 'assets/characters/grader-portraits.png', 'assets/title/mission-m4.webp']) assert.ok(fs.existsSync(new URL('../' + f, import.meta.url)), f);
  assert.ok(sd.fail.some((l) => l.text === '봐, 또 지웠잖아.'));
  assert.ok(sd.pass.some((l) => /읽네/.test(l.text)));
  assert.ok(sd.peerJoin.some((l) => l.who === 'peer' && /이상한 건 빼자/.test(l.text) && /모아 뒀어/.test(l.text)));
  assert.match(sd.peerFixed.text, /같이 책임질게/);
  assert.match(sd.peerBox.text, /챙겨 왔어/);
  assert.equal(m4.story.questions.length, 2);
  assert.ok(m4.story.after.lines.some((l) => l.who === 'senior' && l.text === '…알아.'));
  assert.ok(!/바보|한심|틀렸잖|네 탓|잘못했/.test(JSON.stringify(m4.story)), 'no scolding');
  // 선배는 "~라고 생각해"만, 감독관은 단정하지 않는다
  assert.ok(!/AI 때문에 떨어졌다\./.test(JSON.stringify(m4.story)));
});
test('showdown with no supplements left: fixed peer cards + one resubmit always read, within 30 slots (review I3)', () => {
  const cfg0 = { ...cfg, maxSupplements: 0 }, rng = Rng.create(47), keys = Object.keys(m4.cardTypes).filter((k) => k !== 'slant_1');
  assert.equal(Showdown.peerMode({ supplements: 0 }, cfg0), 'resubmit');
  for (let n = 0; n < 100; n++) {
    let bag = Array.from({ length: 30 }, (_, i) => ({ id: 'a' + i, key: keys[Math.floor(rng.next() * keys.length)] }));
    assert.equal(Judge.readable(m4, judge(m4, bag, cfg)), false);
    const add = Showdown.peerCards(m4, bag, true);
    assert.ok(add.every((c) => c.fixed));
    // 보충 준비(다시 제출만)에서 칸이 모자라면 플레이어가 고정 아닌 카드를 빼야 출발할 수 있다(supplementPrep lack)
    while (bag.length + add.length > m4.bag) bag.splice(Math.floor(rng.next() * bag.length), 1);
    bag = bag.concat(add);
    assert.ok(bag.length <= m4.bag);
    assert.equal(Judge.readable(m4, judge(m4, bag, cfg)), true, 'bag ' + n);
  }
});
