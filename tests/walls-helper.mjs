// 벽·코스 비교 도우미: 드문 카드 앞 벽(초 단위 간격, Stream.rareGapRange 안) · 스냅숏은 카드만 비교(벽은 2026-11-05 지시서로 옮겼다)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
require('../js/rng.js');
const Stream = require('../js/stream.js');

export function rareWallOf(course, it) {
  const p = it.z / course.length, sec = Stream.rareGapSec(cfg, p), v = Stream.speedAt(cfg, p), [lo, hi] = Stream.rareGapRange(cfg, sec);
  return course.items.find((w) => w.kind === 'wall' && w.lane === it.lane && it.z - w.z >= v * lo - 1e-8 && it.z - w.z <= v * hi + 1e-8);
}
// 개인정보 카드 표시(privateId, 2026-11-08)는 자리·uid를 바꾸지 않고 필드만 붙인다 → 비교에서 뺀다(privacy.test가 '표시만 늘었다'를 따로 지킴)
// "지지직" 표시(glitch, 2026-11-09)도 표시 필드라 뺀다(glitch.test가 "코스는 그대로"를 따로 지킴)
export const cardsOf = (course) => ({ length: course.length, zones: course.zones, supplement: course.supplement, cards: course.items.filter((i) => i.kind === 'card').map(({ privateId, glitch, ...it }) => it) });
