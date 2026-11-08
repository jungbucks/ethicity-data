/*
 * 저장·이어하기(P4) — 키 이름은 시리즈 규칙(ethicity.publicness.save / .sound)에 맞춘다.
 *   ethicity.data.save   체크포인트(화면 경계에서만: 브리핑·검수·결과·보충 준비 진입). 달리기 도중은 저장하지 않는다.
 *   ethicity.data.sound  효과음 켬/끔('1'/'0'). 없으면 켜짐. 옛 키 dr.muted는 읽기만 해서 이어받는다.
 *   ethicity.data.bgm    달리기 배경음악 켬/끔('1'/'0', js/bgm.js). 없으면 켜짐. 효과음과 따로.
 *   (save.records = 임무 완료 기록, 체크포인트·임무 끝에도 남고 '처음부터'에서 지워진다)
 *   ethicity.data.hero   달릴 주인공(공통 팩 'onyu' 온유 / 'daon' 다온). 없거나 모르는 값이면 온유.
 * 저장소가 막혀 있으면(사생활 보호 창 등) 조용히 실패하고 게임은 그대로 진행한다.
 */
(function (root) {
  'use strict';

  var KEY = 'ethicity.data.save';
  var SOUND_KEY = 'ethicity.data.sound';
  var OLD_MUTE = 'dr.muted';
  var BGM_KEY = 'ethicity.data.bgm';
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
      if (!(o && typeof o === 'object' && o.v === 1)) return null;
      // 도시 복구 칸 이전(cityV 없음) 저장: 튜토리얼을 끝냈고 깬 임무가 있으면 튜토리얼 기록을 채워 둔다(한 번, 다음 저장 때 남음)
      if (!o.cityV) {
        if (o.tutorialDone && o.records && typeof o.records === 'object' && Object.keys(o.records).length && !o.records.tutorial) o.records.tutorial = { cleared: true };
        o.cityV = 1;
      }
      return o;
    } catch (e) { return null; }
  }
  function write(o, st) {
    if (!st) return false;
    o.cityV = 1; // 이 저장은 튜토리얼도 기록(records.tutorial)으로 센다
    try { st.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  }

  // 저장 내용: 미션 id, 화면, 가방 카드 목록("?" 설명표·동기 카드 고정 포함), 보충 횟수, 튜토리얼 완료, 필요 장수 공개 플래그,
  //   lost = 직전 달리기에서 노이즈로 잃은 카드 수(검수 화면 한 줄, 없는 옛 저장은 0)
  //   4 임무 결판: peer('none'|'joined'|'fixed')·peerPending(보충 뒤 동기 카드가 들어올 차례)·showdownPassed
  //   privCaught = 첫 달리기 뒤 가방의 '가리기' 개인정보 카드 id(나중에 빠졌으면 결과 한 줄, 옛 저장은 []). 가방 카드의 privateId·masked도 그대로 남는다
  function checkpoint(screen, state, flags, st) {
    st = storage(st);
    var prev = read(st) || {};
    return write({
      v: 1, screen: screen, mission: state.mission,
      bag: (state.bag || []).map(function (c) { var o = {}; Object.keys(c).forEach(function (k) { if (c[k] !== undefined) o[k] = c[k]; }); return o; }),
      supplements: state.supplements || 0, firstTry: state.firstTry === undefined ? null : state.firstTry,
      seed: state.seed, needRevealed: !!state.needRevealed, newIds: state.newIds || [], firstFails: state.firstFails || [], named: state.named || [], lost: state.lost || 0,
      peer: state.peer || 'none', peerPending: !!state.peerPending, showdownPassed: !!state.showdownPassed,
      privCaught: state.privCaught || [],
      tutorialDone: !!((flags && flags.tutorialDone) || prev.tutorialDone),
      records: prev.records || {},
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
      seed: o.seed, needRevealed: !!o.needRevealed, newIds: o.newIds || [], firstFails: o.firstFails || [], named: o.named || [], lost: o.lost || 0, tutorialDone: !!o.tutorialDone,
      peer: o.peer || 'none', peerPending: !!o.peerPending, showdownPassed: !!o.showdownPassed,
      privCaught: Array.isArray(o.privCaught) ? o.privCaught : []
    };
  }

  // 지켜야 할 세이브가 있나: 임무 진행·튜토리얼 완료·임무 기록 중 하나라도(튜토리얼 도중에 멈춘 체크포인트만 있으면 없는 것으로 친다)
  function hasSave(st) {
    var o = read(storage(st));
    if (!o) return false;
    return !!((o.mission && o.mission !== 'tutorial') || o.tutorialDone || (o.records && Object.keys(o.records).length));
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
    return write({ v: 1, mission: null, tutorialDone: !!prev.tutorialDone, records: prev.records || {} }, st);
  }

  // 처음부터: 진행과 임무 기록을 지우고 튜토리얼 완료만 남긴다
  function clear(st) {
    st = storage(st);
    var prev = read(st) || {};
    return write({ v: 1, mission: null, tutorialDone: !!prev.tutorialDone }, st);
  }

  // 임무 완료 기록 { 임무 id: { cleared, firstTry, supplements, firstFails } } — 다음 임무 대사·3 임무 정체 공개·도시 복구 화면이 읽는다
  function records(st) {
    var o = read(storage(st));
    return (o && o.records && typeof o.records === 'object') ? o.records : {};
  }
  function setRecord(id, rec, st) {
    st = storage(st);
    var o = read(st) || { v: 1, mission: null };
    o.records = o.records || {};
    o.records[id] = rec;
    return write(o, st);
  }

  // 챕터 끝 답(설계 2026-11-08 ②): records[임무].chapter = { req: { first, last }, concept: { first, last }, note }
  //   처음 고른 것과 마지막으로 고른 것을 둘 다 남긴다. 옛 기록(chapter 없음)·깨진 값은 빈 값으로
  function chapterOf(recs, id) {
    var c = recs && recs[id] && recs[id].chapter, out = { req: { first: null, last: null }, concept: { first: null, last: null }, note: '' };
    if (!c || typeof c !== 'object') return out;
    var str = function (v) { return typeof v === 'string' ? v : null; };
    ['req', 'concept'].forEach(function (k) { if (c[k] && typeof c[k] === 'object') out[k] = { first: str(c[k].first), last: str(c[k].last) }; });
    out.note = typeof c.note === 'string' ? c.note : '';
    return out;
  }

  // 도시 복구 칸 수(설계 §7): 튜토리얼 + 1~4 임무 중 깬 것, 0~5. 순서는 상관없다(임무 고르기로 건너뛰어도).
  //   튜토리얼은 기록(records.tutorial)으로 센다 — '처음부터'(clear)는 기록을 지우므로 0칸부터(튜토리얼 건너뛰기 선택지는 tutorialDone으로 남음).
  //   예전 저장은 read()가 한 번 옮겨 둔다(cityV) — 그래서 여기엔 tutorialDone 규칙이 없다('처음부터' 뒤 1 임무만 깨도 2칸이 되던 것, 리뷰 I1).
  var CITY_STAGES = ['m1', 'm2', 'm3', 'm4'];
  function cityCount(recs) {
    recs = recs || {};
    var n = CITY_STAGES.filter(function (id) { return recs[id] && recs[id].cleared; }).length;
    var tut = !!(recs.tutorial && recs.tutorial.cleared);
    return Math.max(0, Math.min(5, n + (tut ? 1 : 0)));
  }
  // 타이틀 '다음 임무로 이어하기'(플레이테스트 4): 기록만 보고 안 깬 첫 임무(1~4 순서). 다 깼으면 null — 새 저장 필드 없음
  function nextMission(recs) {
    recs = recs || {};
    for (var i = 0; i < CITY_STAGES.length; i++) if (!(recs[CITY_STAGES[i]] && recs[CITY_STAGES[i]].cleared)) return CITY_STAGES[i];
    return null;
  }
  function allCleared(recs) { return nextMission(recs) === null; }
  // 깬 직후 도시 복구 화면: 칸이 늘었을 때만(다시 깨면 건너뜀). 4 임무 = 도시 재연결, 이야기의 끝이라 늘 →5
  function cityStep(id, before, after) {
    if (id === 'm4') return { from: Math.min(before, 4), to: 5 };
    return after > before ? { from: before, to: after } : null;
  }

  // 저장된 가방이 지금 임무 데이터와 맞나(옛 저장 되돌림 — 1 임무 침수 → 분실물, 4 임무 숫자 → 낱말 개편 2026-11-08).
  // 종류·가짜·"?" 카드·개인정보 카드 id, 붙인 이름표가 모두 지금 임무에 있어야 true. 아니면 App.resume이 그 임무 브리핑으로 돌린다
  function fitsMission(mission, bag) {
    var ids = function (list) { return (list || []).map(function (x) { return x.id; }); };
    var labels = ids(mission.labels).concat(ids(mission.labelOptions)).concat(ids(mission.labelExtra));
    var fakes = ids(mission.fakes), amb = ids(mission.ambiguous), priv = ids(mission.privacy && mission.privacy.cards);
    return (bag || []).every(function (c) {
      if (c.ambiguousId) return amb.indexOf(c.ambiguousId) >= 0 && (c.assigned === undefined || c.assigned === null || labels.indexOf(c.assigned) >= 0);
      if (c.fakeId) { if (fakes.indexOf(c.fakeId) < 0) return false; }
      else if (!c.key || !mission.cardTypes[c.key]) return false;
      if (c.privateId && priv.indexOf(c.privateId) < 0) return false;
      return c.label === undefined || labels.indexOf(c.label) >= 0;
    });
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

  function bgmOn(st) {
    st = storage(st);
    try { return !(st && st.getItem(BGM_KEY) === '0'); } catch (e) { return true; }
  }
  function setBgm(on, st) {
    st = storage(st);
    try { if (st) st.setItem(BGM_KEY, on ? '1' : '0'); } catch (e) { /* 무시 */ }
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

  var api = { KEY: KEY, SOUND_KEY: SOUND_KEY, BGM_KEY: BGM_KEY, HERO_KEY: HERO_KEY, hero: hero, setHero: setHero, checkpoint: checkpoint, load: load, hasSave: hasSave, records: records, setRecord: setRecord, chapterOf: chapterOf, markTutorialDone: markTutorialDone, cityCount: cityCount, cityStep: cityStep, nextMission: nextMission, allCleared: allCleared, fitsMission: fitsMission, finish: finish, clear: clear, soundOn: soundOn, setSound: setSound, bgmOn: bgmOn, setBgm: setBgm };
  root.DR = root.DR || {};
  root.DR.Save = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
