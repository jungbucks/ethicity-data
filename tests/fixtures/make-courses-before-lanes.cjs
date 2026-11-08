// 4 임무만 4레인(2026-11-09) 전 코스 스냅숏 — 연습·1~3 임무(+옛 침수)는 벽·불꽃·표시까지 그대로여야 한다(lanes.test).
// 다시 만들지 말 것(만든 때: 레인 수 데이터화 직전 커밋 5828537). node tests/fixtures/make-courses-before-lanes.cjs
const fs = require('fs'), path = require('path');
const cfg = require('../../js/config.js');
require('../../js/rng.js');
const Stream = require('../../js/stream.js');
const M = { tutorial: require('../../missions/tutorial.js'), m1: require('../../missions/m1.js'), flood: require('../../missions/legacy-flood.js'), m2: require('../../missions/m2.js'), m3: require('../../missions/m3.js') };
const out = {};
for (const [id, m] of Object.entries(M)) {
  for (const seed of [m.seed, 42, 999]) out[id + '_' + seed] = Stream.build(m, cfg, { seed });
  if (m.supplementSeconds) {
    out[id + '_supc'] = Stream.build(m, cfg, { seed: m.seed + 1, focusCounts: { [Object.keys(m.counts)[0]]: 2 } });
    out[id + '_supk'] = Stream.build(m, cfg, { seed: m.seed + 2, focusKeys: Object.keys(m.counts).slice(0, 2) });
  }
}
fs.writeFileSync(path.join(__dirname, 'courses-before-lanes.json'), JSON.stringify(out));
console.log(Object.keys(out).length, 'courses');
