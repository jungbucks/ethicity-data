// 브라우저 테스트 전부를 차례로 실행해 이름별 PASS/FAIL과 마지막 오류 줄을 보여준다. 하나라도 실패하면 exit 1.
// 실행: PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright node data/tests/run-all.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('-browser.mjs')).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', env: process.env });
  const out = (r.stdout + r.stderr).trim().split('\n');
  if (r.status === 0) console.log('PASS', f);
  else { failed++; console.log('FAIL', f, '—', out.filter((l) => /Error|rror:/.test(l)).pop() || out.pop()); }
}
console.log(`${files.length - failed}/${files.length} passed`);
process.exit(failed ? 1 : 0);
