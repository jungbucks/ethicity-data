// 필요한 카드가 코스에 실제로 '잡을 수 있게' 나오는가(사용자 2026-11-02 "비 오는 날 학교 앞 카드가 안 나와 클리어할 수 없어" 조사에서 추가).
// 같은 줄(z)의 카드는 한 번에 하나만 잡을 수 있다 → 장면마다 조합의 필요 장수를 서로 다른 줄로 채울 수 있어야 한다.
// 모든 임무 × 여러 seed(첫 판), 그리고 조합마다 모자란 장수로 만든 보충 코스. 필요 합계는 가방 칸 안.
// (그 버그의 원인은 이게 아니라 그림이었다 — 비 오는 학교 앞이 맑은 날 사진과 거의 같았음. 그쪽은 cardart-browser가 지킨다.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cfg = require('../js/config.js');
require('../js/rng.js');
const { build } = require('../js/stream.js');
const missions = { tutorial: require('../missions/tutorial.js'), m1: require('../missions/m1.js'), m2: require('../missions/m2.js'), m3: require('../missions/m3.js'), m4: require('../missions/m4.js') };
const SEEDS = [1, 2, 3, 7, 8, 42, 99, 999, 1101, 1102, 2201, 2202, 3301, 3302, 3303, 3317, 4401];

// 줄 하나 = 카드 하나. 조합의 필요 장수만큼 '칸'을 만들고, 그 조합 종류의 카드가 있는 줄과 짝짓는다(이분 매칭 — 한 줄은 한 칸만).
// '?' 카드(분류하면 2장 몫)는 세지 않는다(보수적으로) — 경계 조합도 일반 드문 카드로 채워져야 한다(CLAUDE.md 결정).
// 조합별 [짝지은 수, 필요]
function plan(m, course, combos) {
  const rows = [...new Set(course.items.filter((it) => it.kind === 'card').map((it) => it.z))];
  const keysAt = rows.map((z) => course.items.filter((it) => it.kind === 'card' && it.z === z && it.key && !it.fakeId).map((it) => it.key));
  // 같은 종류(keys)를 쓰는 조합은 한 카드가 여러 장면에 함께 센다(DR.Judge) → 같은 종류 묶음은 큰 need만큼만 칸을 만든다(4 임무 표 안 답 S3·S4)
  const sig = (cb) => cb.keys.slice().sort().join(',');
  const groups = {};
  combos.forEach((cb) => { const g = groups[sig(cb)]; if (!g || g.need < cb.need) groups[sig(cb)] = cb; });
  const slots = Object.values(groups).flatMap((cb) => Array.from({ length: cb.need }, () => cb));
  const owner = new Array(rows.length).fill(-1);
  const tryAssign = (si, seen) => {
    for (let r = 0; r < rows.length; r++) {
      if (seen[r] || !keysAt[r].some((k) => slots[si].keys.includes(k))) continue;
      seen[r] = true;
      if (owner[r] < 0 || tryAssign(owner[r], seen)) { owner[r] = si; return true; }
    }
    return false;
  };
  const got = slots.map((_, si) => tryAssign(si, new Array(rows.length).fill(false)));
  const out = {};
  for (const cb of combos) out[cb.id] = [slots.filter((s, i) => sig(s) === sig(cb) && got[i]).length, cb.need];
  return out;
}

for (const [id, m] of Object.entries(missions)) {
  const combos = m.scenes.flatMap((s) => s.combos);
  test(id + ': every scene can be passed from one run (needed cards on distinct rows, within the bag)', () => {
    const need = {};
    combos.forEach((c) => { const k = c.keys.slice().sort().join(','); need[k] = Math.max(need[k] || 0, c.need); });
    assert.ok(Object.values(need).reduce((n, x) => n + x, 0) <= m.bag, 'needs fit in the bag');
    for (const seed of SEEDS) {
      const p = plan(m, build(m, cfg, { seed }), combos);
      for (const [cid, [got, need]] of Object.entries(p)) assert.ok(got >= need, `${id} seed ${seed} ${cid}: ${got}/${need}`);
    }
  });
  if (id === 'tutorial') continue;
  test(id + ': a supplement run brings every missing combo back within reach', () => {
    for (const cb of combos) for (let lack = 1; lack <= cb.need; lack++) for (const seed of SEEDS) {
      const course = build(m, cfg, { seed, focusCounts: { [cb.keys[0]]: lack } });
      const [got] = plan(m, course, [{ ...cb, need: lack }])[cb.id];
      assert.ok(got >= lack, `${id} supplement seed ${seed} ${cb.keys[0]} x${lack}: ${got}`);
    }
  });
}
