// 카드 사진(webp)을 data URL로 담은 assets/cards/photos-embedded.js를 만든다 — 빌드가 아니라 사진을 바꿨을 때만 한 번 돌리는 도구.
//   왜: index.html을 더블클릭(file://)으로 열면 파일에서 읽은 사진은 캔버스를 오염시켜 그림을 내보내지도 3D 카드에 올리지도 못한다.
//       그때만 게임(js/cardart.js loadEmbedded)이 이 파일을 읽어 같은 사진을 data URL로 쓴다. 배포 주소(http)에서는 읽지 않는다.
//   실행: node assets/cards/embed-photos.mjs   (data 폴더에서)
//   지킴: tests/photos-embedded.test.mjs — 네 폴더의 webp와 담은 내용이 한 바이트도 다르지 않아야 통과.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DIRS = ['animals', 'lost-found', 'recycle', 'city'];
export const OUT = path.join(here, 'photos-embedded.js');

// 사진 id(파일 이름에서 .webp를 뺀 것 — js/cardart.js의 photoImgs 열쇠) → 파일 경로
export function photoFiles() {
  const out = {};
  for (const d of DIRS) {
    for (const f of fs.readdirSync(path.join(here, d)).filter((n) => n.endsWith('.webp')).sort()) {
      const id = f.slice(0, -5);
      if (out[id]) throw new Error('사진 id가 겹침: ' + id);
      out[id] = path.join(here, d, f);
    }
  }
  return out;
}

export function build() {
  const files = photoFiles();
  const rows = Object.keys(files).map((id) => '    ' + JSON.stringify(id) + ': "data:image/webp;base64,' + fs.readFileSync(files[id]).toString('base64') + '"');
  return '/* 자동으로 만든 파일 — 손으로 고치지 말 것. 다시 만들기: node assets/cards/embed-photos.mjs\n' +
    ' * 카드 사진(assets/cards/{' + DIRS.join(',') + '}/*.webp)을 data URL로 담았다. 더블클릭(file://)으로 열었을 때만 js/cardart.js가 읽는다. */\n' +
    '(function (root) {\n  var data = {\n' + rows.join(',\n') + '\n  };\n' +
    '  root.DR = root.DR || {};\n  root.DR.PhotoData = data;\n' +
    "  if (typeof module !== 'undefined' && module.exports) module.exports = data;\n" +
    "})(typeof window !== 'undefined' ? window : globalThis);\n";
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = build();
  fs.writeFileSync(OUT, text);
  console.log('wrote', path.relative(process.cwd(), OUT), Object.keys(photoFiles()).length + ' photos', Math.round(text.length / 1024) + 'KB');
}
