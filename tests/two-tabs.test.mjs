// 두 탭이 한 저장소를 나눠 쓸 때 '처음부터'(보안 검토 2026-11-18 #1)
//   탭 A에서 새로 시작해도 탭 B의 챕터 끝(js/ui-chapter.js)은 이전 선택·메모를 메모리에 들고 있다 →
//   B의 늦은 입력이 지운 답안을 다시 저장하면 안 된다. B는 storage 이벤트로 바로 비워지고(새로고침), 늦은 입력은 버려진다.
//   한 탭만 쓸 때·두 탭이 초기화 없이 번갈아 쓸 때의 저장은 예전 그대로.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { boot, store, root, KEY } from './app-flow-helper.mjs';

// 아주 작은 가짜 DOM — ui-chapter가 쓰는 만큼만
function node(tag, attrs = {}, kids) {
  const n = {
    tag, attrs: {}, children: [], on: {}, value: '', disabled: false, hidden: false, scrollTop: 0, textContent: attrs.text || '',
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(t, f) { (n.on[t] = n.on[t] || []).push(f); },
    appendChild(c) { n.children.push(c); return c; },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return k in n.attrs ? n.attrs[k] : null; }, removeAttribute(k) { delete n.attrs[k]; },
    querySelector() { return null; }, focus() {}, blur() {},
    set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; }
  };
  for (const k of Object.keys(attrs)) if (k !== 'text') n.attrs[k] = String(attrs[k]);
  for (const c of [].concat(kids || [])) if (c) n.children.push(c);
  return n;
}
function find(n, pred) {
  if (!n || typeof n !== 'object') return null;
  if (pred(n)) return n;
  for (const c of n.children || []) { const r = find(c, pred); if (r) return r; }
  return null;
}
const byId = (scr, id) => find(scr, (n) => n.attrs && n.attrs.id === id);
const choice = (scr, cid) => find(scr, (n) => n.attrs && n.attrs['data-choice'] === cid);
const fireOn = (n, t) => (n.on[t] || []).forEach((f) => f({}));

// 탭 하나 = app.js + ui-chapter.js를 같은 저장소로 boot
function tab(st) {
  const t = boot(st);
  const screen = node('section');
  t.ctx.document.getElementById = (id) => (id === 'screen-chapter' ? screen : null);
  t.DR.UI.el = node;
  t.DR.UI.line = () => node('p');
  t.DR.Sfx = { play() {} };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/ui-chapter.js'), 'utf8'), t.ctx, { filename: 'js/ui-chapter.js' });
  t.screen = screen;
  t.openChapter = (id, step) => t.DR.UI.chapter(t.DR.Missions[id], { step }, () => {});
  return t;
}
// 1 임무를 깨고 챕터 끝에 답을 남긴 저장(이름 같은 불필요한 정보까지 적었다고 치자)
const OLD_NOTE = '내 이름은 김철수, 목적 밖으로 쓰면 안 된다';
function played() {
  const st = store();
  const t = boot(st);
  t.Save.passTutorial();
  t.Save.setRecord('m1', { cleared: true, firstTry: true, supplements: 0, firstFails: [], chapter: { req: { first: 'erase', last: 'refuse' }, concept: { first: 'b', last: 'a' }, note: OLD_NOTE } });
  return st;
}
// 같은 탭의 '처음부터'(ui-shell begin과 같은 두 줄) — 다른 탭에는 storage 이벤트가 간다
function resetIn(t, others) {
  const before = t.st.getItem(KEY);
  t.Save.clear(); t.App.records = {};
  for (const o of others) o.fire('storage', { key: KEY, oldValue: before, newValue: t.st.getItem(KEY) });
}
const savedText = (st) => st.getItem(KEY) || '';

test('재현: 탭 A 새로 시작 → 탭 B 늦은 입력(생각 쓰기)이 지운 답안을 되살리지 않는다', () => {
  const st = played();
  const A = tab(st), B = tab(st);
  B.openChapter('m1', 3);
  const area = byId(B.screen, 'ch-note');
  assert.equal(area.value, OLD_NOTE, 'B shows the old note before reset');
  resetIn(A, []); // storage 이벤트가 안 오거나 늦게 오는 경우(늦은 입력이 먼저)
  area.value = OLD_NOTE + '!';
  fireOn(area, 'input');
  assert.deepEqual({ ...A.Save.records() }, {}, 'old records must not come back');
  assert.ok(!savedText(st).includes('김철수'), 'old note must not be in storage');
  assert.ok(!savedText(st).includes('refuse'), 'old choices must not be in storage');
  assert.ok(B.log.includes('reload'), 'stale tab B reloads (clears its in-memory answers)');
});

test('재현: 탭 A 새로 시작 → 탭 B 늦은 고르기도 버려진다', () => {
  const st = played();
  const A = tab(st), B = tab(st);
  B.openChapter('m1', 1);
  resetIn(A, []);
  fireOn(choice(B.screen, 'erase'), 'click');
  assert.deepEqual({ ...A.Save.records() }, {});
  assert.ok(!savedText(st).includes('refuse'));
  assert.ok(B.log.includes('reload'));
});

test('storage 이벤트: 탭 A 새로 시작 → 탭 B는 바로 메모리의 기록을 비우고 새로고침', () => {
  const st = played();
  const A = tab(st), B = tab(st);
  B.openChapter('m1', 3);
  assert.ok(B.App.records.m1, 'B had the old record in memory');
  resetIn(A, [B]);
  assert.deepEqual({ ...B.App.records }, {}, 'B memory cleared');
  assert.ok(B.log.includes('reload'), 'B reloads right away');
  assert.ok(!A.log.includes('reload'), 'A (the one that reset) does not reload');
  // 이벤트 뒤 새로고침 전에 들어온 입력도 버려진다
  const area = byId(B.screen, 'ch-note');
  area.value = OLD_NOTE; fireOn(area, 'input');
  assert.deepEqual({ ...A.Save.records() }, {});
  // 새로고침한 B(같은 저장소로 다시 boot)는 빈 기록에서 시작하고 저장도 다시 된다
  const B2 = tab(st);
  assert.deepEqual({ ...B2.App.records }, {});
  B2.Save.setRecord('m1', { cleared: true });
  assert.equal(A.Save.records().m1.cleared, true);
});

test('탭 B의 다른 늦은 쓰기(체크포인트·기록·뒤 활동)도 옛 진행을 되살리지 않는다', () => {
  const st = played();
  const A = tab(st), B = tab(st);
  resetIn(A, []);
  assert.equal(B.Save.checkpoint('inspect', { mission: 'm2', bag: [], seed: 7 }, {}), false);
  assert.equal(B.Save.setRecord('m1', { cleared: true }), false);
  assert.equal(B.Save.setEnding({ mission: 'm1', step: 2, city: null, peer: 'none', compare: null }), false);
  assert.equal(A.Save.load().mission, null);
  assert.deepEqual({ ...A.Save.records() }, {});
  assert.equal(A.Save.ending(), null);
  // A는 계속 저장된다
  assert.equal(A.Save.checkpoint('briefing', { mission: 'tutorial', bag: [], seed: 1 }, {}), true);
  assert.equal(A.Save.load().mission, 'tutorial');
});

test('초기화 없이 두 탭이 번갈아 쓰면 예전 그대로 저장되고, 서로 새로고침하지 않는다', () => {
  const st = played();
  const A = tab(st), B = tab(st);
  const before = st.getItem(KEY);
  assert.equal(B.Save.setRecord('m2', { cleared: true }), true);
  A.fire('storage', { key: KEY, oldValue: before, newValue: st.getItem(KEY) });
  assert.equal(A.Save.setRecord('m3', { cleared: true }), true);
  B.fire('storage', { key: KEY, newValue: st.getItem(KEY) });
  assert.ok(A.Save.records().m2 && A.Save.records().m3);
  assert.ok(!A.log.includes('reload') && !B.log.includes('reload'));
});

test('한 탭: 생각 쓰기는 입력마다 저장되고 새로 시작 뒤에도 그 탭은 계속 저장된다', () => {
  const st = played();
  const A = tab(st);
  A.openChapter('m1', 3);
  const area = byId(A.screen, 'ch-note');
  area.value = '다른 데 쓰면 안 된다'; fireOn(area, 'input');
  assert.equal(A.Save.records().m1.chapter.note, '다른 데 쓰면 안 된다');
  assert.equal(byId(A.screen, 'ch-saved').textContent, '저장했어');
  resetIn(A, []);
  assert.deepEqual({ ...A.Save.records() }, {});
  assert.equal(A.Save.setRecord('m1', { cleared: true }), true);
  assert.equal(A.Save.records().m1.cleared, true);
  assert.ok(!A.log.includes('reload'));
});

test('옛 저장(초기화 표시 없음)을 연 탭도 다른 탭의 첫 초기화를 알아챈다 · 새로 연 탭은 새 기록을 따른다', () => {
  const st = store();
  st.setItem(KEY, JSON.stringify({ v: 1, mission: null, tutorialDone: true, cityV: 1, records: { m1: { cleared: true, chapter: { req: { first: 'refuse', last: 'refuse' }, concept: { first: 'a', last: 'a' }, note: OLD_NOTE } } } }));
  const A = tab(st), B = tab(st);
  resetIn(A, [B]);
  assert.ok(B.log.includes('reload'));
  assert.equal(B.Save.setRecord('m1', { cleared: true, chapter: { note: OLD_NOTE } }), false);
  const C = tab(st);
  assert.equal(C.Save.setRecord('m2', { cleared: true }), true);
  assert.deepEqual([...Object.keys(A.Save.records())], ['m2']);
});

test('생각 쓰기 칸 앞에 저장 안내 한 줄(보안 검토 #2): 이 브라우저에 저장 + 지우는 곳 = 처음 화면의 처음부터', () => {
  const A = tab(played());
  A.openChapter('m1', 3);
  const page = A.screen.children[0];
  const ids = page.children.map((n) => n.attrs && n.attrs.id);
  const store = byId(A.screen, 'ch-note-store');
  assert.ok(store, 'notice exists');
  assert.match(store.textContent, /브라우저에 저장/);
  assert.match(store.textContent, /처음 화면의 '처음부터'/);
  assert.ok(ids.indexOf('ch-note-store') < ids.indexOf('ch-note'), 'shown before the text box');
  assert.match(byId(A.screen, 'ch-note').attrs['aria-describedby'], /\bch-note-store\b/);
  // 안내가 가리키는 버튼이 실제로 그 이름으로 타이틀에 있다
  const shell = fs.readFileSync(path.join(root, 'js/ui-shell.js'), 'utf8');
  assert.match(shell, /id: 'btn-fresh'[^\n]*text: '처음부터'/);
  assert.match(shell, /id: 'btn-restart'[^\n]*text: '처음부터 다시'/);
});
