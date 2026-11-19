// app.js를 화면 없이 node vm에서 돌리는 도우미(리뷰 2026-11-18 #5·#6 회귀 검사).
//   실제 흐름(app.js)·저장(save.js)·판정·코스는 진짜, 화면 그리기(DR.UI)·달리기(DR.Run)·대화는 가짜 — 넘겨받은 콜백을 ui[이름]에 남긴다.
//   setTimeout은 바로 실행(달리기 끝 → 다음 화면이 다음 틱으로 미뤄지는 것).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['js/config.js', 'js/rng.js', 'missions/cast.js', 'missions/tutorial.js', 'missions/m1.js', 'missions/m2.js', 'missions/m3.js', 'missions/m4.js', 'missions/prologue.js',
  'js/josa.js', 'js/cards.js', 'js/privacy.js', 'js/judge.js', 'js/result-line.js', 'js/grade-compare.js', 'js/showdown.js', 'js/need-goal.js', 'js/glitch.js', 'js/stream.js', 'js/save.js'];
export const KEY = 'ethicity.data.save';

export function store() {
  const v = new Map();
  return { _m: v, getItem: (k) => (v.has(k) ? v.get(k) : null), setItem: (k, x) => v.set(k, String(x)), removeItem: (k) => v.delete(k) };
}

// st = 저장소(새로고침 흉내 = 같은 저장소로 다시 boot), run = DR.Run.start 대신 부를 함수(기본: 아무것도 안 잡고 바로 끝)
export function boot(st, opts = {}) {
  const ui = {}, log = [], on = {};
  const doc = { readyState: 'loading', activeElement: null, getElementById: () => null, querySelector: () => null };
  const ctx = { console, Math, JSON, Date, URLSearchParams, setTimeout: (f) => f(), clearTimeout() {}, location: { search: '', reload() { log.push('reload'); } }, addEventListener: (t, f) => (on[t] = on[t] || []).push(f), document: doc };
  ctx.window = ctx; ctx.localStorage = st || store();
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  const DR = ctx.DR;
  DR.Shell = { renderTitle() { log.push('title'); } };
  const keep = (name) => function (...a) { ui[name] = a; log.push(name); };
  DR.UI = {
    opening: (beats, done) => { log.push('opening'); done(); },
    briefing: keep('briefing'), tutorialGoal: keep('tutorialGoal'), examInspect: keep('examInspect'), examDemo: keep('examDemo'),
    dialogue: keep('dialogue'), city: keep('city'), inspect: keep('inspect'), supplementPrep: keep('supplementPrep'), no3d: keep('no3d'), knockout: keep('knockout')
  };
  DR.Run = {
    start: opts.run || ((container, o) => { log.push('run'); o.onEnd({ grabbed: [], lost: [], knockedOut: false }); return true; }),
    stop() {}
  };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), ctx, { filename: 'js/app.js' });
  // fire = 이 탭(창)에 이벤트 보내기(다른 탭이 저장소를 바꿨을 때의 storage 이벤트 흉내 등)
  const fire = (type, ev = {}) => (on[type] || []).forEach((f) => f(ev));
  return { DR, App: DR.App, Save: DR.Save, ui, log, st: ctx.localStorage, ctx, fire };
}

// 타이틀이 새로고침 뒤에 내놓을 길(ui-shell renderTitle과 같은 순서): 'resume:<임무>:<화면>' · 'next:<임무>' · 'start'
export function titleOffer(Save) {
  const s = Save.load();
  if (s && s.mission) return 'resume:' + s.mission + ':' + s.screen;
  if (Save.hasSave()) { const n = Save.nextMission(Save.records()); if (n) return 'next:' + n; }
  return 'start';
}
