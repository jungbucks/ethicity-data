// 장면 결과 문구 = 실제로 실패한 조합 기준(플레이테스트 2). 판정(DR.Judge)은 그대로, 문구만 고른다(DR.ResultLine)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
const m1 = require('../missions/m1.js');
const m2 = require('../missions/m2.js');
const m3 = require('../missions/m3.js');
const m4 = require('../missions/m4.js');
const { judge } = require('../js/judge.js');
const RL = require('../js/result-line.js');

const bagOf = (counts) => Object.entries(counts).flatMap(([key, n]) => Array.from({ length: n }, (_, i) => ({ id: key + i, key })));
const fakes = (id, n) => Array.from({ length: n }, (_, i) => ({ id: id + i, fakeId: id }));
const lineOf = (m, bag, sid) => {
  const r = judge(m, bag, cfg), i = m.scenes.findIndex((s) => s.id === sid);
  return { r: r.scenes[i], line: RL.sceneLine(m, m.scenes[i], r.scenes[i]) };
};
const M1_ALL = { umbrella_open: 3, umbrella_folded: 3, wallet_closed: 3, wallet_open: 3, phone_front: 3, phone_back: 3 };
const M2_ALL = { can_drink: 2, can_tin: 2, pet_clear: 2, pet_crushed: 2, vinyl_bag: 2, pack_milk: 2, paper_news: 2, trash_misc: 2, battery_aa: 2 };
const M3_ALL = { station_now: 2, station_rain: 2, market_now: 2, market_old: 1, market_eve_old: 2, river_now: 2, river_night: 2, crossing_now: 2, crossing_rain: 2 };

test('2 임무: 찌그러진 페트병만 부족 → 비닐 언급 없음', () => {
  const { r, line } = lineOf(m2, bagOf({ ...M2_ALL, pet_crushed: 1 }), 'S2');
  assert.equal(r.failKind, 'inconvenience');
  assert.match(line, /찌그러진 페트병/);
  assert.doesNotMatch(line, /비닐/);
});
test('2 임무: 우유팩만 부족 → 영수증 언급 없음', () => {
  const { line } = lineOf(m2, bagOf({ ...M2_ALL, pack_milk: 1 }), 'S3');
  assert.match(line, /우유팩/);
  assert.doesNotMatch(line, /영수증/);
});
test('2 임무: 두 조합 부족 → "A와 B가" (조사 자동)', () => {
  const { line } = lineOf(m2, bagOf({ ...M2_ALL, pet_crushed: 0, vinyl_bag: 1 }), 'S2');
  assert.match(line, /찌그러진 페트병과 비닐봉지가 엉뚱한 함으로 갔다/);
});
test('2 임무: 오염만(영수증이 종이로) → 영수증 문장, 우유팩 없음', () => {
  const { r, line } = lineOf(m2, bagOf(M2_ALL).concat(fakes('f_receipt', 2)), 'S3');
  assert.equal(r.pass, false); assert.deepEqual(r.missing, []);
  assert.match(line, /영수증/);
  assert.doesNotMatch(line, /우유팩/);
});
test('2 임무: 건전지를 투명 페트로 잘못 고침(위험) → 그 함 이름으로, "페트 사이" 고정 문장 아님', () => {
  const bag = bagOf(M2_ALL).concat([{ id: 'x1', key: 'battery_aa', label: 'pet' }, { id: 'x2', key: 'battery_aa', label: 'pet' }]);
  const { r, line } = lineOf(m2, bag, 'S2');
  assert.equal(r.failKind, 'danger');
  assert.match(line, /건전지가 투명 페트 함/);
  // 비닐로 고쳤으면 비닐 함
  const bag2 = bagOf(M2_ALL).concat([{ id: 'x1', key: 'battery_aa', label: 'vinyl' }, { id: 'x2', key: 'battery_aa', label: 'vinyl' }]);
  assert.match(lineOf(m2, bag2, 'S2').line, /건전지가 비닐 함/);
});
test('2 임무: 건전지 조합이 빠짐(위험) → 건전지 문장, 음료 캔만 빠짐 → 캔 문장', () => {
  assert.match(lineOf(m2, bagOf({ ...M2_ALL, battery_aa: 0 }), 'S4').line, /건전지/);
  const s1 = lineOf(m2, bagOf({ ...M2_ALL, can_drink: 1 }), 'S1').line;
  assert.match(s1, /음료 캔/); assert.doesNotMatch(s1, /통조림/);
});
test('1 임무: 접힌 우산만 부족 → 접힌 우산 / 둘 다 → "펼친 우산과 접힌 우산이"', () => {
  const one = lineOf(m1, bagOf({ ...M1_ALL, umbrella_folded: 1 }), 'S1').line;
  assert.match(one, /접(힌|어서 묶은) 우산/); assert.doesNotMatch(one, /펼친/);
  assert.match(lineOf(m1, bagOf({ ...M1_ALL, umbrella_folded: 0, umbrella_open: 0 }), 'S1').line, /펼친 우산과 접힌 우산을 알아보지 못해 분류 보류 칸으로 보냈다/);
});
test('3 임무: 학교 앞 — 비 오는 날만 부족 / 지금 횡단보도 부족(위험) / 옛 육교 사진 오염', () => {
  const rain = lineOf(m3, bagOf({ ...M3_ALL, crossing_rain: 1 }), 'S4');
  assert.equal(rain.r.failKind, 'inconvenience'); assert.match(rain.line, /비 오는 날/);
  const now = lineOf(m3, bagOf({ ...M3_ALL, crossing_now: 1 }), 'S4');
  assert.equal(now.r.failKind, 'danger'); assert.match(now.line, /지금의 학교 앞/); assert.doesNotMatch(now.line, /비 오는 날/);
  const old = lineOf(m3, bagOf(M3_ALL).concat(fakes('o_crossing', 2)), 'S4');
  assert.equal(old.r.failKind, 'danger'); assert.match(old.line, /육교/);
  // 옛 역 앞 빌딩 사진 오염 → 빌딩 기준 안내
  assert.match(lineOf(m3, bagOf(M3_ALL).concat(fakes('o_station', 2)), 'S1').line, /빌딩/);
  // 조합 자기 문장(fail.line)은 그대로
  assert.match(lineOf(m3, bagOf({ ...M3_ALL, market_now: 0, market_old: 1 }), 'S2').line, /2015년 뒤로 그대로/);
});
test('통과면 passLine', () => {
  assert.equal(lineOf(m2, bagOf(M2_ALL), 'S2').line, m2.scenes[1].passLine);
});
test('1~3 임무 데이터: 조합마다 cut(문장) 또는 fail.line, 임무마다 cutTemplate, 가짜 cut', () => {
  for (const m of [m1, m2, m3]) {
    assert.ok(m.cutTemplate && m.cutTemplate.inconvenience, m.id + ' cutTemplate');
    for (const s of m.scenes) for (const c of s.combos) {
      const own = c.cut || (c.fail && c.fail.line);
      assert.ok(typeof own === 'string' && /[.다]$/.test(own), m.id + ' ' + c.id);
      assert.ok(c.item || c.what, m.id + ' ' + c.id + ' item');
    }
    for (const f of m.fakes || []) assert.ok(typeof f.cut === 'string' && f.cut.length > 8, m.id + ' ' + f.id + ' cut');
  }
});

// 4 임무는 데이터를 바꾸지 않는다 → 문구도 예전과 같아야(조합 fail.line → 장면 cuts)
const rnd = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
test('4 임무: 무작위 가방 400개에서 예전 문구(failLine || cuts)와 같다', () => {
  const rand = rnd(4401), keys = Object.keys(m4.cardTypes), labels = m4.labels.map((l) => l.id).concat(['7', '8']);
  for (let n = 0; n < 400; n++) {
    const bag = [];
    keys.forEach((k) => { const c = Math.floor(rand() * 6); for (let i = 0; i < c; i++) bag.push(rand() < 0.08 ? { id: k + n + '_' + i, key: k, label: labels[Math.floor(rand() * labels.length)] } : { id: k + n + '_' + i, key: k }); });
    (m4.fakes || []).forEach((f) => { const c = Math.floor(rand() * 3); for (let i = 0; i < c; i++) bag.push({ id: f.id + n + '_' + i, fakeId: f.id }); });
    (m4.ambiguous || []).forEach((a) => { if (rand() < 0.5) bag.push({ id: a.id + n, ambiguousId: a.id, assigned: rand() < 0.5 ? a.correctLabel : '3' }); });
    const r = judge(m4, bag, cfg);
    r.scenes.forEach((s, i) => {
      const sc = m4.scenes[i], old = s.pass ? sc.passLine : (s.failLine || sc.cuts[s.failKind]);
      assert.equal(RL.sceneLine(m4, sc, s), old, 'bag ' + n + ' ' + s.id);
    });
  }
});
