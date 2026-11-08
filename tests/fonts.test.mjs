// 4 임무 손글씨 글꼴(설계 2026-11-08 낱말 개편): OFL 한글 손글씨 4종을 필요한 글자만 남겨 base64로 css에 넣는다(file:// 더블클릭에서도 읽힘)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const FAMILIES = { 'HW Neat': 'Poor Story', 'HW Round': 'Gamja Flower', 'HW Quick': 'East Sea Dokdo', 'HW Bold': 'Dokdo' };

test('hw-fonts.css: four woff2 faces embedded as base64, small', () => {
  const css = read('css/hw-fonts.css');
  const faces = [...css.matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'[^}]*url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/g)];
  assert.deepEqual(faces.map((f) => f[1]).sort(), Object.keys(FAMILIES).sort());
  let total = 0;
  for (const f of faces) {
    const buf = Buffer.from(f[2], 'base64');
    assert.equal(buf.subarray(0, 4).toString('latin1'), 'wOF2', f[1] + ' is woff2');
    total += buf.length;
  }
  assert.ok(total < 60000, 'subset fonts stay small: ' + total);
  assert.ok(!/url\((?!data:)/.test(css), 'no external font files');
  // 원래 글꼴 이름을 그대로 쓰지 않는다(덜어 낸 글꼴 = 수정본)
  for (const orig of Object.values(FAMILIES)) assert.ok(!new RegExp("font-family:\\s*'" + orig + "'").test(css), orig);
});

test('index.html links hw-fonts.css; license file credits all four fonts', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="stylesheet" href="css\/hw-fonts\.css">/);
  const ofl = read('assets/fonts/OFL.txt');
  assert.match(ofl, /SIL OPEN FONT LICENSE Version 1\.1/i);
  for (const orig of Object.values(FAMILIES)) assert.ok(ofl.includes(orig), orig);
  assert.match(ofl, /YoonDesign/);
  assert.match(ofl, /FONTRIX/);
  const readme = read('README.md');
  for (const orig of Object.values(FAMILIES)) assert.ok(readme.includes(orig), 'README credits ' + orig);
  assert.match(readme, /OFL/);
});
