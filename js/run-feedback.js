/* 달리기 표시 전용. 판정/가방/저장 데이터는 변경하지 않는다. */
(function (root) {
  'use strict';
  var DR = root.DR;
  // 카드 그림 → data URL. 같은 그림(DR.CardArt가 캐시한 같은 canvas)은 한 번만 PNG로 바꾼다 — 카드가 나타날 때마다 바꾸면 그 프레임이 끊긴다(2026-11-10 계측)
  //   캐시된 canvas는 다시 그려지지 않는다(글꼴·사진이 늦게 오면 새 canvas가 만들어져 새로 바꾼다)
  var urls = new WeakMap();
  function urlOf(canvas) {
    var u = urls.get(canvas);
    if (!u) { u = canvas.toDataURL(); urls.set(canvas, u); }
    return u;
  }
  // 값이 바뀔 때만 DOM에 쓴다(매 프레임 같은 글자를 다시 쓰면 그때마다 배치 계산이 다시 돈다)
  function setText(el, text) { if (el._t !== text) { el._t = text; el.textContent = text; } }
  function label(m, c) { return c.ambiguousId ? '판단 필요' : DR.Cards.cardLabel(m, c); }
  // more = { need: DR.NeedGoal.plan(…) — 보충 달리기 누적 목표(교사 피드백 2026-11-09), reserve: 동기 카드 자리 수(4 임무 결판 뒤) }
  function create(container, mission, course, more) {
    more = more || {};
    var nLanes = DR.Stream.laneCount(mission), mid = (nLanes - 1) / 2; // 레인 수(4 임무만 4)·가운데 레인 자리
    function laneX(l) { return (l - mid) * DR.config.laneWidth; }
    var layer = document.createElement('div'); layer.className = 'run-feedback lanes-' + DR.Stream.laneCount(mission); container.appendChild(layer);
    var cards = {}, flights = [], drops = [], noticeUntil = 0, damageUntil = 0, loseTimer = null;
    var damage = document.createElement('div'); damage.className = 'damage-flash'; damage.hidden = true; layer.appendChild(damage);
    var reason = document.createElement('b'); reason.textContent = '불에 맞음'; reason.setAttribute('role', 'status'); damage.appendChild(reason);
    var warnings = Array.from({ length: nLanes }, function () { var el = document.createElement('b'); el.className = 'fire-warning'; el.textContent = '! 불'; el.hidden = true; layer.appendChild(el); return el; });
    var notice = document.createElement('div'); notice.className = 'catch-notice'; notice.setAttribute('role', 'status'); layer.appendChild(notice);
    var sign = document.createElement('div'); sign.className = 'zone-sign'; sign.setAttribute('role', 'status'); sign.hidden = true; layer.appendChild(sign);
    var progress = document.getElementById('hud-progress'), zoneEls = [], counts = {}, zoneId = null, signUntil = 0;
    // 보충 달리기에 누적 목표 패널이 있으면 구역 칸은 '이번 n장'만(누적·필요 장수는 패널이 — 숫자가 두 벌 보이지 않게)
    var needPlan = more.need || null;
    var reveal = !!(course.supplement && DR.UI.needRevealed()) && !needPlan;
    progress.classList.toggle('zone-progress', !!course.zones);
    progress.removeAttribute('aria-hidden'); progress.setAttribute('aria-label', '코스 진행');
    progress.innerHTML = course.zones ? '' : '<i></i>';
    (course.zones || []).forEach(function (zone, i) {
      counts[zone.id] = 0;
      var scene = mission.scenes.find(function (s) { return s.id === zone.id; });
      var cell = document.createElement('div'); cell.className = 'zone-cell'; cell.dataset.scene = zone.id;
      cell.title = reveal ? '이번 구역 수집 / 장면 필요 개수 합계 · 기존 가방과 조합별 충족 여부는 검수에서 확인' : '이번 달리기에서 이 구역에서 모은 사진';
      var name = document.createElement('span'); name.textContent = (i + 1) + ' ' + zone.short; cell.appendChild(name);
      var count = document.createElement('b'); count.className = 'zone-count'; cell.appendChild(count); progress.appendChild(cell);
      zoneEls.push({ cell: cell, count: count, zone: zone, need: scene.combos.reduce(function (n, c) { return n + c.need; }, 0) });
    });
    // 튜토리얼 목표(mission.runGoal): "개 n/5 · 고양이 n/5" — 다 차면 금색, 넘치면 주황 + "이미 5장!"(막지는 않는다)
    var goal = (mission.runGoal || []).map(function (g) {
      var need = mission.scenes[0].combos.filter(function (c) { return c.keys.indexOf(g.key) >= 0; })[0].need;
      var item = document.createElement('span'); item.className = 'run-goal-item'; item.dataset.goal = g.key;
      return { key: g.key, name: g.name, need: need, el: item };
    });
    if (goal.length) {
      var goalBox = document.createElement('div'); goalBox.id = 'run-goal'; goalBox.className = 'run-goal'; goalBox.setAttribute('role', 'status');
      goal.forEach(function (g, i) {
        if (i) { var dot = document.createElement('i'); dot.textContent = '·'; dot.setAttribute('aria-hidden', 'true'); goalBox.appendChild(dot); }
        goalBox.appendChild(g.el);
      });
      layer.appendChild(goalBox);
    }
    // 보충 달리기 누적 목표(DR.NeedGoal): 모자란 자료(누적 n/필요) 먼저 → 다 찬 자료(흐리게, 좁은 화면은 한 줄로) · 동기 자리 안내
    var need = null;
    if (needPlan) {
      layer.classList.add('has-need');
      var box = document.createElement('div'); box.id = 'run-need'; box.className = 'run-need'; box.setAttribute('aria-label', '보충 목표');
      var head = document.createElement('p'); head.className = 'run-need-head'; box.appendChild(head);
      var shortList = document.createElement('ul'); shortList.className = 'run-need-short'; box.appendChild(shortList);
      var doneList = document.createElement('ul'); doneList.className = 'run-need-done'; box.appendChild(doneList);
      var shortRows = [], doneCount = 0;
      needPlan.rows.forEach(function (r) {
        var li = document.createElement('li'); li.className = 'run-need-item'; li.dataset.keys = r.keys.join(' ');
        var nm = document.createElement('span'); nm.className = 'run-need-name'; nm.textContent = r.name; li.appendChild(nm);
        if (r.short) {
          var ct = document.createElement('b'); ct.className = 'run-need-count'; li.appendChild(ct);
          shortList.appendChild(li); shortRows.push({ el: li, count: ct, name: r.name });
        } else {
          doneCount++;
          li.classList.add('already');
          nm.textContent = '✓ ' + r.name + (r.peerFilled ? ' (동기 카드로)' : '');
          doneList.appendChild(li);
        }
      });
      doneList.hidden = !doneCount;
      var doneSum = document.createElement('p'); doneSum.className = 'run-need-donesum'; doneSum.hidden = !doneCount;
      doneSum.textContent = '다 찬 자료 ' + doneCount + '개는 더 안 담아도 돼요'; box.appendChild(doneSum);
      var unknown = document.createElement('p'); unknown.className = 'run-need-unknown'; unknown.hidden = true; box.appendChild(unknown);
      if (more.reserve) {
        var peerLine = document.createElement('p'); peerLine.className = 'run-need-peer'; peerLine.id = 'run-need-peer';
        peerLine.textContent = '가방 ' + more.reserve + '칸은 동기가 가져올 답안 자리예요'; box.appendChild(peerLine);
      }
      layer.appendChild(box);
      need = { box: box, head: head, rows: shortRows, unknown: unknown, last: '' };
    }
    // 가방 옆 동기 자리(4 임무 결판 뒤 보충 — 달리기 가방 칸은 그만큼 줄어 있다). 가방 칸 안 끝에 붙인다 —
    //   좁은 화면(≤650px)은 '+4'만(HUD 한 줄이 넘쳐 일시정지 버튼이 다음 줄로 밀리지 않게), 문장은 패널 줄이 말한다
    var peerPill = null;
    if (more.reserve) {
      peerPill = document.createElement('span'); peerPill.id = 'hud-peer'; peerPill.className = 'hud-peer';
      peerPill.setAttribute('role', 'note');
      peerPill.setAttribute('aria-label', '가방 ' + more.reserve + '칸은 동기가 가져올 답안 자리예요');
      var pLong = document.createElement('span'); pLong.className = 'hud-peer-long'; pLong.textContent = '동기 자리 ' + more.reserve + '칸';
      var pShort = document.createElement('span'); pShort.className = 'hud-peer-short'; pShort.textContent = '+' + more.reserve + '칸';
      peerPill.appendChild(pLong); peerPill.appendChild(pShort);
      var bagEl = document.getElementById('hud-bag');
      if (bagEl) bagEl.appendChild(peerPill);
    }
    // 패널 자리 = HUD(가방·구역 칸) 바로 아래 — 좁은 화면에서 HUD가 몇 줄이 되든 가리지 않게
    //   패널 아래 끝은 --need-bottom으로 — 좁은 화면의 잡기 알림·구역 표지가 패널 아래에 뜬다(CSS)
    var hudEl = document.getElementById('hud'), needTop = -1, needBottom = -1;
    function placeNeed() {
      if (!need || !hudEl) return;
      var top = Math.round(hudEl.getBoundingClientRect().bottom - container.getBoundingClientRect().top + 8);
      if (top !== needTop && top > 0) { needTop = top; need.box.style.top = top + 'px'; }
      var bottom = need.box.offsetTop + need.box.offsetHeight;
      if (bottom !== needBottom) { needBottom = bottom; layer.style.setProperty('--need-bottom', bottom + 'px'); }
    }
    function updateNeed(grabbed) {
      if (!need) return;
      placeNeed();
      var st = DR.NeedGoal.status(mission, needPlan, grabbed);
      var sig = st.rows.map(function (r) { return r.have; }).join(',') + '|' + st.unknown;
      if (sig === need.last) return;
      need.last = sig;
      var shorts = st.rows.filter(function (r) { return r.short; });
      shorts.forEach(function (r, i) {
        var row = need.rows[i];
        row.count.textContent = r.have + '/' + r.need + '장' + (r.done ? ' ✓' : '') + (r.lookAgain ? ' · 검수에서 다시 보기' : '');
        row.el.classList.toggle('done', r.done);
        row.el.classList.toggle('look-again', r.lookAgain);
      });
      need.head.textContent = shorts.length && shorts.every(function (r) { return r.done; }) ? '다 모았어요! 결승선까지 달려요' : '모자란 자료 · 가방에 든 것까지 셈';
      need.unknown.hidden = !st.unknown;
      need.unknown.textContent = '"?" 카드 ' + st.unknown + '장 · 검수에서 정하기';
      placeNeed();
    }
    function updateGoal(grabbed) {
      updateNeed(grabbed);
      goal.forEach(function (g) {
        var n = grabbed.filter(function (c) { return DR.Cards.truthKey(mission, c) === g.key; }).length; // 목표는 사진 기준(이름표가 틀린 카드도 사진대로 센다)
        var text = g.name + ' ' + n + '/' + g.need + (n > g.need ? ' 이미 ' + g.need + '장!' : '');
        if (g.el.textContent !== text) g.el.textContent = text;
        g.el.classList.toggle('done', n === g.need);
        g.el.classList.toggle('over', n > g.need);
      });
    }
    function card(item) {
      if (cards[item.uid]) return cards[item.uid];
      var el = document.createElement('div'); el.className = 'run-card' + (mission.labelStyle === 'word' ? ' run-card-word' : ''); el.dataset.uid = item.uid;
      el.style.setProperty('--card-color', DR.Cards.runColor(mission, item));
      var img = document.createElement('img');
      var n = parseInt(item.uid.slice(1), 10), artId = DR.Cards.artId(item);
      img.src = urlOf(DR.CardArt.card(mission, artId, n % 3, 384, n));
      img.dataset.photo = DR.CardArt.photoId(mission, artId, n); // 사진 카드면 사진 id(테스트용), 아니면 ''
      img.alt = ''; el.appendChild(img);
      if (item.glitch) el._art = { src: img.src, n: n, artId: artId, frames: {} }; // "지지직" 효과 그림은 처음 켜질 때 만든다
      var text = document.createElement('span'); text.className = 'run-card-label'; text.textContent = label(mission, item); el.appendChild(text);
      var badge = document.createElement('b'); badge.className = 'catch-badge'; badge.textContent = root.matchMedia('(pointer: coarse)').matches ? '톡! 잡기' : 'Space'; el.appendChild(badge);
      layer.appendChild(el); cards[item.uid] = el; return el;
    }
    // "지지직"(js/glitch.js, 연출만): 3D 카드와 같은 상태(s.glitchOf). 효과 그림·깨진 이름표 ↔ 원래 그대로. 움직임 줄이기 = 테두리만 흐리게
    function glitchDom(el, it, gs) {
      el.classList.toggle('glitch-soft', !!(gs && gs.soft));
      var f = gs ? gs.frame : -1;
      if (el._gf === f || (el._gf === undefined && f < 0)) return;
      el._gf = f;
      el.classList.toggle('glitching', f >= 0);
      if (f >= 0) el.dataset.glitch = it.glitch; else delete el.dataset.glitch;
      var img = el.querySelector('img'), text = el.querySelector('.run-card-label');
      if (it.glitch === 'glyph') { text.textContent = f >= 0 ? DR.Glitch.scramble(label(mission, it), f, it.uid) : label(mission, it); return; }
      var art = el._art;
      if (f >= 0 && !art.frames[f]) {
        var src = DR.CardArt.card(mission, art.artId, art.n % 3, 384, art.n);
        art.frames[f] = (it.glitch === 'rgb' ? DR.Glitch.rgbCanvas(src, f) : DR.Glitch.stripeCanvas(src, f, it.uid)).toDataURL();
      }
      img.src = f >= 0 ? art.frames[f] : art.src;
    }
    // 출발 뒤 카드가 오기 전(첫 3초)에 이 코스의 카드 그림을 한 장씩 미리 바꿔 둔다 — 달리는 중 처음 나타나는 순간에 끊기지 않게
    var warmList = course.items.filter(function (it) { return it.kind === 'card'; }), warmAt = 0, warmTimer = null;
    function warm() {
      warmTimer = null;
      var t0 = Date.now();
      // 그림을 내보낼 수 없는 환경(플래그 없이 file://로 연 사진 카드 — 캔버스가 오염됨)에서는 미리 만들기를 그만둔다(전처럼 카드가 올 때 처리)
      try {
        while (warmAt < warmList.length && Date.now() - t0 < 6) {
          var it = warmList[warmAt++], n = parseInt(it.uid.slice(1), 10);
          urlOf(DR.CardArt.card(mission, DR.Cards.artId(it), n % 3, 384, n));
        }
      } catch (e) { warmAt = warmList.length; }
      if (warmAt < warmList.length) warmTimer = setTimeout(warm, 30);
    }
    warmTimer = setTimeout(warm, 100);
    function project(pos, camera) {
      var p = pos.clone().project(camera);
      return { x: (p.x + 1) * container.clientWidth / 2, y: (1 - p.y) * container.clientHeight / 2 };
    }
    function update(s) {
      updateGoal(s.grabbed);
      zoneEls.forEach(function (e, i) {
        var active = s.z >= e.zone.start && s.z < e.zone.end;
        if (e._active !== active) { e._active = active; e.cell.classList.toggle('current', active); }
        var zp = Math.max(0, Math.min(100, (s.z - e.zone.start) / (e.zone.end - e.zone.start) * 100)).toFixed(1) + '%';
        if (e._zp !== zp) { e._zp = zp; e.cell.style.setProperty('--zone-progress', zp); }
        setText(e.count, '이번 ' + counts[e.zone.id] + (reveal ? '/' + e.need : '장'));
        if (active && zoneId !== e.zone.id) { zoneId = e.zone.id; signUntil = s.t + 2; sign.textContent = '구역 ' + (i + 1) + ' · ' + e.zone.title; }
      });
      sign.hidden = !zoneId || s.t >= signUntil;
      damage.hidden = s.t >= damageUntil;
      warnings.forEach(function (el, lane) {
        var warn = s.course.items.some(function (it) { var d = it.z - s.z; return it.kind === 'fire' && it.lane === lane && d > 0 && d <= Math.max(s.speed, DR.config.baseSpeed) * DR.config.fire.warn; });
        el.hidden = !warn;
        if (warn) { var p = project(new THREE.Vector3(laneX(lane), 0.5, -s.z - 8), s.camera); el.style.left = p.x + 'px'; el.style.top = Math.min(container.clientHeight - 90, p.y) + 'px'; }
      });
      // 카드 배치는 세 묶음으로: ① 폭 쓰기 → ② 높이 읽기(폭이 바뀐 카드만) → ③ 자리 쓰기.
      //   카드마다 쓰고 바로 읽으면 보이는 카드 수만큼 배치 계산이 다시 돈다(2026-11-10 계측: 프레임당 평균 10ms)
      var seen = {}, placed = [];
      s.course.items.forEach(function (it) {
        if (it.kind !== 'card' || s.taken.has(it.uid)) return;
        var d = it.z - s.z, phase = DR.Catch.phase(it, s.z, s.speed, DR.config);
        if (d > 34 || phase === 'passed' || s.behindWall(it)) return; // 벽 뒤 카드는 3D로만 — 큰 카드가 앞의 벽을 가리지 않게
        var el = card(it); seen[it.uid] = true; el.hidden = false;
        if (it.glitch) glitchDom(el, it, s.glitchOf ? s.glitchOf(it, d, s.speed) : null);
        var p = project(new THREE.Vector3(laneX(it.lane), 2.2, -it.z), s.camera);
        var width = Math.min(container.clientWidth < 600 ? 112 : 204, Math.max(96, container.clientHeight - 250), Math.max(150, 4000 / (d + 15)));
        if (nLanes > 3) {
          // 4레인: 네 칸이 화면 폭에 나란히 들어가게 — 칸 자리는 모든 카드가 같은 기준(러너 앞 20m)·같은 간격(가장 큰 카드 폭 + 10)이라
          //   앞뒤 간격으로 거리가 다른 옆 레인 카드끼리도 겹치지 않는다(3레인은 예전 그대로 카드마다 그 거리에서 잰다)
          var cap = Math.min(container.clientWidth < 600 ? 112 : 204, Math.max(96, container.clientHeight - 250), Math.floor((container.clientWidth - 16) / nLanes) - 10);
          width = Math.min(width, cap);
          var refM = project(new THREE.Vector3(0, 2.2, -s.z - 20), s.camera), refN = project(new THREE.Vector3(DR.config.laneWidth, 2.2, -s.z - 20), s.camera);
          p.x = refM.x + (it.lane - mid) * Math.max(refN.x - refM.x, cap + 10);
        } else {
          var middle = project(new THREE.Vector3(0, 2.2, -it.z), s.camera);
          var next = project(new THREE.Vector3(DR.config.laneWidth, 2.2, -it.z), s.camera);
          p.x = middle.x + (it.lane - 1) * Math.max(next.x - middle.x, width + 16);
        }
        width = Math.round(width);
        var x = Math.max(width / 2 + 8, Math.min(container.clientWidth - width / 2 - 8, p.x));
        if (el._w !== width) { el._w = width; el._h = 0; el.style.width = width + 'px'; }
        placed.push({ el: el, x: x, py: p.y - width / 2, z: String(Math.round(200 - d)), on: phase === 'active' && it.lane === s.lane && !s.full });
      });
      placed.forEach(function (c) { if (!c.el._h) c.el._h = c.el.offsetHeight; });
      var viewH = container.clientHeight;
      placed.forEach(function (c) {
        var el = c.el, y = Math.max(85, Math.min(viewH - el._h - 55, c.py));
        el.style.left = c.x + 'px'; el.style.top = y + 'px';
        if (el._z !== c.z) { el._z = c.z; el.style.zIndex = c.z; }
        if (el._on !== c.on) { el._on = c.on; el.classList.toggle('catch-active', c.on); }
      });
      Object.keys(cards).forEach(function (id) { if (!seen[id]) cards[id].hidden = true; });
      notice.hidden = !notice.textContent || s.t > noticeUntil;
      drops = drops.filter(function (f) {
        var a = Math.min(1, (s.t - f.start) / 0.6);
        f.el.style.left = (f.x + f.dx * a) + 'px';
        f.el.style.top = (f.y + f.dy * a * a - 60 * a * (1 - a)) + 'px';
        f.el.style.transform = 'translate(-50%, -50%) rotate(' + (a * f.spin) + 'deg) scale(' + (1 + a * 0.8) + ')';
        f.el.style.opacity = String(1 - a);
        if (a === 1) { f.el.remove(); return false; } return true;
      });
      flights = flights.filter(function (f) {
        var a = Math.min(1, (s.t - f.start) / 0.45), ease = a * a;
        f.el.style.left = (f.x + (f.tx - f.x) * ease) + 'px';
        f.el.style.top = (f.y + (f.ty - f.y) * ease) + 'px';
        f.el.style.transform = 'translate(-50%, -50%) scale(' + (1 - a * 0.9) + ')';
        f.el.style.opacity = String(1 - a * 0.5);
        if (a === 1) { f.el.remove(); return false; } return true;
      });
    }
    function take(it, t) {
      if (it.zoneId) counts[it.zoneId]++;
      notice.textContent = '+ ' + label(mission, it); notice.hidden = false; noticeUntil = t + 1; notice.classList.remove('lost');
      var source = cards[it.uid];
      if (!source || source.hidden || root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var el = source.cloneNode(true); el.className = 'run-card caught-flight'; el.removeAttribute('data-uid'); layer.appendChild(el);
      var bag = document.getElementById('hud-bag').getBoundingClientRect(), box = container.getBoundingClientRect();
      var y = parseFloat(source.style.top) + source.offsetHeight / 2;
      el.style.top = y + 'px'; el.style.transform = 'translate(-50%, -50%)';
      flights.push({ el: el, start: t, x: parseFloat(source.style.left), y: y, tx: bag.left + bag.width / 2 - box.left, ty: bag.top + bag.height / 2 - box.top });
    }
    // 벽에 부딪혀 카드를 잃음: 구역 "이번 N장"을 줄이고, 가방 칸 빨갛게 + "-1", 문구, 카드가 가방에서 뒤로(화면 아래로) 튀어 나간다
    function drop(lost, t) {
      lost.forEach(function (g) {
        var it = course.items.filter(function (i) { return i.uid === g.uid; })[0];
        if (it && it.zoneId && counts[it.zoneId] > 0) counts[it.zoneId]--;
      });
      notice.textContent = '노이즈! 카드 ' + lost.length + '장을 잃었어'; notice.hidden = false; noticeUntil = t + 1.6; notice.classList.add('lost');
      var bag = document.getElementById('hud-bag');
      bag.classList.remove('lose'); void bag.offsetWidth; bag.classList.add('lose');
      var old = bag.querySelector('.bag-minus'); if (old) old.remove();
      var minus = document.createElement('span'); minus.className = 'bag-minus'; minus.setAttribute('aria-hidden', 'true'); minus.textContent = '-' + lost.length; bag.appendChild(minus);
      clearTimeout(loseTimer);
      loseTimer = setTimeout(function () { bag.classList.remove('lose'); minus.remove(); }, 800);
      if (root.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var r = bag.getBoundingClientRect(), box = container.getBoundingClientRect();
      lost.forEach(function (g, i) {
        var el = document.createElement('div'); el.className = 'run-card lost-flight';
        var n = parseInt(g.uid.slice(1), 10), img = document.createElement('img');
        img.src = DR.CardArt.card(mission, DR.Cards.artId(g), n % 3, 192, n).toDataURL(); img.alt = ''; el.appendChild(img);
        layer.appendChild(el);
        var x = r.left + r.width / 2 - box.left, y = r.top + r.height / 2 - box.top;
        el.style.left = x + 'px'; el.style.top = y + 'px';
        drops.push({ el: el, start: t, x: x, y: y, dx: 90 + i * 40, dy: container.clientHeight * 0.6, spin: 200 });
      });
    }
    function hide() { layer.style.visibility = 'hidden'; }
    function destroy() {
      clearTimeout(loseTimer); clearTimeout(warmTimer);
      var bag = document.getElementById('hud-bag');
      if (bag) { bag.classList.remove('lose'); var m = bag.querySelector('.bag-minus'); if (m) m.remove(); }
      layer.remove();
      if (peerPill) peerPill.remove();
    }
    return { update: update, take: take, drop: drop, hide: hide, damage: function (t) { damageUntil = t + 0.8; damage.hidden = false; }, destroy: destroy };
  }
  DR.RunFeedback = { create: create };
})(window);
