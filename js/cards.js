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

  // 고치기 전 이름표(2 임무 이름표 고치기에서 '원래대로'를 알아보는 데 쓴다)
  function originalLabel(mission, card) {
    if (card.ambiguousId) return null;
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

  // 피해: 가짜에 harm이 적혀 있으면 그것(3 임무 철거 전 육교), 아니면 진짜 종류가 위험물이면 위험
  function harm(mission, card) {
    if (card.fakeId) { var fd = fakeDef(mission, card.fakeId); if (fd && fd.harm) return fd.harm; }
    var t = truthKey(mission, card);
    return t && mission.cardTypes[t] && mission.cardTypes[t].hazard ? 'danger' : 'inconvenience';
  }

  // 가짜는 그 가짜 문구로. 단, 2 임무에서 다른 틀린 이름표로 바꿨으면 지금 붙은 이름표로 말한다(mis:가짜id:이름표)
  function sourceId(mission, card) {
    if (card.fakeId) {
      var f = fakeDef(mission, card.fakeId);
      return card.label && f && card.label !== f.label ? 'mis:' + card.fakeId + ':' + card.label : card.fakeId;
    }
    return 'mis:' + card.key + ':' + currentLabel(mission, card);
  }

  function scenesForLabel(mission, label) {
    return mission.scenes.filter(function (s) {
      return s.combos.some(function (c) {
        return c.keys.some(function (k) { return labelOfKey(mission, k) === label; });
      });
    }).map(function (s) { return s.id; });
  }

  // 가짜가 쌓이는 장면: 붙은 이름표가 원래 그대로이고 데이터에 scenes가 있으면 그것(4 임무 — '7'·'8'은 어느 종류의 이름표도 아니라서),
  // 아니면 지금 붙은 이름표를 쓰는 장면(플레이어가 바꾼 이름표 포함)
  function fakeScenes(mission, card) {
    var f = card.fakeId ? fakeDef(mission, card.fakeId) : null;
    if (f && f.scenes && currentLabel(mission, card) === f.label) return f.scenes.slice();
    return scenesForLabel(mission, currentLabel(mission, card));
  }

  function iconsOf(mission, card) {
    if (card.ambiguousId) {
      var q = ambDef(mission, card.ambiguousId);
      // 4 임무 "?" 카드는 아이콘이 [?] 하나 — 붙이면 그 번호 하나
      if (q.icons.length === 1) return card.assigned ? [card.assigned] : q.icons;
      return card.assigned ? [q.icons[0], card.assigned] : q.icons;
    }
    var label = currentLabel(mission, card);
    if (mission.labels) return [label];
    return (mission.cardTypes[label] && mission.cardTypes[label].icons) || [];
  }

  // 촬영 날짜(3 임무): 카드 종류·가짜의 dates에서 변형 번호로 하나. 없으면 null
  function dateOf(mission, card, variant) {
    var def = card.key ? mission.cardTypes[card.key] : (card.fakeId ? fakeDef(mission, card.fakeId) : null);
    return def && def.dates ? def.dates[(variant || 0) % def.dates.length] : null;
  }

  function artId(card) { return card.key || card.ambiguousId || card.fakeId; }

  function labelText(mission, label) {
    var opts = (mission.labels || []).concat(mission.labelOptions || []).concat(mission.labelExtra || []);
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
    if (mission.labels && t.name) return t.name; // 2 임무: 종류 이름(음료 캔·통조림 캔 …), 아이콘이 이름표를 보여 준다
    var parts = t.icons.map(function (ic) { return TIME_TEXT[ic] || iconText(mission, ic); });
    if (t.variantText) parts.push(t.variantText);
    return parts.join(' · ');
  }

  function cardLabel(mission, card) {
    if (card.ambiguousId) {
      var q = ambDef(mission, card.ambiguousId), time = TIME_TEXT[q.icons[0]] || '', pre = time ? time + ' · ' : '';
      if (card.assigned === undefined) return pre + '?';
      if (card.assigned === null) return pre + '? (넣지 않기)';
      return pre + labelText(mission, card.assigned);
    }
    return keyLabel(mission, currentLabel(mission, card));
  }

  // 화면에 세는 종류: 보통·가짜 카드는 붙은 설명표, "?" 카드는 붙인 설명표의 보통(드물지 않은) 종류. 미결정·넣지 않기는 null
  // 2 임무(labels): 이름표가 맞는 카드는 그 종류, 틀린 카드는 붙은 이름표의 보통 종류("?" 카드와 같은 규칙)
  function commonKeyOfLabel(mission, label) {
    var keys = Object.keys(mission.cardTypes), any = null;
    for (var i = 0; i < keys.length; i++) {
      if (labelOfKey(mission, keys[i]) !== label) continue;
      if (!mission.cardTypes[keys[i]].rare) return keys[i];
      if (!any) any = keys[i];
    }
    return any;
  }
  // displayAs: 화면에서 다른 종류와 한 줄로 센다(3 임무 시장 골목 옛 사진 — 옛 사진이라고 따로 보이지 않게)
  function shownAs(mission, k) { var t = k && mission.cardTypes[k]; return t && t.displayAs ? t.displayAs : k; }
  function displayKey(mission, card) {
    if (!card.ambiguousId && mission.labels) {
      if (!isMislabeled(mission, card)) return shownAs(mission, truthKey(mission, card));
      // 어느 종류의 이름표도 아닌 번호(4 임무 7·8)는 그 이름표 자체로 센다(보충 준비 '1장 빼기'에도 나오게, 정체는 드러내지 않음)
      return shownAs(mission, commonKeyOfLabel(mission, currentLabel(mission, card))) || currentLabel(mission, card);
    }
    if (!card.ambiguousId) return currentLabel(mission, card);
    if (!card.assigned) return null;
    if (mission.labels) return shownAs(mission, commonKeyOfLabel(mission, card.assigned)); // 4 임무: 붙인 번호의 보통 종류(맞았는지 드러내지 않음)
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

  var labelColors = { flood_deep: '#527de0', flood_shallow: '#25bdb0', wet: '#d8af32', dry: '#9dc77b', unknown: '#b49ae3',
    // 2 임무 분류함(컨베이어 함 색과 같음)
    can: '#d9534f', pet: '#3a8fd9', pack: '#25bdb0', paper: '#c9a227', vinyl: '#d977a8', battery: '#2fae6b', trash: '#7d8290',
    // 3 임무 장소
    station: '#d9a066', market: '#e86a5a', river: '#4fb3ff', crossing: '#b0b6c3',
    // 4 임무 선택지 번호(7·8도 보통 번호와 같은 결 — 색으로 정체를 드러내지 않는다)
    '1': '#ffd24a', '2': '#7be0a0', '3': '#8fa8ff', '4': '#ff9f5a', '5': '#e58bff', '7': '#f2c14e', '8': '#9fb4ff' };
  function runColor(mission, card) {
    var icons = card.ambiguousId ? ['unknown'] : iconsOf(mission, card);
    return labelColors[icons[icons.length - 1]] || '#8ab5ce';
  }
  var api = { labelColors: labelColors, runColor: runColor,
    fakeDef: fakeDef, labelOfKey: labelOfKey, originalLabel: originalLabel, currentLabel: currentLabel, truthKey: truthKey,
    isMislabeled: isMislabeled, harm: harm, sourceId: sourceId, scenesForLabel: scenesForLabel, fakeScenes: fakeScenes,
    iconsOf: iconsOf, artId: artId, dateOf: dateOf, labelText: labelText,
    keyLabel: keyLabel, cardLabel: cardLabel, displayKey: displayKey, labelCounts: labelCounts
  };
  root.DR = root.DR || {};
  root.DR.Cards = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
