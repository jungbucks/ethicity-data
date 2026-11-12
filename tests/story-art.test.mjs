// 대화 그림(2026-11-11): 학생 초상 시트 + 1·2 임무 도입·마무리 장면 그림 — 파일·규격·임무 데이터 연결
//   그림을 다시 만들 땐 tools/story-art.mjs(원본 assets/_incoming/은 저장소 밖). 화면 확인은 story-bg-browser.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cast = require('../missions/cast.js');
const m1 = require('../missions/m1.js'), m2 = require('../missions/m2.js'), m3 = require('../missions/m3.js'), m4 = require('../missions/m4.js');
const tut = require('../missions/tutorial.js'), flood = require('../missions/legacy-flood.js');
const file = (p) => new URL('../' + p, import.meta.url);
const text = (p) => fs.readFileSync(file(p), 'utf8');

// webp 머리말에서 크기·알파를 읽는다(의존성 없이): VP8X(확장 — 알파 플래그) / 'VP8 '(손실) / VP8L(무손실)
function webpInfo(p) {
  const b = fs.readFileSync(file(p));
  assert.equal(b.toString('ascii', 0, 4), 'RIFF', p); assert.equal(b.toString('ascii', 8, 12), 'WEBP', p);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3), alpha: !!(b[20] & 0x10), bytes: b.length };
  if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, alpha: false, bytes: b.length };
  if (kind === 'VP8L') { const n = b.readUInt32LE(21); return { width: 1 + (n & 0x3fff), height: 1 + ((n >> 14) & 0x3fff), alpha: !!((n >> 28) & 1), bytes: b.length }; }
  throw new Error(p + ': unknown webp chunk ' + kind);
}

test('학생 초상 시트: 다른 2표정 시트와 같은 규격(1024×256, 알파) + ui-story SHEETS·SHEET_NAMES에 student', () => {
  const s = webpInfo('assets/characters/student-portraits.webp');
  const ref = webpInfo('assets/characters/courier-portraits.webp');
  assert.deepEqual([s.width, s.height, s.alpha], [1024, 256, true]);
  assert.deepEqual([ref.width, ref.height, ref.alpha], [1024, 256, true], 'reference sheet');
  const ui = text('js/ui-story.js');
  assert.match(ui, /var SHEETS = \{[^}]*\bstudent: \['student', 2\]/, 'SHEETS.student = 2표정');
  assert.match(ui, /var SHEET_NAMES = \{[^}]*\bstudent: '학생'/, 'SHEET_NAMES.student');
  assert.equal(cast.student.name, '학생');
});

test('1 임무 학생 표정: 첫 줄은 걱정, 마지막 "이제 우산 칸에 떠요!"는 기본(face 없음)', () => {
  const first = m1.story.intro[0];
  assert.deepEqual([first.who, first.text, first.face], ['student', '제 우산 여기 있잖아요. 왜 목록에 없어요?', 'worried']);
  const pass = m1.story.clientPass[0];
  assert.deepEqual([pass.who, pass.text], ['student', '이제 우산 칸에 떠요!']);
  assert.ok(pass.face === undefined || pass.face === 'basic', 'basic face');
});

test('1·2 임무 도입·마무리 배경: story.introBg·outroBg = 1600×900 webp, 400KB 이하', () => {
  for (const [m, path] of [[m1, 'assets/story/m1-lostfound.webp'], [m2, 'assets/story/m2-sorting.webp']]) {
    assert.equal(m.story.introBg, path, m.id + ' introBg');
    // 1 임무 마무리에는 배경 없음(걱정하는 장면이라 해결된 뒤 대사와 반대 — 2026-11-11), 2 임무는 같은 그림
    assert.equal(m.story.outroBg, m.id === 'm1' ? 'assets/story/m1-lostfound-solved.webp' : path, m.id + ' outroBg'); // 1 임무 마무리 = 해결된 장면(같은 규격)
    if (m.id === 'm1') { const o = fs.readFileSync(new URL('../' + m.story.outroBg, import.meta.url)); assert.ok(o.length <= 400 * 1024 && o.length > 20000, 'solved scene size ' + o.length); }
    assert.ok(fs.existsSync(file(path)), path);
    const w = webpInfo(path);
    assert.deepEqual([w.width, w.height], [1600, 900], path + ' = reveal-senior.webp와 같은 규격');
    assert.ok(w.bytes <= 400 * 1024, path + ' ' + w.bytes + ' bytes');
    assert.ok(m.story.intro.length && m.story.outro.length);
  }
  const ref = webpInfo('assets/story/reveal-senior.webp');
  assert.deepEqual([ref.width, ref.height], [1600, 900]);
});

test('도입 배경은 1·2 임무만 · 3·4 임무·연습의 마무리 배경은 이미 있는 그림(새 그림 없음) · 옛 침수는 없음', () => {
  for (const m of [m3, m4, tut, flood]) assert.equal(m.story.introBg, undefined, m.id + ' introBg'); // 3·4 임무 도입에 정체 공개·결판 그림을 깔면 미리 알려 주게 된다
  // 플레이테스트 2026-11-12: 빈 대화 화면을 이미 있는 장면 그림으로 채운다
  assert.equal(m3.story.outroBg, m3.story.reveal.bg);
  assert.equal(m4.story.outroBg, m4.story.after.bg);
  assert.equal(tut.story.outroBg, 'assets/story/opening/04-exam-{hero}.webp');
  for (const h of ['onyu', 'daon']) assert.ok(fs.existsSync(file(tut.story.outroBg.replace('{hero}', h))), h);
  assert.equal(flood.story.outroBg, undefined);
  assert.equal(m3.story.reveal.bg, 'assets/story/reveal-senior.webp');
  assert.equal(m4.story.after.bg, 'assets/story/senior-after.webp');
  // 1·2 임무 줄에 따로 단 bg는 없다(있으면 그 줄은 기본 배경 대신 그 그림)
  for (const m of [m1, m2]) for (const l of m.story.intro.concat(m.story.outro)) assert.equal(l.bg, undefined, m.id + ' ' + l.text);
  // app.js가 배열 단위 기본 배경을 줄마다 붙인다 — 줄의 bg가 우선(Object.assign 순서)
  const app = text('js/app.js');
  assert.match(app, /Object\.assign\(\{ bg: bg \}, l\)/);
  assert.match(app, /withBg\(m\.story\.intro, m\.story\.introBg\)/);
  // 마무리: 통과하지 못한 판은 outroFailBg(있을 때) — 1 임무의 '해결된 장면'이 실패한 판에 깔리지 않게
  assert.match(app, /var obg = rec\.passed === false && m\.story\.outroFailBg \? m\.story\.outroFailBg : m\.story\.outroBg;/);
  assert.match(app, /withBg\(m\.story\.outro, obg\)/);
  // 마지막 대화(선배 줄)·4 임무 재연결 뒤 줄·연습 합격 대화에도 그림, 임무 완료 화면은 같은 그림을 어둡게(opts.bg)
  assert.match(app, /revealLines\(m\)\.concat\(withBg\(m\.story\.senior, obg\)\)/);
  assert.match(app, /withBg\(lines\.concat\(af\.lines\), af\.bg\)/);
  assert.match(app, /withBg\(lines, tbg\)/);
  assert.match(app, /bg: obg \|\| null/);
  assert.match(text('css/style.css'), /\.outro-bg \{[^}]*filter: brightness\(\.35\)/);
  assert.equal(require('../missions/m1.js').story.outroFailBg, 'assets/story/m1-lostfound.webp');
});

test('받은 원본(assets/_incoming/)은 게임이 읽지 않고 저장소에도 안 올라간다', () => {
  assert.match(text('.gitignore'), /^assets\/_incoming\/$/m);
  const dirs = { js: /\.js$/, missions: /\.js$/, css: /\.css$/ };
  const files = ['index.html'];
  for (const d of Object.keys(dirs)) for (const f of fs.readdirSync(file(d))) if (dirs[d].test(f)) files.push(d + '/' + f);
  for (const f of files) assert.ok(!text(f).includes('_incoming'), f);
});

test('정사각형 카드 그림(2026-11-12): 연습 브리핑 장면 카드 · 2 임무 비상 정지 창 — 512×512 webp, 임무 데이터 연결, Canvas 대체', () => {
  assert.equal(tut.scenes[0].art.img, 'assets/story/practice-shelter.webp');
  assert.equal(m2.story.emergencyArt, 'assets/story/m2-emergency-stop.webp');
  assert.ok(m2.story.emergencyAlt && m2.story.emergencyAlt.length > 5);
  for (const p of [tut.scenes[0].art.img, m2.story.emergencyArt]) {
    const w = webpInfo(p);
    assert.deepEqual([w.width, w.height], [512, 512], p);
    assert.ok(w.bytes <= 120 * 1024 && w.bytes > 10000, p + ' ' + w.bytes + ' bytes');
  }
  // 그림 파일은 <img>로 바로(캔버스에 안 그림), 못 읽으면 Canvas 그림으로
  assert.match(text('js/ui-story.js'), /var file = s\.art && s\.art\.img/);
  assert.match(text('js/ui-story.js'), /img\.onerror = function \(\) \{ img\.onerror = null; img\.src = canvasUrl\(\); \}/);
  assert.match(text('js/ui-conveyor.js'), /mission\.story\.emergencyArt \|\| A\.scene\(mission, it\.scene, 'danger', 320\)\.toDataURL\(\)/);
});
