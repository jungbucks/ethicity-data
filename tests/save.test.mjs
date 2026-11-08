// 저장·이어하기(P4) — ethicity.data.save / ethicity.data.sound(시리즈 규칙)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Save = require('../js/save.js');
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

test('키 이름', () => {
  assert.equal(Save.KEY, 'ethicity.data.save');
  assert.equal(Save.SOUND_KEY, 'ethicity.data.sound');
});
test('체크포인트 저장·불러오기: 가방(“?” 설명표 포함)·보충 횟수·플래그', () => {
  const st = mem();
  const state = { mission: 'm1', bag: [{ id: 'c1', key: 'night_wet' }, { id: 'q1', ambiguousId: 'q_neon', assigned: null }, { id: 'q2', ambiguousId: 'q_muddy' }],
    supplements: 1, firstTry: false, seed: 1101, needRevealed: true, newIds: ['c1'] };
  assert.equal(Save.checkpoint('inspect', state, { tutorialDone: true }, st), true);
  const s = Save.load(st);
  assert.equal(s.screen, 'inspect');
  assert.equal(s.mission, 'm1');
  assert.deepEqual(s.bag, state.bag.map((c) => ({ ...c })).map((c) => (c.assigned === undefined ? (delete c.assigned, c) : c)));
  assert.equal(s.bag[1].assigned, null);
  assert.equal('assigned' in s.bag[2], false);
  assert.equal(s.supplements, 1);
  assert.equal(s.needRevealed, true);
  assert.equal(s.tutorialDone, true);
});
test('깨진 저장·막힌 저장소는 null, 쓰기 실패는 false', () => {
  assert.equal(Save.load({ getItem: () => '{oops' }), null);
  assert.equal(Save.load({ getItem: () => { throw new Error('x'); } }), null);
  assert.equal(Save.load(null), null);
  assert.equal(Save.checkpoint('inspect', { mission: 'm1', bag: [] }, {}, { setItem: () => { throw new Error('x'); } }), false);
  assert.equal(Save.load({ getItem: () => JSON.stringify({ v: 1, mission: 'm1', screen: 'nowhere', bag: [] }) }), null);
});
test('임무를 끝내면 진행은 지우고 튜토리얼 완료만 남김', () => {
  const st = mem();
  Save.checkpoint('result', { mission: 'm1', bag: [] }, { tutorialDone: true }, st);
  Save.finish(st);
  const s = Save.load(st);
  assert.equal(s.mission, null);
  assert.equal(s.tutorialDone, true);
});
test('소리: 없으면 켜짐, 옛 dr.muted 이어받기', () => {
  const st = mem();
  assert.equal(Save.soundOn(st), true);
  Save.setSound(false, st);
  assert.equal(st._m.get('ethicity.data.sound'), '0');
  assert.equal(Save.soundOn(st), false);
  const old = mem(); old.setItem('dr.muted', '1');
  assert.equal(Save.soundOn(old), false);
});
test('주인공: 없으면 온유, 온유·다온만 저장(ethicity.data.hero)', () => {
  const st = mem();
  assert.equal(Save.HERO_KEY, 'ethicity.data.hero');
  assert.equal(Save.hero(st), 'onyu');
  Save.setHero('daon', st);
  assert.equal(st._m.get('ethicity.data.hero'), 'daon');
  assert.equal(Save.hero(st), 'daon');
  Save.setHero('minjun', st); // 모르는 값은 무시
  assert.equal(Save.hero(st), 'daon');
  st.setItem('ethicity.data.hero', 'zzz');
  assert.equal(Save.hero(st), 'onyu');
});

// 임무 완료 기록(2 임무 Task 10) — 다음 임무 대사·3 임무 정체 공개·도시 복구 화면이 읽는 한 곳
test('임무 기록: 남기고 읽기, 체크포인트·임무 끝·튜토리얼 완료가 지우지 않음', () => {
  const st = mem();
  assert.deepEqual(Save.records(st), {});
  const rec = { cleared: true, firstTry: false, supplements: 1, firstFails: [{ scene: 'S4', title: '고가도로 아래 저지대 교차로', kind: 'danger' }] };
  assert.equal(Save.setRecord('m1', rec, st), true);
  assert.deepEqual(Save.records(st), { m1: rec });
  Save.checkpoint('briefing', { mission: 'm2', bag: [], supplements: 0, firstTry: null, seed: 1 }, {}, st);
  Save.markTutorialDone(st);
  Save.finish(st);
  assert.deepEqual(Save.records(st).m1, rec);
  assert.equal(Save.load(st).mission, null);
});
test('임무 기록: 처음부터(clear)는 기록도 지운다, 깨진 저장은 빈 기록', () => {
  const st = mem();
  Save.setRecord('m1', { cleared: true, firstTry: true, supplements: 0, firstFails: [] }, st);
  Save.clear(st);
  assert.deepEqual(Save.records(st), {});
  assert.deepEqual(Save.records({ getItem: () => '{oops' }), {});
});
test('배경음악: 없으면 켜짐, 효과음과 따로(ethicity.data.bgm), 저장 형식은 그대로', () => {
  const st = mem();
  assert.equal(Save.BGM_KEY, 'ethicity.data.bgm');
  assert.equal(Save.bgmOn(st), true);
  Save.setSound(false, st);
  assert.equal(Save.bgmOn(st), true, '효과음을 꺼도 배경음악은 켜진 채');
  Save.setBgm(false, st);
  assert.equal(st._m.get('ethicity.data.bgm'), '0');
  assert.equal(Save.bgmOn(st), false);
  assert.equal(Save.soundOn(st), false);
  Save.setBgm(true, st);
  assert.equal(Save.bgmOn(st), true);
  assert.equal(st._m.get('ethicity.data.save'), undefined, '체크포인트 키는 건드리지 않음');
  assert.equal(Save.bgmOn({ getItem: () => { throw new Error('blocked'); } }), true);
});
test('4 임무 결판 상태도 체크포인트에(동기 합류·고정 카드·결판 통과) — 새로고침 뒤 같은 자리', () => {
  const st = mem();
  const state = { mission: 'm4', bag: [{ id: 'peer_slant_1_0', key: 'slant_1', peer: true, fixed: true }], supplements: 1, firstTry: false, seed: 4401,
    needRevealed: true, newIds: [], peer: 'fixed', peerPending: true, showdownPassed: false };
  Save.checkpoint('prep', state, {}, st);
  const s = Save.load(st);
  assert.equal(s.peer, 'fixed'); assert.equal(s.peerPending, true); assert.equal(s.showdownPassed, false);
  assert.deepEqual(s.bag[0], { id: 'peer_slant_1_0', key: 'slant_1', peer: true, fixed: true });
  Save.checkpoint('result', { ...state, peer: 'joined', peerPending: false, showdownPassed: true }, {}, st);
  assert.deepEqual([Save.load(st).peer, Save.load(st).peerPending, Save.load(st).showdownPassed], ['joined', false, true]);
  // 예전 저장(필드 없음)은 기본값
  Save.checkpoint('inspect', { mission: 'm1', bag: [], supplements: 0 }, {}, st);
  assert.deepEqual([Save.load(st).peer, Save.load(st).peerPending, Save.load(st).showdownPassed], ['none', false, false]);
});

test('hasSave: nothing / bare tutorial checkpoint = no save; progress, tutorialDone or a record = save', () => {
  const st = mem();
  assert.equal(Save.hasSave(st), false);
  Save.checkpoint('briefing', { mission: 'tutorial', bag: [] }, {}, st);
  assert.equal(Save.hasSave(st), false, 'stopped in the first tutorial');
  Save.checkpoint('inspect', { mission: 'm1', bag: [] }, {}, st);
  assert.equal(Save.hasSave(st), true);
  const st2 = mem();
  Save.markTutorialDone(st2);
  assert.equal(Save.hasSave(st2), true);
  const st3 = mem();
  Save.setRecord('m1', { cleared: true }, st3);
  assert.equal(Save.hasSave(st3), true);
});

test('lost cards count survives a checkpoint, old saves read as 0', () => {
  const st = mem();
  Save.checkpoint('inspect', { mission: 'm1', bag: [], lost: 3 }, {}, st);
  assert.equal(Save.load(st).lost, 3);
  const raw = JSON.parse(st.getItem(Save.KEY)); delete raw.lost; st.setItem(Save.KEY, JSON.stringify(raw));
  assert.equal(Save.load(st).lost, 0);
  assert.equal(Save.KEY, 'ethicity.data.save');
});

test('개인정보 카드: 가방의 privateId·가림(masked)과 privCaught를 저장, 옛 저장은 빈 목록', () => {
  const st = mem();
  const state = { mission: 'm3', bag: [{ id: 'c4', key: 'river_now', privateId: 'p_river_people', masked: true }, { id: 'c9', key: 'station_now', privateId: 'p_station_plate' }], privCaught: ['c4', 'c9'] };
  Save.checkpoint('inspect', state, {}, st);
  const s = Save.load(st);
  assert.deepEqual(s.bag, state.bag);
  assert.deepEqual(s.privCaught, ['c4', 'c9']);
  const old = mem();
  old.setItem(Save.KEY, JSON.stringify({ v: 1, mission: 'm3', screen: 'inspect', bag: [] }));
  assert.deepEqual(Save.load(old).privCaught, []);
});
