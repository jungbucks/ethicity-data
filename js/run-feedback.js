/* 달리기 표시 전용. 판정/가방/저장 데이터는 변경하지 않는다. */
(function (root) {
  'use strict';
  var DR = root.DR;
  function label(m, c) { return c.ambiguousId ? '판단 필요' : DR.Cards.cardLabel(m, c); }
  function create(container, mission, course) {
    var layer = document.createElement('div'); layer.className = 'run-feedback'; container.appendChild(layer);
    var cards = {}, flights = [], drops = [], noticeUntil = 0, damageUntil = 0, loseTimer = null;
    var damage = document.createElement('div'); damage.className = 'damage-flash'; damage.hidden = true; layer.appendChild(damage);
    var reason = document.createElement('b'); reason.textContent = '불에 맞음'; reason.setAttribute('role', 'status'); damage.appendChild(reason);
    var warnings = [0, 1, 2].map(function () { var el = document.createElement('b'); el.className = 'fire-warning'; el.textContent = '! 불'; el.hidden = true; layer.appendChild(el); return el; });
    var notice = document.createElement('div'); notice.className = 'catch-notice'; notice.setAttribute('role', 'status'); layer.appendChild(notice);
    var sign = document.createElement('div'); sign.className = 'zone-sign'; sign.setAttribute('role', 'status'); sign.hidden = true; layer.appendChild(sign);
    var progress = document.getElementById('hud-progress'), zoneEls = [], counts = {}, zoneId = null, signUntil = 0;
    var reveal = !!(course.supplement && DR.UI.needRevealed());
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
    function updateGoal(grabbed) {
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
      var el = document.createElement('div'); el.className = 'run-card'; el.dataset.uid = item.uid;
      el.style.setProperty('--card-color', DR.Cards.runColor(mission, item));
      var img = document.createElement('img');
      var n = parseInt(item.uid.slice(1), 10), artId = DR.Cards.artId(item);
      img.src = DR.CardArt.card(mission, artId, n % 3, 384, n).toDataURL();
      img.dataset.photo = DR.CardArt.photoId(mission, artId, n); // 사진 카드면 사진 id(테스트용), 아니면 ''
      img.alt = ''; el.appendChild(img);
      var text = document.createElement('span'); text.className = 'run-card-label'; text.textContent = label(mission, item); el.appendChild(text);
      var badge = document.createElement('b'); badge.className = 'catch-badge'; badge.textContent = root.matchMedia('(pointer: coarse)').matches ? '톡! 잡기' : 'Space'; el.appendChild(badge);
      layer.appendChild(el); cards[item.uid] = el; return el;
    }
    function project(pos, camera) {
      var p = pos.clone().project(camera);
      return { x: (p.x + 1) * container.clientWidth / 2, y: (1 - p.y) * container.clientHeight / 2 };
    }
    function update(s) {
      updateGoal(s.grabbed);
      zoneEls.forEach(function (e, i) {
        var active = s.z >= e.zone.start && s.z < e.zone.end;
        e.cell.classList.toggle('current', active);
        e.cell.style.setProperty('--zone-progress', Math.max(0, Math.min(100, (s.z - e.zone.start) / (e.zone.end - e.zone.start) * 100)) + '%');
        e.count.textContent = '이번 ' + counts[e.zone.id] + (reveal ? '/' + e.need : '장');
        if (active && zoneId !== e.zone.id) { zoneId = e.zone.id; signUntil = s.t + 2; sign.textContent = '구역 ' + (i + 1) + ' · ' + e.zone.title; }
      });
      sign.hidden = !zoneId || s.t >= signUntil;
      damage.hidden = s.t >= damageUntil;
      warnings.forEach(function (el, lane) {
        var warn = s.course.items.some(function (it) { var d = it.z - s.z; return it.kind === 'fire' && it.lane === lane && d > 0 && d <= Math.max(s.speed, DR.config.baseSpeed) * DR.config.fire.warn; });
        el.hidden = !warn;
        if (warn) { var p = project(new THREE.Vector3((lane - 1) * DR.config.laneWidth, 0.5, -s.z - 8), s.camera); el.style.left = p.x + 'px'; el.style.top = Math.min(container.clientHeight - 90, p.y) + 'px'; }
      });
      var seen = {};
      s.course.items.forEach(function (it) {
        if (it.kind !== 'card' || s.taken.has(it.uid)) return;
        var d = it.z - s.z, phase = DR.Catch.phase(it, s.z, s.speed, DR.config);
        if (d > 34 || phase === 'passed' || s.behindWall(it)) return; // 벽 뒤 카드는 3D로만 — 큰 카드가 앞의 벽을 가리지 않게
        var el = card(it); seen[it.uid] = true; el.hidden = false;
        var p = project(new THREE.Vector3((it.lane - 1) * DR.config.laneWidth, 2.2, -it.z), s.camera);
        var width = Math.min(container.clientWidth < 600 ? 112 : 204, Math.max(96, container.clientHeight - 250), Math.max(150, 4000 / (d + 15)));
        var middle = project(new THREE.Vector3(0, 2.2, -it.z), s.camera);
        var next = project(new THREE.Vector3(DR.config.laneWidth, 2.2, -it.z), s.camera);
        p.x = middle.x + (it.lane - 1) * Math.max(next.x - middle.x, width + 16);
        var x = Math.max(width / 2 + 8, Math.min(container.clientWidth - width / 2 - 8, p.x));
        el.style.width = width + 'px';
        var y = Math.max(85, Math.min(container.clientHeight - el.offsetHeight - 55, p.y - width / 2));
        el.style.left = x + 'px'; el.style.top = y + 'px';
        el.style.zIndex = String(Math.round(200 - d));
        el.classList.toggle('catch-active', phase === 'active' && it.lane === s.lane && !s.full);
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
      clearTimeout(loseTimer);
      var bag = document.getElementById('hud-bag');
      if (bag) { bag.classList.remove('lose'); var m = bag.querySelector('.bag-minus'); if (m) m.remove(); }
      layer.remove();
    }
    return { update: update, take: take, drop: drop, hide: hide, damage: function (t) { damageUntil = t + 0.8; damage.hidden = false; }, destroy: destroy };
  }
  DR.RunFeedback = { create: create };
})(window);
