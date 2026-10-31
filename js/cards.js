/*
 * 카드의 진짜 종류·붙은 이름표(spec §3.2) — 판정·코스·달리기·검수가 모두 이것을 쓴다.
 * - 보통 카드 {key}: 진짜 = key, 이름표 = cardTypes[key].label(2 임무) 또는 key 자체(1 임무).
 * - 가짜 카드 {fakeId}: 진짜 = fake.truth(없을 수 있음), 이름표 = fake.label.
 * - 2 임무에서 고친 카드는 card.label이 이름표를 덮는다.
 * - "?" 카드 {ambiguousId}: 이 모듈의 이름표 규칙 밖(첫 버전 규칙 그대로) — currentLabel·truthKey는 null.
 */
(function (root) {
  'use strict';

  function fakeDef(mission, id) {
    var list = mission.fakes || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function ambDef(mission, id) {
    var list = mission.ambiguous || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function labelOfKey(mission, key) {
    var t = mission.cardTypes[key];
    return (t && t.label) || key;
  }

  function currentLabel(mission, card) {
    if (card.ambiguousId) return null;
    if (card.label) return card.label;
    if (card.key) return labelOfKey(mission, card.key);
    var f = fakeDef(mission, card.fakeId);
    return f ? f.label : null;
  }

  function truthKey(mission, card) {
    if (card.key) return card.key;
    if (card.fakeId) { var f = fakeDef(mission, card.fakeId); return (f && f.truth) || null; }
    return null;
  }

  function isMislabeled(mission, card) {
    if (card.ambiguousId) return false;
    var t = truthKey(mission, card);
    return t === null || labelOfKey(mission, t) !== currentLabel(mission, card);
  }

  function harm(mission, card) {
    var t = truthKey(mission, card);
    return t && mission.cardTypes[t] && mission.cardTypes[t].hazard ? 'danger' : 'inconvenience';
  }

  function sourceId(mission, card) {
    if (card.fakeId) return card.fakeId;
    return 'mis:' + card.key + ':' + currentLabel(mission, card);
  }

  function scenesForLabel(mission, label) {
    return mission.scenes.filter(function (s) {
      return s.combos.some(function (c) {
        return c.keys.some(function (k) { return labelOfKey(mission, k) === label; });
      });
    }).map(function (s) { return s.id; });
  }

  function iconsOf(mission, card) {
    if (card.ambiguousId) {
      var q = ambDef(mission, card.ambiguousId);
      return card.assigned ? [q.icons[0], card.assigned] : q.icons;
    }
    var label = currentLabel(mission, card);
    if (mission.labels) return [label];
    return (mission.cardTypes[label] && mission.cardTypes[label].icons) || [];
  }

  function artId(card) { return card.key || card.ambiguousId || card.fakeId; }

  function labelText(mission, label) {
    var opts = (mission.labels || []).concat(mission.labelOptions || []);
    for (var i = 0; i < opts.length; i++) if (opts[i].id === label) return opts[i].text;
    var t = mission.cardTypes[label];
    return (t && t.name) || label;
  }

  /* ---------- 학생에게 보이는 라벨·개수(P2·P3) ----------
   * 언제나 "카드에 붙은 설명표" 기준이다. 가짜 카드의 정체, "?" 카드의 정답 여부는 드러내지 않는다. */
  var TIME_TEXT = { day: '낮', night: '밤' };
  var ANIMAL_TEXT = { dog: '강아지', cat: '고양이' };

  function iconText(mission, icon) {
    if (icon === 'unknown') return '?';
    return ANIMAL_TEXT[icon] || labelText(mission, icon);
  }

  // 카드 종류(key) → "밤 · 정상(젖음)" (드문 종류는 " · 네온 반사"처럼 덧말)
  function keyLabel(mission, key) {
    var t = mission.cardTypes[key];
    if (!t) return labelText(mission, key);
    var parts = t.icons.map(function (ic) { return TIME_TEXT[ic] || iconText(mission, ic); });
    if (t.variantText) parts.push(t.variantText);
    return parts.join(' · ');
  }

  function cardLabel(mission, card) {
    if (card.ambiguousId) {
      var q = ambDef(mission, card.ambiguousId), time = TIME_TEXT[q.icons[0]] || '';
      if (card.assigned === undefined) return time + ' · ?';
      if (card.assigned === null) return time + ' · ? (넣지 않기)';
      return time + ' · ' + labelText(mission, card.assigned);
    }
    return keyLabel(mission, currentLabel(mission, card));
  }

  // 화면에 세는 종류: 보통·가짜 카드는 붙은 설명표, "?" 카드는 붙인 설명표의 보통(드물지 않은) 종류. 미결정·넣지 않기는 null
  function displayKey(mission, card) {
    if (!card.ambiguousId) return currentLabel(mission, card);
    if (!card.assigned) return null;
    var q = ambDef(mission, card.ambiguousId), keys = Object.keys(mission.cardTypes);
    for (var i = 0; i < keys.length; i++) {
      var t = mission.cardTypes[keys[i]];
      if (!t.rare && t.icons[0] === q.icons[0] && t.icons[1] === card.assigned) return keys[i];
    }
    return null;
  }

  function labelCounts(mission, bag) {
    var out = {};
    bag.forEach(function (card) { var k = displayKey(mission, card); if (k) out[k] = (out[k] || 0) + 1; });
    return out;
  }

  var labelColors = { flood_deep: '#527de0', flood_shallow: '#25bdb0', wet: '#d8af32', dry: '#9dc77b', unknown: '#b49ae3' };
  function runColor(mission, card) {
    var icons = card.ambiguousId ? ['unknown'] : iconsOf(mission, card);
    return labelColors[icons[icons.length - 1]] || '#8ab5ce';
  }
  var api = { labelColors: labelColors, runColor: runColor,
    fakeDef: fakeDef, labelOfKey: labelOfKey, currentLabel: currentLabel, truthKey: truthKey,
    isMislabeled: isMislabeled, harm: harm, sourceId: sourceId, scenesForLabel: scenesForLabel,
    iconsOf: iconsOf, artId: artId, labelText: labelText,
    keyLabel: keyLabel, cardLabel: cardLabel, displayKey: displayKey, labelCounts: labelCounts
  };
  root.DR = root.DR || {};
  root.DR.Cards = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
