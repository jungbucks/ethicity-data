import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const m = require('../missions/legacy-flood.js'), cfg = require('../js/config.js');
require('../js/cards.js');
const Stream = require('../js/stream.js'), Judge = require('../js/judge.js');
const before = JSON.parse(fs.readFileSync(new URL('./fixtures/readability-1101.json', import.meta.url)));
for (const example of before) test('seed 1101 same selected cards, unchanged result: ' + example.name, () => {
  const course = Stream.build(m, cfg, { seed:1101 }), seen = {}, selected = {};
  const bag = course.items.filter(it => {
    if (it.kind !== 'card') return false;
    const k = it.key || it.fakeId || it.ambiguousId;
    seen[k] = (seen[k] || 0) + 1;
    return seen[k] <= (example.counts[k] || 0);
  }).map(it => {
    const k = it.key || it.fakeId || it.ambiguousId;
    selected[k] = (selected[k] || 0) + 1;
    const v = { id:k + '_' + selected[k] };
    if (it.key) v.key = it.key;
    else if (it.fakeId) v.fakeId = it.fakeId;
    else { v.ambiguousId = it.ambiguousId; v.assigned = example.assigned?.[k]; }
    return v;
  });
  // 판정 결과에 나중에 더한 필드(missingHave·lingering)는 빼고, 이 fixture가 가진 필드만 비교한다
  const got = JSON.parse(JSON.stringify(Judge.judge(m,bag,cfg)));
  got.scenes = got.scenes.map((sc, i) => Object.fromEntries(Object.keys(example.result.scenes[i]).map((k) => [k, sc[k]])));
  assert.deepEqual(got, example.result);
});
