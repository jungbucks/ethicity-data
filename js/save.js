/*
 * 저장·이어하기(P4) — 키 이름은 시리즈 규칙(ethicity.publicness.save / .sound)에 맞춘다.
 *   ethicity.data.save   체크포인트(화면 경계에서만: 브리핑·검수·결과·보충 준비 진입). 달리기 도중은 저장하지 않는다.
 *   ethicity.data.sound  효과음 켬/끔('1'/'0'). 없으면 켜짐. 옛 키 dr.muted는 읽기만 해서 이어받는다.
 *   ethicity.data.bgm    달리기 배경음악 켬/끔('1'/'0', js/bgm.js). 없으면 켜짐. 효과음과 따로.
 *   (save.records = 임무 완료 기록, 체크포인트·임무 끝에도 남고 '처음부터'에서 지워진다)
 *   (save.ending = 임무를 끝낸 뒤의 활동(마지막 대화 → 챕터 끝 → 도시 복구 → 임무 완료 화면)을 하는 중 — 선택 필드, 다 마치면 없어진다.
 *    게임 결과 완료(records[임무].cleared, mission:null)와 따로라서 도중에 나가도 그 활동으로 돌아온다. 옛 저장엔 없음 = 뒤 활동 없음)
 *   ethicity.data.hero   달릴 주인공(공통 팩 'onyu' 온유 / 'daon' 다온). 없거나 모르는 값이면 온유.
 * 저장소가 막혀 있으면(사생활 보호 창 등) 조용히 실패하고 게임은 그대로 진행한다.
 *
 * '처음부터'(clear)가 저장소에 닿지 못했을 때(리뷰 2026-11-12) — 옛 기록이 새 진행에 섞이지 않게:
 *   - 그때부터 이 탭은 저장소 대신 **메모리의 저장본**(pend)을 읽고 고친다. 저장소에 남은 옛 기록은 다시 읽지 않는다.
 *   - 쓰기가 다시 되는 첫 순간, 메모리의 저장본이 저장소의 옛 기록을 **통째로 바꾼다**(합치지 않음). 그 뒤엔 예전처럼 저장소를 읽는다.
 *   - clear는 쓰기가 안 되면 옛 기록 지우기(removeItem)라도 해 본다. 지워졌으면 status 'unsaved'(옛 기록 없음, 새 진행은 탭에만),
 *     그것도 안 되면 'stale'(이 기기에 옛 기록이 남음 — 쓰기가 되기 전에 새로고침하면 옛 기록이 다시 보인다. 화면이 그렇게 알린다).
 *   - 초기화와 상관없는 쓰기 실패(체크포인트·기록)는 예전 그대로: 저장소에 있는 것이 기준이고 조용히 넘어간다.
 *
 * 다른 탭의 '처음부터'(보안 검토 2026-11-18 #1) — 두 탭이 한 저장소를 쓸 때, 초기화 전에 연 탭이 메모리에 든 옛 답안(챕터 끝 선택·메모 등)을
 * 다시 써서 지운 기록을 되살리지 않게:
 *   - clear는 저장에 새 초기화 표시 epoch(아무 글자)를 남긴다. 탭은 처음 읽은 저장의 epoch를 기억한다(옛 저장·저장 없음 = null).
 *   - 쓰기 직전 저장소의 epoch가 기억한 것과 다르면 = 그 사이 다른 탭이 새로 시작했다 → 그 쓰기는 버리고(false) onStale 알림.
 *     저장이 없거나 표시가 없는 저장이면 새 초기화가 아니니 그대로 쓴다(이 탭의 표시를 붙여서). 이 탭의 초기화가 밀려 있는 동안(pend)은 이 탭이 기준이라 검사하지 않는다.
 *   - 다른 탭이 저장을 바꾸면 오는 storage 이벤트에서도 같은 검사 → 바로 onStale(app.js가 메모리 기록을 비우고 새로고침).
 *   - 초기화 없이 두 탭이 번갈아 쓰는 것은 예전 그대로(epoch 같음 — 마지막에 쓴 것이 남는다).
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

  // 초기화가 저장소에 닿지 못한 저장소 → { raw: 메모리의 저장본(JSON 글자 — 저장소와 같은 꼴), gone: 옛 기록을 지우는 데는 성공했나 }
  var pend = new WeakMap();
  function pending(st) { return st && typeof st === 'object' ? pend.get(st) || null : null; }

  // 다른 탭의 초기화 알아채기(맨 위 설명) — 저장소 → 이 탭이 아는 epoch(null = 표시 없는 저장·저장 없음)
  var epochs = new WeakMap();
  // 저장소에 지금 있는 저장의 epoch: undefined = 저장 없음(읽을 수 없음·깨짐 포함) · null = 표시 없는 옛 저장
  function storedEpoch(st) {
    try {
      var raw = st.getItem(KEY);
      var o = raw ? JSON.parse(raw) : null;
      if (!(o && typeof o === 'object')) return undefined;
      return typeof o.epoch === 'string' ? o.epoch : null;
    } catch (e) { return undefined; }
  }
  // 처음 만난 저장소는 지금 저장의 epoch를 기억한다(탭을 연 뒤 첫 읽기 = 타이틀)
  function adopt(st) {
    if (!st || typeof st !== 'object' || epochs.has(st)) return;
    var e = storedEpoch(st);
    epochs.set(st, e === undefined ? null : e);
  }
  // 이 탭이 연 뒤 다른 탭이 새로 시작했나
  function isStale(st) {
    if (!st || typeof st !== 'object' || pending(st)) return false;
    if (!epochs.has(st)) { adopt(st); return false; }
    var e = storedEpoch(st);
    // 표시 없는 저장(옛 코드가 연 탭이 쓴 것 등)은 새 초기화가 아니다 — 다른 epoch 글자일 때만
    return typeof e === 'string' && e !== epochs.get(st);
  }
  var staleFns = [], staleSent = false;
  // 다른 탭의 초기화를 알아챘을 때 부를 함수(app.js). 한 번만 부른다(새로고침하면 다시 처음부터)
  function onStale(fn) { if (typeof fn === 'function') staleFns.push(fn); }
  function notifyStale() {
    if (staleSent) return;
    staleSent = true;
    staleFns.forEach(function (f) { try { f(); } catch (e) { /* 알림 하나가 실패해도 나머지는 */ } });
  }
  function newEpoch() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }

  function read(st) {
    adopt(st);
    try {
      var p = pending(st);
      var raw = p ? p.raw : st && st.getItem(KEY);
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
  // force = clear(이 탭이 새로 시작 — 다른 탭의 표시보다 우선)
  function write(o, st, force) {
    if (!st) return false;
    if (!force && isStale(st)) { notifyStale(); return false; } // 다른 탭이 새로 시작한 뒤의 늦은 쓰기 — 옛 진행·답안을 되살리지 않게 버린다
    o.cityV = 1; // 이 저장은 튜토리얼도 기록(records.tutorial)으로 센다
    var ep = st && typeof st === 'object' ? epochs.get(st) : null;
    if (ep) o.epoch = ep; else delete o.epoch;
    var raw = JSON.stringify(o);
    try { st.setItem(KEY, raw); pend.delete(st); return true; } catch (e) {
      var p = pending(st);
      if (p) p.raw = raw; // 초기화가 밀려 있는 동안엔 메모리의 저장본이 기준 — 계속 여기에 쌓는다
      return false;
    }
  }
  // 초기화가 저장소에 닿았나: 'ok'(닿음 — 평소) · 'unsaved'(옛 기록은 지웠지만 새 진행은 이 탭에만) · 'stale'(옛 기록이 이 기기에 남아 있음) · 'off'(저장소 없음)
  function status(st) {
    st = storage(st);
    if (!st) return 'off';
    var p = pending(st);
    return p ? (p.gone ? 'unsaved' : 'stale') : 'ok';
  }
  // 밀린 초기화·진행을 다시 써 본다(탭을 떠날 때 등). 밀린 것이 없거나 써졌으면 true
  function flush(st) {
    st = storage(st);
    var p = pending(st);
    if (!p) return true;
    try { st.setItem(KEY, p.raw); pend.delete(st); return true; } catch (e) { return false; }
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
      firstGrade: state.firstGrade && typeof state.firstGrade === 'object' ? state.firstGrade : undefined, // 4 임무 전후 비교(선택 필드 — 없으면 키도 없음)
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
      privCaught: Array.isArray(o.privCaught) ? o.privCaught : [],
      firstGrade: o.firstGrade && typeof o.firstGrade === 'object' ? o.firstGrade : null
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

  // 튜토리얼 합격 확정(리뷰 2026-11-18 #5): 완료 표시·기록과 **다음 재개 지점**을 한 번에 쓴다.
  //   튜토리얼 체크포인트가 남아 있으면 진행을 비운다(mission null → 타이틀 '첫 번째 임무부터 이어하기' = nextMission).
  //   전엔 완료만 쓰고 진행은 1 임무 브리핑 체크포인트까지 '튜토리얼 · 브리핑'으로 남아, 합격 대화·도시 복구·1 임무 도입 중에
  //   새로고침하면 끝낸 튜토리얼을 다시 시켰다. 다른 임무의 진행(연습으로 튜토리얼을 다시 한 경우)·기록·뒤 활동은 그대로.
  function passTutorial(st) {
    st = storage(st);
    var o = read(st) || { v: 1, mission: null };
    if (o.mission === 'tutorial') o = { v: 1, mission: null, records: o.records, ending: o.ending };
    o.tutorialDone = true;
    o.records = o.records && typeof o.records === 'object' ? o.records : {};
    o.records.tutorial = { cleared: true };
    return write(o, st);
  }

  // 임무를 끝내면 진행은 지우고 튜토리얼 완료만 남긴다
  function finish(st) {
    st = storage(st);
    var prev = read(st) || {};
    return write({ v: 1, mission: null, tutorialDone: !!prev.tutorialDone, records: prev.records || {} }, st);
  }

  // 처음부터: 진행과 임무 기록을 지우고 튜토리얼 완료만 남긴다
  //   쓰기가 안 되면: 옛 기록을 지워 보고(용량 초과면 자리가 나므로 한 번 더 쓴다), 끝내 안 써지면 메모리의 저장본으로 넘어간다(맨 위 설명).
  //   돌려주는 값은 예전처럼 '저장소에 써졌나' — 자세한 상태는 status()
  function clear(st) {
    st = storage(st);
    var prev = read(st) || {};
    var o = { v: 1, mission: null, tutorialDone: !!prev.tutorialDone };
    // 새 초기화 표시 — 이 epoch를 모르는 다른 탭의 늦은 쓰기는 버려진다(맨 위 설명)
    if (st && typeof st === 'object') { epochs.set(st, newEpoch()); staleSent = false; }
    if (write(o, st, true)) return true;
    if (!st) return false;
    var gone = false;
    try { st.removeItem(KEY); gone = st.getItem(KEY) == null; } catch (e) { gone = false; }
    if (gone && write(o, st, true)) return true;
    pend.set(st, { raw: JSON.stringify(o), gone: gone });
    return false;
  }

  /* ---------- 임무 뒤 활동 이어하기(리뷰 2026-11-10 ③) ----------
   * ending = { mission, step, city, peer, compare }
   *   step  0 = 챕터 끝 앞(1~3 임무 마지막 대화 / 4 임무 도시 재연결) · 1~3 = 챕터 끝 단계 · 4 = 챕터 끝 뒤(도시 복구·마무리 대화·임무 완료 화면)
   *   city  아직 보지 않은 도시 복구 화면 { from, to }(보고 나면 null — 이어 해도 두 번 뜨지 않는다)
   *   peer  4 임무 마무리 대화 갈래(동기가 합류한 적 없으면 'none') · compare = 4 임무 전후 비교 줄(DR.GradeCompare.rows 결과, 없으면 null)
   * 임무 기록(records)은 여기서 건드리지 않는다 — 이어 해도 완료 기록·도시 칸이 다시 세어지지 않는다.
   * 새 체크포인트·finish·clear는 저장을 새로 쓰므로 ending이 떨어진다(다른 진행을 시작하면 뒤 활동은 버림). */
  function validEnding(e) {
    if (!e || typeof e !== 'object' || typeof e.mission !== 'string') return null;
    if (typeof e.step !== 'number' || e.step < 0 || e.step > 4 || Math.floor(e.step) !== e.step) return null;
    var c = e.city, city = c && typeof c === 'object' && typeof c.from === 'number' && typeof c.to === 'number' ? { from: c.from, to: c.to } : null;
    return { mission: e.mission, step: e.step, city: city, peer: typeof e.peer === 'string' ? e.peer : 'none',
      compare: e.compare && typeof e.compare === 'object' ? e.compare : null };
  }
  function ending(st) {
    var o = read(storage(st));
    return o ? validEnding(o.ending) : null;
  }
  function setEnding(e, st) {
    st = storage(st);
    var v = validEnding(e);
    if (!v) return false;
    var o = read(st) || { v: 1, mission: null };
    o.ending = v;
    return write(o, st);
  }
  function endingDone(st) {
    st = storage(st);
    var o = read(st);
    if (!o) return !!st; // 저장이 없으면 지울 것도 없다(저장소가 없으면 false)
    delete o.ending;
    return write(o, st);
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
  // 화면에 쓰는 임무 이름(사용자 결정 2026-11-09: '1 임무' → '첫 번째 임무')
  var MISSION_ORD = { m1: '첫 번째', m2: '두 번째', m3: '세 번째', m4: '네 번째' };
  function missionName(id) { return (MISSION_ORD[id] || id) + ' 임무'; }
  // 도시 복구 그림의 구간(왼쪽부터 0~4) = 깬 임무(플레이테스트 2026-11-18 P0-2 — 전엔 깬 '수'만큼 왼쪽부터 켜서, 임무 고르기로
  //   3 임무만 깨도 보호소·분실물 구간이 켜졌다): 보호소 = 튜토리얼, 분실물 = m1, 분리배출 = m2, 역·횡단보도 = m3, 학교 = m4
  var CITY_SECTIONS = ['tutorial', 'm1', 'm2', 'm3', 'm4'];
  function citySection(id) { return CITY_SECTIONS.indexOf(id); }
  function citySections(recs) {
    recs = recs || {};
    var out = [];
    CITY_SECTIONS.forEach(function (id, i) { if (recs[id] && recs[id].cleared) out.push(i); });
    return out;
  }
  // 깬 직후 도시 복구 화면: 칸이 늘었을 때만(다시 깨면 건너뜀). 4 임무 = 도시 재연결, 이야기의 끝이라 늘 뜨지만 숫자는 깬 수 그대로(P0-2 — 전엔 늘 →5)
  function cityStep(id, before, after) {
    if (id === 'm4') return after > before ? { from: before, to: after } : { from: Math.max(0, after - 1), to: after };
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

  // 다른 탭이 저장을 바꿨다(storage 이벤트) → 새로 시작한 것이면 바로 알린다. key null = 저장소 전체 비움
  if (root && typeof root.addEventListener === 'function') {
    root.addEventListener('storage', function (e) {
      if (e && e.key != null && e.key !== KEY) return;
      var st = storage();
      if (isStale(st)) notifyStale();
    });
  }

  var api = { KEY: KEY, onStale: onStale, SOUND_KEY: SOUND_KEY, BGM_KEY: BGM_KEY, HERO_KEY: HERO_KEY, hero: hero, setHero: setHero, checkpoint: checkpoint, load: load, hasSave: hasSave, records: records, setRecord: setRecord, ending: ending, setEnding: setEnding, endingDone: endingDone, chapterOf: chapterOf, markTutorialDone: markTutorialDone, passTutorial: passTutorial, cityCount: cityCount, cityStep: cityStep, CITY_SECTIONS: CITY_SECTIONS, citySection: citySection, citySections: citySections, nextMission: nextMission, allCleared: allCleared, missionName: missionName, fitsMission: fitsMission, finish: finish, clear: clear, status: status, flush: flush, soundOn: soundOn, setSound: setSound, bgmOn: bgmOn, setBgm: setBgm };
  root.DR = root.DR || {};
  root.DR.Save = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
