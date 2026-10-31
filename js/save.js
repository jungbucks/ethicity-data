/*
 * 저장·이어하기(P4) — 키 이름은 시리즈 규칙(ethicity.publicness.save / .sound)에 맞춘다.
 *   ethicity.data.save   체크포인트(화면 경계에서만: 브리핑·검수·결과·보충 준비 진입). 달리기 도중은 저장하지 않는다.
 *   ethicity.data.sound  효과음 켬/끔('1'/'0'). 없으면 켜짐. 옛 키 dr.muted는 읽기만 해서 이어받는다.
 *   ethicity.data.hero   달릴 주인공(공통 팩 'onyu' 온유 / 'daon' 다온). 없거나 모르는 값이면 온유.
 * 저장소가 막혀 있으면(사생활 보호 창 등) 조용히 실패하고 게임은 그대로 진행한다.
 */
(function (root) {
  'use strict';

  var KEY = 'ethicity.data.save';
  var SOUND_KEY = 'ethicity.data.sound';
  var OLD_MUTE = 'dr.muted';
  var HERO_KEY = 'ethicity.data.hero', HEROES = ['onyu', 'daon'];
  var SCREENS = ['briefing', 'inspect', 'result', 'prep'];

  function storage(st) {
    if (st !== undefined) return st;
    try { return root.localStorage || null; } catch (e) { return null; }
  }

  function read(st) {
    try {
      var raw = st && st.getItem(KEY);
      var o = raw ? JSON.parse(raw) : null;
      return o && typeof o === 'object' && o.v === 1 ? o : null;
    } catch (e) { return null; }
  }
  function write(o, st) {
    if (!st) return false;
    try { st.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  }

  // 저장 내용: 미션 id, 화면, 가방 카드 목록("?" 설명표 포함), 보충 횟수, 튜토리얼 완료, 필요 장수 공개 플래그
  function checkpoint(screen, state, flags, st) {
    st = storage(st);
    var prev = read(st) || {};
    return write({
      v: 1, screen: screen, mission: state.mission,
      bag: (state.bag || []).map(function (c) { var o = {}; Object.keys(c).forEach(function (k) { if (c[k] !== undefined) o[k] = c[k]; }); return o; }),
      supplements: state.supplements || 0, firstTry: state.firstTry === undefined ? null : state.firstTry,
      seed: state.seed, needRevealed: !!state.needRevealed, newIds: state.newIds || [],
      tutorialDone: !!((flags && flags.tutorialDone) || prev.tutorialDone),
      savedAt: Date.now()
    }, st);
  }

  // 불러오기: 진행 중이면 { mission, screen, … }, 튜토리얼만 끝낸 상태면 { mission: null, tutorialDone }
  function load(st) {
    st = storage(st);
    var o = read(st);
    if (!o) return null;
    if (o.mission && (SCREENS.indexOf(o.screen) < 0 || !Array.isArray(o.bag))) return null;
    return {
      mission: o.mission || null, screen: o.screen || null, bag: o.bag || [],
      supplements: o.supplements || 0, firstTry: o.firstTry === undefined ? null : o.firstTry,
      seed: o.seed, needRevealed: !!o.needRevealed, newIds: o.newIds || [], tutorialDone: !!o.tutorialDone
    };
  }

  function markTutorialDone(st) {
    st = storage(st);
    var o = read(st) || { v: 1, mission: null };
    o.tutorialDone = true;
    return write(o, st);
  }

  // 임무를 끝내면 진행은 지우고 튜토리얼 완료만 남긴다
  function finish(st) {
    st = storage(st);
    var prev = read(st) || {};
    return write({ v: 1, mission: null, tutorialDone: !!prev.tutorialDone }, st);
  }

  function clear(st) {
    st = storage(st);
    var prev = read(st) || {};
    return write({ v: 1, mission: null, tutorialDone: !!prev.tutorialDone }, st);
  }

  function soundOn(st) {
    st = storage(st);
    try {
      var v = st && st.getItem(SOUND_KEY);
      if (v === '0' || v === '1') return v === '1';
      return !(st && st.getItem(OLD_MUTE) === '1');
    } catch (e) { return true; }
  }
  function setSound(on, st) {
    st = storage(st);
    try { if (st) st.setItem(SOUND_KEY, on ? '1' : '0'); } catch (e) { /* 무시 */ }
  }

  function hero(st) {
    st = storage(st);
    try { var v = st && st.getItem(HERO_KEY); return HEROES.indexOf(v) >= 0 ? v : HEROES[0]; } catch (e) { return HEROES[0]; }
  }
  function setHero(id, st) {
    st = storage(st);
    if (HEROES.indexOf(id) < 0) return;
    try { if (st) st.setItem(HERO_KEY, id); } catch (e) { /* 무시 */ }
  }

  var api = { KEY: KEY, SOUND_KEY: SOUND_KEY, HERO_KEY: HERO_KEY, hero: hero, setHero: setHero, checkpoint: checkpoint, load: load, markTutorialDone: markTutorialDone, finish: finish, clear: clear, soundOn: soundOn, setSound: setSound };
  root.DR = root.DR || {};
  root.DR.Save = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
