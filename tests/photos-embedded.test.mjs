// 더블클릭(file://) 실행용으로 카드 사진을 담은 assets/cards/photos-embedded.js(리뷰 2026-11-10 ①)가 사진 파일과 같은가.
//   사진을 바꾸고 다시 만들지 않으면(node assets/cards/embed-photos.mjs) 여기서 걸린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { photoFiles, build, OUT } from '../assets/cards/embed-photos.mjs';

const require = createRequire(import.meta.url);
const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('담은 사진 = 사진 파일(한 바이트도 다르지 않음), 남거나 빠진 것 없음', () => {
  const data = require(OUT), files = photoFiles();
  assert.deepEqual(Object.keys(data).sort(), Object.keys(files).sort());
  for (const id of Object.keys(files)) {
    const m = /^data:image\/webp;base64,(.+)$/.exec(data[id]);
    assert.ok(m, id + ' is a webp data URL');
    assert.ok(Buffer.from(m[1], 'base64').equals(fs.readFileSync(files[id])), id + ' matches its file — 다시 만들기: node assets/cards/embed-photos.mjs');
  }
});

test('담은 파일은 도구가 만든 그대로(손으로 고치지 않음)', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n'), build()); // 줄 끝(CRLF)만 다른 것은 같은 것으로
});

test('게임이 쓰는 사진 id(js/cardart.js)는 모두 담겨 있다', () => {
  const src = fs.readFileSync(path.join(DATA, 'js', 'cardart.js'), 'utf8'), data = require(OUT);
  const list = (name) => {
    const m = new RegExp(name + " = \\[([^\\]]+)\\]").exec(src);
    assert.ok(m, name + ' list found in cardart.js');
    return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  };
  const animals = /var PHOTOS = \{ dog: \[([^\]]+)\], cat: \[([^\]]+)\] \}/.exec(src);
  assert.ok(animals, 'PHOTOS list found');
  const ids = (animals[1] + ',' + animals[2]).split(',').map((s) => s.trim().replace(/^'|'$/g, '')).concat(list('LOST'), list('RECYCLE'), list('CITY'));
  assert.equal(ids.length, 16 + 8 + 15 + 14);
  for (const id of ids) assert.ok(data[id], id + ' embedded');
  // 게임은 오염된 사진을 쓰지 않고(clean) 담은 파일로 바꿔 읽는다 — 그 길이 남아 있는지
  assert.match(src, /function loadEmbedded\(\)/);
  assert.match(src, /naturalWidth > 0 && clean\(im\)/);
});
