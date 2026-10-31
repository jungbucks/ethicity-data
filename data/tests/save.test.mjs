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
