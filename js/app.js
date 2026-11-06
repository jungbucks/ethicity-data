/*
 * 흐름 상태 기계 — 화면(section) 전환과 임무 진행.
 * 튜토리얼: 프롤로그(프로필·독백) → 대화 → 브리핑 → 실기 미션 안내 → 달리기 → 결과(실패면 다시) → 시험관 → 1 임무
 * 연습(타이틀 연습 카드, 세이브가 있을 때): 브리핑부터, 저장을 건드리지 않고 → 시험관 → 타이틀
 * 1 임무: 대화 → 브리핑 → 달리기 → 검수 → 감독관 → 결과 → (실패) 보충 → … → 선배 → 마무리
 */
(function (root) {
  'use strict';

  var SCREENS = ['title', 'profile', 'story', 'briefing', 'run', 'inspect', 'supervisor', 'conveyor', 'guide', 'grade', 'result', 'prep', 'knockout', 'city', 'outro'];
  var DR = root.DR;
  var STATIC = ['title', 'run']; // HTML에 고정 구조가 있는 화면(비우지 않음)

  // 화면을 바꿀 때 포커스를 풀어 둔다 — 연타한 Space/Enter가 다음 화면 버튼을 눌러 브리핑·결과를 건너뛰지 않게
  function go(name) {
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
    SCREENS.forEach(function (s) {
      var el = document.getElementById('screen-' + s);
      if (!el) return;
      var show = s === name;
      // 떠난 화면: 그때그때 그리는 화면은 비우고(지난 임무 DOM·같은 id 버튼이 남지 않게), 고정 화면(타이틀·달리기)은 aria-hidden
      if (!show && !el.hidden && STATIC.indexOf(s) < 0) el.innerHTML = '';
      el.hidden = !show;
      if (show) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
    });
    App.screen = name;
    // 시작 화면 장면: 떠나면 멈추고 3D 정리(DR.TitleScene), 돌아오면 renderTitle이 다시 시작
    if (name !== 'title' && DR.TitleScene) DR.TitleScene.stop();
    if (name === 'title' && DR.Shell) DR.Shell.renderTitle();
    // 달리기 배경음악: 달리기 화면에서만 틀고, 떠나면 서서히 멈춘다(DR.Bgm)
    if (DR.Bgm) DR.Bgm.scene(name);
    // 튜토리얼 개·고양이 사진: 타이틀·브리핑 때 미리 받아 둔다(한 번만, 기다리지 않음 — 못 받으면 Canvas 그림)
    if (DR.CardArt && DR.CardArt.preloadPhotos && (name === 'title' || name === 'briefing' || name === 'run')) DR.CardArt.preloadPhotos();
  }

  // 체크포인트: 화면 경계(브리핑·검수·결과·보충 준비 진입)에서만 저장 — 달리기 도중은 저장하지 않는다(P4)
  // 연습(state.practice)은 저장된 진행을 덮어쓰지 않는다
  function checkpoint(screen) { if (!App.state.practice) DR.Save.checkpoint(screen, App.state, {}); }

  function seedFor(m) { return DR.config.randomSeed ? (Date.now() >>> 0) : m.seed; }

  // 달리기에서 잡은 카드 → 판정용 가방 항목
  function toBag(grabbed) {
    return grabbed.map(function (g) {
      if (g.key) return { id: g.uid, key: g.key };
      if (g.fakeId) return { id: g.uid, fakeId: g.fakeId };
      return { id: g.uid, ambiguousId: g.ambiguousId, assigned: undefined };
    });
  }

  // 달리기 한 판: course를 달리고 끝나면 onDone(새로 잡은 가방 항목)
  // reserve = 달리기 뒤에 들어올 카드 자리(4 임무 동기 카드) — 그만큼 가방 칸을 비워 둔다
  function runCourse(m, course, bag, onDone, reserve) {
    go('run');
    App.course = course;
    DR.Run.start(document.getElementById('run-stage'), {
      mission: m, course: course, bag: bag, bagMax: m.bag - (reserve || 0),
      onEnd: function (r) {
        root.__runResult = r;
        // 화면 전환은 다음 틱에(달리기 루프 안에서 장면을 치우지 않게)
        setTimeout(function () {
          DR.Run.stop();
          // 불꽃에 HP를 다 잃으면 같은 코스를 처음부터(그 판에 잡은 카드는 비움, 시작 가방은 그대로)
          if (r.knockedOut) DR.UI.knockout(function () { runCourse(m, course, bag, onDone, reserve); });
          else { App.state.lost = r.lost.length; onDone(toBag(r.grabbed)); } // 잃은 카드는 가방에 없고, 검수 화면에 장 수만 남는다
        }, 0);
      }
    });
  }

  /* ---------- 도시 복구(설계 §7) ---------- */
  // 칸 수 = 튜토리얼 + 1~4 임무 중 깬 것(기록 기준, 0~5) — 타이틀 배지도 이것을 쓴다
  function cityCount() { return DR.Save.cityCount(App.records); }
  // step = DR.Save.cityStep(…) — null이면(칸이 늘지 않음) 건너뛴다
  function cityScreen(m, step, done) {
    if (!step) { done(); return; }
    DR.UI.city({ from: step.from, to: step.to, line: m.cityLine || '' }, done);
  }

  /* ---------- 튜토리얼 ---------- */
  function startTutorial() {
    var m = DR.Missions.tutorial;
    App.state = { mission: 'tutorial', bag: [], supplements: 0, firstTry: null, seed: seedFor(m) };
    DR.UI.opening(DR.Prologue.opening, tutorialBriefing);
  }
  // 연습: 세이브가 있을 때 타이틀 연습 카드 — 프롤로그 없이 브리핑부터, 끝나면 타이틀로
  function practiceTutorial() {
    var m = DR.Missions.tutorial;
    App.state = { mission: 'tutorial', bag: [], supplements: 0, firstTry: null, seed: seedFor(m), practice: true };
    tutorialBriefing();
  }
  function tutorialBriefing() {
    var m = DR.Missions.tutorial;
    checkpoint('briefing');
    DR.UI.briefing(m, function () { DR.UI.tutorialGoal(m, tutorialRun); });
  }

  function tutorialRun() {
    var m = DR.Missions.tutorial;
    var course = DR.Stream.build(m, DR.config, { seed: App.state.seed });
    runCourse(m, course, [], function (bag) {
      App.state.bag = bag;
      App.state.shownWrong = [];
      // 이름표가 틀린 카드를 하나도 안 가져왔으면 시험관의 연습 카드(가방·개수·판정 밖)로 같은 경험을 준다
      App.state.drill = bag.some(function (c) { return c.fakeId; }) ? null : { id: 'drill', fakeId: m.fakes[0].id };
      tutorialInspect();
    });
  }
  function tutorialInspect() {
    var m = DR.Missions.tutorial, st = App.state;
    DR.UI.examInspect(m, st.bag, { drill: st.drill, lost: st.lost }, tutorialDemo);
  }
  function tutorialDemo() {
    var m = DR.Missions.tutorial, st = App.state;
    App.lastJudge = DR.Judge.exam(m, st.bag);
    DR.UI.examDemo(m, App.lastJudge, st, { onFix: tutorialInspect, onRetry: tutorialRun, onNext: tutorialPass });
  }
  function tutorialPass() {
    var m = DR.Missions.tutorial;
    // 도시 복구: 튜토리얼 기록을 남기기 전·후 칸 수(마무리 대화 뒤, 1 임무 도입 전에 0 → 1)
    var before = cityCount();
    DR.Save.markTutorialDone();
    App.records.tutorial = { cleared: true };
    DR.Save.setRecord('tutorial', App.records.tutorial);
    var step = DR.Save.cityStep('tutorial', before, cityCount());
    var r = App.lastJudge, lines = m.story.outro.map(function (l) { return Object.assign({}, l, { text: l.text.replace('{dog}', r.have.dog).replace('{cat}', r.have.cat) }); });
    DR.UI.dialogue(lines, function () {
      cityScreen(m, step, function () {
        if (!App.state.practice) { startMission('m1'); return; }
        // 연습 끝: 예전 튜토리얼 체크포인트만 남아 있으면 비우고(이어하기가 끝낸 튜토리얼로 돌아가지 않게) 타이틀로
        var saved = DR.Save.load();
        if (saved && saved.mission === 'tutorial') DR.Save.finish();
        go('title');
      });
    });
  }

  /* ---------- 임무 ---------- */
  function startMission(id) {
    var m = DR.Missions[id];
    App.state = { mission: id, bag: [], supplements: 0, firstTry: null, firstFails: [], named: [], seed: seedFor(m), record: null, needRevealed: false, newIds: [],
      peer: 'none', peerPending: false, showdownPassed: false };
    DR.UI.dialogue(m.story.intro, function () { missionBriefing(m); });
  }
  // 이전 임무(next가 이 임무인 것)의 기록에 따른 브리핑 한 줄. 기록이 없으면(임무 고르기로 바로 들어옴) null
  function recordLineFor(m) {
    if (!m.story.recordLine) return null;
    var prev = Object.keys(DR.Missions).filter(function (k) { return DR.Missions[k].next === m.id; })[0];
    var rec = prev && App.records[prev];
    if (!rec) return null;
    return rec.firstTry ? m.story.recordLine.firstTry : m.story.recordLine.supplemented;
  }

  function missionBriefing(m) {
    checkpoint('briefing');
    DR.UI.briefing(m, function () {
      var course = DR.Stream.build(m, DR.config, { seed: App.state.seed });
      runCourse(m, course, [], function (bag) {
        App.state.bag = bag;
        App.afterRun(m);
      });
    }, recordLineFor(m));
  }

  // 이어하기: 저장된 체크포인트 화면으로 바로(P4)
  function resume(save) {
    var m = DR.Missions[save.mission];
    if (!m) { go('title'); return; }
    // 옛 1 임무(침수) 도중 저장: 도로 카드를 새 카드로 읽지 않게 새 1 임무 브리핑으로 돌려보낸다(다른 임무 기록은 그대로)
    if (save.mission === 'm1' && save.bag.some(function (c) { return !c.key || !m.cardTypes[c.key]; })) {
      save = Object.assign({}, save, { screen: 'briefing', bag: [], supplements: 0, firstTry: null, needRevealed: false, newIds: [], firstFails: [], named: [], seed: undefined });
    }
    App.state = { mission: save.mission, bag: save.bag, supplements: save.supplements, firstTry: save.firstTry,
      seed: save.seed === undefined ? seedFor(m) : save.seed, record: null, needRevealed: save.needRevealed, newIds: save.newIds, firstFails: save.firstFails || [], named: save.named || [], lost: save.lost || 0,
      peer: save.peer || 'none', peerPending: !!save.peerPending, showdownPassed: !!save.showdownPassed };
    if (save.screen === 'briefing') { if (save.mission === 'tutorial') tutorialBriefing(); else missionBriefing(m); }
    else if (save.screen === 'inspect') review(m);
    else if (save.screen === 'result') judgeAndShow(m);
    else prepSupplement(m, DR.Judge.judge(m, App.state.bag, DR.config, { named: App.state.named }));
  }

  // 달리기 뒤: 검수 → 감독관 → 결과
  function afterRun(m) { review(m); }

  function review(m) {
    checkpoint('inspect');
    DR.UI.inspect(m, App.state.bag, function () { askSupervisor(m); }, { newIds: App.state.newIds, lost: App.state.lost });
  }

  function askSupervisor(m) {
    DR.UI.supervisor(m.story.supervisorQuestion, function () { review(m); }, function () { judgeAndShow(m); });
  }

  // named = 앞선 결과에서 오염 원인으로 이름이 나온 것 — 아직 가방에 남아 있으면 그 장면은 통과하지 않는다(DR.Judge)
  function judgeAndShow(m) {
    var r = DR.Judge.judge(m, App.state.bag, DR.config, { named: App.state.named || [] });
    App.lastJudge = r;
    if (App.state.firstTry === null) {
      App.state.firstTry = r.allPass;
      // 첫 판에 놓친 장면(3 임무 정체 공개가 '누구나 하는 실수'의 예로 읽는다)
      App.state.firstFails = r.scenes.filter(function (s) { return !s.pass; }).map(function (s) {
        return { scene: s.id, title: m.scenes.filter(function (x) { return x.id === s.id; })[0].title, kind: s.failKind };
      });
    }
    App.state.needRevealed = true; // 첫 결과부터 필요 장수 공개(P3)
    checkpoint('result');
    // 이 결과에서 이름이 나온 오염 원인을 기억(저장은 다음 체크포인트에서 — 'result'에서 이어 하면 같은 판정이 다시 나오게)
    App.state.named = App.state.named || [];
    r.scenes.forEach(function (s) { (s.contaminated || []).forEach(function (src) { if (App.state.named.indexOf(src) < 0) App.state.named.push(src); }); });
    function showResult() {
      DR.UI.result(m, r, function () {
        // 4 임무: 장면 결과 바로 뒤 결판(선배의 옛 답안) — 한 번 읽으면 다시 하지 않는다
        if (m.showdownScene && !App.state.showdownPassed) showdown(m, r);
        else afterResult(m, r);
      });
    }
    // 2 임무: 장면별 결과 전에 컨베이어 실제 분류(spec §5.5). 1 임무 결과는 그대로
    if (m.conveyor) DR.UI.conveyor(m, r, showResult);
    else if (m.guide) DR.UI.guide(m, r, showResult); // 3 임무: 길 안내 시연
    else if (m.grading) DR.UI.grade(m, r, showResult); // 4 임무: 채점 시연
    else showResult();
  }

  function afterResult(m, r) {
    if (r.allPass || App.state.supplements >= DR.config.maxSupplements) finishMission(m);
    else prepSupplement(m, r);
  }

  // 4 임무 결판(설계 §5.6): 선배 답안 한 장을 우리 AI가 읽나(DR.Judge.readable — 결판 장면의 조합만).
  //   읽음 → 결판 끝(다른 장면이 남았고 보충이 남으면 감독관 한 줄 뒤 보통 보충, 아니면 재연결)
  //   못 읽음 → "또 지웠잖아" → 동기 합류(처음 한 번 peerJoin) → 동기 카드(DR.Showdown: 남은 보충 2 = 뺄 수 있음 / 1 = 고정 / 0 = 고정 + 다시 제출)
  function sheetLine(m, l, read, bg) {
    return Object.assign({ bg: bg, sheet: { mission: m.id, read: read } }, l);
  }
  function showdown(m, r) {
    var sd = m.story.showdown, ok = DR.Judge.readable(m, r);
    // 못 읽은 까닭: 크게 기운 1을 못 배움 → "7 · ✕"(위험) / 표 안 답만 못 배움 → "답 없음 · 사람 채점"(불편) — 장면 결과와 같은 말
    var s4 = r.scenes.filter(function (s) { return s.id === m.showdownScene; })[0];
    var sc = m.scenes.filter(function (s) { return s.id === m.showdownScene; })[0];
    var dangerMissing = sc.combos.some(function (c) { return s4.missing.indexOf(c.id) >= 0 && c.danger; });
    var read = ok ? true : (dangerMissing ? false : 'hold');
    var lines = sd.ask.map(function (l) { return sheetLine(m, l, null, sd.bg); })
      .concat([sheetLine(m, ok ? sd.readPass : read === 'hold' ? sd.readHold : sd.readFail, read, sd.bg)])
      .concat((ok ? sd.pass : sd.fail).map(function (l) { return sheetLine(m, l, read, sd.bg); }));
    var mode = null;
    if (ok) {
      if (!r.allPass && App.state.supplements < DR.config.maxSupplements) lines.push(Object.assign({ bg: sd.bg }, sd.passOthers));
    } else {
      mode = DR.Showdown.peerMode(App.state, DR.config);
      if (App.state.peer === 'none') sd.peerJoin.forEach(function (l) { lines.push(Object.assign({ bg: sd.bg }, l)); });
      if (mode !== 'removable') lines.push(Object.assign({ bg: sd.bg }, sd.peerFixed));
    }
    DR.UI.dialogue(lines, function () {
      if (ok) { App.state.showdownPassed = true; afterResult(m, r); return; }
      App.state.peer = mode === 'removable' ? 'joined' : 'fixed';
      // 보충 달리기가 끝나면 동기 카드가 가방에 들어온다. 남은 보충 0번(mode 'resubmit')이면 보충 준비가 달리기 없이 다시 제출로만 —
      // 가방 칸이 모자라면 거기서 비우게 한다(30칸을 넘지 않게, 리뷰 I3). 보충 횟수 밖
      App.state.peerPending = true;
      prepSupplement(m, r);
    });
  }

  // 보충: 빠진 조합에 모자란 장 수만큼(여유 포함) 그 카드가 나오는 짧은 코스. 이미 모은 가방은 그대로.
  // 부족분은 보충 준비에서 플레이어가 카드를 뺀 뒤의 가방으로 센다.
  // 4 임무 동기 카드(peerPending): 달리기 뒤 가방에 NEW로 붙는다 — 부족분 계산엔 미리 넣고, 달리기 가방 칸은 그만큼 비워 둔다
  function prepSupplement(m, r) {
    App.state.newIds = [];
    App.state.lost = 0; // 달리지 않고 다시 제출하는 길에서 지난 달리기 숫자가 다시 뜨지 않게
    checkpoint('prep');
    var extra = App.state.peerPending ? DR.Showdown.peerCards(m, App.state.bag, App.state.peer === 'fixed') : [];
    // 결판에서 못 읽었는데 보충이 남지 않음(설계 §5.6 '0번') → 달리기 없이 동기 카드를 고정으로 넣고 다시 제출 1회, 보충 횟수 밖
    var outside = App.state.peerPending && App.state.supplements >= DR.config.maxSupplements;
    DR.UI.supplementPrep(m, r, App.state.bag, function (bag, opts) {
      if (!outside) App.state.supplements++;
      App.state.peerPending = false;
      var extraIds = extra.map(function (c) { return c.id; });
      // 모자란 조합이 없으면(가짜만 뺀 경우) 달리지 않고 다시 제출 — 보충 1회로 센다. 동기 카드가 들어오면 검수에서 먼저 보여 준다
      if (opts && opts.resubmit) {
        App.state.bag = bag.concat(extra);
        if (extra.length) { App.state.newIds = extraIds; review(m); } else askSupervisor(m);
        return;
      }
      var short = DR.Judge.shortfall(m, bag.concat(extra), DR.config);
      var course = DR.Stream.build(m, DR.config, { seed: App.state.seed + App.state.supplements, focusCounts: short });
      runCourse(m, course, bag, function (fresh) {
        // 보충 코스의 카드 번호는 0부터 다시 시작한다 → 첫 판 카드와 겹치지 않게 접두사(NEW 표시·되돌리기가 엉뚱한 카드를 가리키지 않게)
        fresh.forEach(function (c) { c.id = 's' + App.state.supplements + '_' + c.id; });
        App.state.bag = bag.concat(fresh).concat(extra);
        // 보충 뒤에도 첫 판처럼 검수를 거친다. 새로 담은 카드에는 NEW(P3)
        App.state.newIds = fresh.map(function (c) { return c.id; }).concat(extraIds);
        review(m);
      }, extra.length);
    }, { extra: extra, peerFixed: App.state.peer === 'fixed', forceResubmit: outside });
  }

  // 3 임무 정체 공개: 1·2 임무 첫 판 실수 기록이 있으면 그 장면 이름을 '누구나 하는 실수'의 예로, 없으면 일반 문장
  function revealLines(m) {
    var rv = m.story.reveal;
    if (!rv) return [];
    var hit = null;
    ['m1', 'm2'].forEach(function (id) {
      var rec = App.records[id];
      // 옛 침수 임무 기록의 장면 이름은 인용하지 않는다(지금 임무에 있는 장면만)
      var fails = rec && rec.firstFails ? rec.firstFails.filter(function (f) { return DR.Missions[id].scenes.some(function (s) { return s.title === f.title; }); }) : [];
      if (!hit && fails.length) hit = { mission: id.slice(1) + ' 임무', scene: fails[0].title };
    });
    var mid = hit ? { who: rv.withRecord.who, text: rv.withRecord.text.replace('{mission}', hit.mission).replace('{scene}', hit.scene), face: rv.withRecord.face } : rv.withoutRecord;
    var out = rv.before.concat([mid]).concat(rv.after);
    // 장면 그림(rv.bg)이 있으면 정체 공개 줄마다 붙인다 — 대화창(DR.UI.dialogue)이 줄의 bg를 뒤에 깐다
    return rv.bg ? out.map(function (l) { return Object.assign({ bg: rv.bg }, l); }) : out;
  }

  // 임무 끝: 기록을 한 곳(DR.App.records + 저장소 records)에 남긴다 — 다음 임무 브리핑 한 줄, 3 임무 정체 공개, (검토 중인) 도시 복구 화면이 읽는다
  function finishMission(m) {
    App.state.record = { firstTry: App.state.firstTry, supplements: App.state.supplements };
    var relabels = !!(m.labels && m.relabel !== false);
    var fixed = (App.state.bag || []).filter(function (c) { return c.label !== undefined && !c.ambiguousId; }).length;
    var rec = { cleared: true, passed: !!(App.lastJudge && App.lastJudge.allPass), firstTry: App.state.firstTry === true,
      supplements: App.state.supplements, firstFails: App.state.firstFails || [], fixedLabels: fixed };
    // 이번 판 요약: 첫 제출에서 놓친 장면 · 보충 달리기 횟수 · 고친 이름표 수(이름표를 고칠 수 있는 임무만)
    var summary = [
      '첫 제출에서 놓친 장면: ' + (rec.firstFails.length ? rec.firstFails.map(function (f) { return f.title; }).join(', ') : '없음'),
      '보충 달리기: ' + rec.supplements + '번'
    ];
    if (relabels) summary.push('고친 이름표: ' + fixed + '장');
    var cityBefore = cityCount();
    App.records[m.id] = rec;
    DR.Save.finish();
    DR.Save.setRecord(m.id, rec);
    var next = m.next && DR.Missions[m.next] ? function () { startMission(m.next); } : null;
    var outroOpts = { kicker: m.title + ' 완료', next: next, summary: summary };
    var step = DR.Save.cityStep(m.id, cityBefore, cityCount());
    function toOutro() { DR.UI.outro(m.story.outro, function () { DR.Sfx.play('ui'); go('title'); }, outroOpts); }
    if (m.story.after) {
      // 4 임무: 도시 재연결(늘 5/5) → 의뢰인 한 줄 → (동기가 합류한 적 없으면) 동기의 상자 → 해커의 이후(bg) → 마무리(최종 토론 질문)
      var lines = (rec.passed ? m.story.reconnect.pass : m.story.reconnect.partial).slice();
      if (App.state.peer === 'none') lines.push(m.story.showdown.peerBox);
      var af = m.story.after;
      lines = lines.concat(af.lines.map(function (l) { return Object.assign({ bg: af.bg }, l); }));
      outroOpts.headline = '도시가 다시 이어졌다';
      outroOpts.questions = m.story.questions;
      cityScreen(m, step, function () { DR.UI.dialogue(lines, toOutro); });
      return;
    }
    // 1~3 임무: 마지막 대화(선배·정체 공개) → 도시 복구(칸이 늘었을 때만) → 임무 완료
    DR.UI.dialogue(revealLines(m).concat(m.story.senior), function () { cityScreen(m, step, toOutro); });
  }

  // 테스트 훅: 달리는 중 현재 코스에서 key(또는 ambiguousId) 카드를 앞에서부터 골라 가방에 넣는다
  function debugFill(counts) {
    var items = DR.Run.course().items;
    Object.keys(counts).forEach(function (id) {
      var need = counts[id];
      for (var i = 0; i < items.length && need > 0; i++) {
        var it = items[i];
        if (it.kind === 'card' && (it.key === id || it.ambiguousId === id || it.fakeId === id) && !DR.Run.isTaken(it.uid)) {
          DR.Run.debugTake(it.uid); need--;
        }
      }
      if (need > 0) throw new Error('코스에 ' + id + ' 카드가 모자람');
    });
  }

  // 디버그 진입: index.html?run=m1 — 타이틀을 건너뛰고 그 임무 달리기만(손맛 조정·테스트용)
  function debugRun(id) {
    var m = DR.Missions[id];
    go('run');
    var course = DR.Stream.build(m, DR.config, { seed: m.seed });
    App.course = course;
    DR.Run.start(document.getElementById('run-stage'), {
      mission: m, course: course, bag: [], bagMax: m.bag,
      onEnd: function (r) { root.__runResult = r; }
    });
  }

  var App = {
    screen: 'title', state: null, lastJudge: null, course: null, records: DR.Save.records(),
    go: go, cityCount: cityCount, startTutorial: startTutorial, practiceTutorial: practiceTutorial, startMission: startMission, afterRun: afterRun, debugFill: debugFill, resume: resume,
    mission: function () { return App.state ? DR.Missions[App.state.mission] : null; }
  };
  DR.App = App;

  var params = new URLSearchParams(root.location.search);
  if (params.get('run')) debugRun(params.get('run'));
  else if (params.get('start')) startMission(params.get('start'));
  else DR.Shell.renderTitle();
  // 첫 타이틀은 go()를 거치지 않는다 — 사진 미리 받기는 타이틀이 뜬 뒤에(시작 화면을 막지 않게)
  setTimeout(function () { if (DR.CardArt.preloadPhotos) DR.CardArt.preloadPhotos(); }, 300);
})(window);
