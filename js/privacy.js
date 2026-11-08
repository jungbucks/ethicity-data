/*
 * 목적 밖 개인정보 카드(설계 docs/specs/2026-11-08-data-purpose-design.md ①) — 순수 모듈, node로 단위 테스트.
 * 개인정보 카드 = 그 임무의 흔한 종류 카드 하나에 privateId를 붙인 것. 진짜 종류(key)는 그대로라서
 *   가린 카드는 그 종류의 정상 카드로 센다(판정·개수는 손대지 않음). 처리 방법(fix): 'mask' 가리기 / 'remove' 빼기.
 * 임무 데이터: mission.privacy = { on, cards: [{ id, key, fix, at, art, mask: [{ x, y, w, h, look }] }] }
 *   on = false면 아무 카드도 표시하지 않는다(1·2 임무는 카드가 모두 사진이라, 사진이 오기 전엔 꺼 둔다 — 그림 방식 차이가 단서가 되지 않게).
 * 코스 표시(mark): 코스를 다 만든 뒤 난수 없이 고른다 → 카드 자리·uid·벽은 그대로, privateId 필드만 늘어난다. 첫 판 코스에만.
 * 제출(check): 처리하지 않은 카드가 있으면 'unhandled'(어느 카드인지 말하지 않음), 빼야 하는 카드를 가렸으면 'mustRemove'.
 * ⚠️ 문장(TEXT)은 교사 검수 전 초안.
 */
(function (root) {
  'use strict';

  var FROM = 0.15; // 코스 앞 15%에는 두지 않는다(가짜 카드와 같은 기준 — 잡기를 익힌 뒤)

  var TEXT = {
    blockUnhandled: '잠깐, 개인정보가 담긴 사진이 학습 자료에 들어가려 해.',
    blockUnhandled2: '이대로는 승인 못 해. 검수에서 다시 살펴봐.',
    blockMustRemove: '얼굴을 가려도 이 사진은 누가 버렸는지 남기는 기록이야.',
    blockMustRemove2: '이 사진은 가리는 걸로 안 돼. 빼야 해.',
    noPrivate: '이 사진엔 가릴 개인정보가 없어.',
    wasted: '가렸으면 살려 쓸 수 있었어.',
    inspectNote: '개인정보가 보이는 사진은 크게 보기에서 가리거나 뺀다.',
    maskButton: '가리기',
    unmaskButton: '가린 것 되돌리기',
    maskedTag: '가림'
  };

  function on(mission) { return !!(mission && mission.privacy && mission.privacy.on && mission.privacy.cards && mission.privacy.cards.length); }
  function defs(mission) { return on(mission) ? mission.privacy.cards : []; }
  function def(mission, id) {
    var list = (mission && mission.privacy && mission.privacy.cards) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // 코스(Stream.build 결과, z 순 정렬)에 개인정보 카드를 표시한다 — 그 종류 카드 중 앞 15% 밖, at 비율 자리
  function mark(mission, course) {
    defs(mission).forEach(function (d) {
      var cands = course.items.filter(function (it) { return it.kind === 'card' && it.key === d.key && !it.privateId && it.z >= course.length * FROM; });
      if (!cands.length) return;
      var at = d.at === undefined ? 0.5 : d.at;
      cands[Math.min(cands.length - 1, Math.floor(cands.length * at))].privateId = d.id;
    });
    return course;
  }

  function canMask(mission, card) { return !!(card && card.privateId && def(mission, card.privateId)); }
  // 가리기 누름: 개인정보 카드면 가림/되돌림을 바꾸고 지금 가렸는지 돌려준다. 아니면 false(아무것도 안 바뀜)
  function toggleMask(mission, card) {
    if (!canMask(mission, card)) return false;
    if (card.masked) { delete card.masked; return false; }
    card.masked = true;
    return true;
  }

  function check(mission, bag) {
    if (!on(mission)) return { ok: true, reason: null };
    var must = false, open = false;
    (bag || []).forEach(function (c) {
      var d = c.privateId ? def(mission, c.privateId) : null;
      if (!d) return;
      if (d.fix === 'remove') { if (c.masked) must = true; else open = true; }
      else if (!c.masked) open = true;
    });
    if (must) return { ok: false, reason: 'mustRemove' };
    if (open) return { ok: false, reason: 'unhandled' };
    return { ok: true, reason: null };
  }

  // 첫 달리기 뒤 가방에 든 '가리기' 카드 id — 나중에 빠졌으면 "가렸으면 살려 쓸 수 있었어"
  function caught(mission, bag) {
    return (bag || []).filter(function (c) { var d = c.privateId && def(mission, c.privateId); return d && d.fix === 'mask'; })
      .map(function (c) { return c.id; });
  }
  function wasted(mission, caughtIds, bag) {
    var ids = {};
    (bag || []).forEach(function (c) { ids[c.id] = true; });
    return (caughtIds || []).filter(function (id) { return !ids[id]; }).length;
  }

  var api = { TEXT: TEXT, on: on, defs: defs, def: def, mark: mark, canMask: canMask, toggleMask: toggleMask, check: check, caught: caught, wasted: wasted };
  root.DR = root.DR || {};
  root.DR.Privacy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
