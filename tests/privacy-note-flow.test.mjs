// 검수 안내대로 하면 승인되는가(리뷰 2026-11-13 회귀 검사) — 실제 app.js의 afterRun → 검수 콜백 → askSupervisor → 감독관 막기/승인 길.
// 화면 그리기(DR.UI)만 가짜. 원래 결함: 2 임무에도 공통 안내 "… 가려야 해요."가 떠서, 안내대로 얼굴을 가린 학생이
//   "이 사진은 가리는 걸로 안 돼. 빼야 해."로 막혔다. 이제 2 임무 안내 = 빼기(가리면 여전히 막힘 — 교사 규칙 그대로).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['js/config.js', 'js/rng.js', 'js/cards.js', 'js/privacy.js', 'js/save.js', 'missions/m1.js', 'missions/m2.js', 'missions/m3.js', 'missions/m4.js'];

function store() {
  const v = new Map();
  return { getItem: (k) => (v.has(k) ? v.get(k) : null), setItem: (k, x) => v.set(k, String(x)), removeItem: (k) => v.delete(k) };
}

// 미션 하나를 새 vm 문맥에 올린다(전역 오염 없음). 가방 = 그 임무 개인정보 카드 + 흔한 카드 하나
function boot(id) {
  const ctx = { console, Math, JSON, Date, URLSearchParams, setTimeout, clearTimeout, location: { search: '' }, addEventListener() {}, document: { readyState: 'loading' } };
  ctx.window = ctx; ctx.localStorage = store();
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  const DR = ctx.DR, log = { submit: null, block: null, approved: 0 };
  DR.Shell = { renderTitle() {} };
  DR.UI = {
    inspect(m, bag, done) { log.submit = done; },
    supervisorBlock(lines) { log.block = Array.from(lines, (l) => l.text); },
    supervisor() { log.approved++; }
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), ctx, { filename: 'js/app.js' });
  const m = DR.Missions[id];
  const bag = m.privacy.cards.map((d, i) => ({ id: 'c' + i, key: d.key, privateId: d.id }));
  bag.push({ id: 'c9', key: m.privacy.cards[0].key });
  DR.App.state = { mission: id, bag, seed: m.seed };
  DR.App.afterRun(m);
  const submit = () => { log.block = null; log.approved = 0; log.submit(); return log; };
  return { DR, m, bag, submit, note: DR.Privacy.text(m, 'inspectNote') };
}

test('m2: note says remove (not mask); masking is still rejected, removing is approved', () => {
  const { DR, m, bag, submit, note } = boot('m2');
  assert.match(note, /빼야 해요/);
  assert.doesNotMatch(note, /가려야/);
  // 안내를 어기고 가리면: 규칙 그대로 막힌다(감독관 두 줄 = 가려도 기록이 남는다 · 빼야 해)
  for (const c of bag.filter((x) => x.privateId)) assert.equal(DR.Privacy.toggleMask(m, c), true);
  let r = submit();
  assert.equal(r.approved, 0);
  assert.deepEqual(r.block, [DR.Privacy.text(m, 'blockMustRemove'), DR.Privacy.text(m, 'blockMustRemove2')]);
  assert.match(r.block[1], /빼야 해/);
  // 안내대로 빼면: 승인 질문으로 넘어간다
  DR.App.state.bag = bag.filter((x) => !x.privateId);
  r = submit();
  assert.equal(r.block, null);
  assert.equal(r.approved, 1);
});

for (const id of ['m1', 'm3', 'm4']) {
  test(id + ': note says mask; following it (mask both) is approved, mask survives save → reload', () => {
    const { DR, m, bag, submit, note } = boot(id);
    assert.match(note, /가려야 해요/);
    assert.doesNotMatch(note, /빼야/);
    for (const c of bag.filter((x) => x.privateId)) assert.equal(DR.Privacy.toggleMask(m, c), true);
    const r = submit();
    assert.equal(r.block, null, id + ' blocked: ' + JSON.stringify(r.block));
    assert.equal(r.approved, 1);
    // 검수 체크포인트(가린 것 포함 — 화면에선 가리기 뒤 ui-inspect saveBag이 다시 저장)를 다시 읽어도 승인 그대로
    DR.Save.checkpoint('inspect', DR.App.state, {});
    const loaded = DR.Save.load();
    assert.equal(loaded.bag.filter((c) => c.masked).length, 2);
    assert.equal(DR.Privacy.check(m, loaded.bag).ok, true);
    assert.equal(DR.Save.fitsMission(m, loaded.bag), true);
  });
}
