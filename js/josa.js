/*
 * 조사 공용 함수(플레이테스트 9) — 이/가 · 을/를 · 은/는 · 과/와 · 으로/로를 앞말의 끝소리에 맞춘다.
 *   한글: 받침 유무(으로/로는 ㄹ 받침도 '로').
 *   숫자: 읽는 소리로 — 0 영·1 일·3 삼·6 육·7 칠·8 팔 = 받침, 2 이·4 사·5 오·9 구 = 없음(1·7·8은 ㄹ이라 '로').
 *   영문: 글자 이름으로 — L 엘·M 엠·N 엔·R 알 = 받침(L·R은 ㄹ이라 '로'), 그 밖은 없음.
 *   끝의 따옴표·괄호·마침표·빈칸은 건너뛰고 그 앞 글자로 본다.
 * fill(틀, 값): '{what:이}'처럼 이름 뒤에 조사를 붙여 채운다. 값이 배열이면 "A와 B" / "A, B, C"로 잇는다.
 * 클래식 스크립트(전역 DR.Josa) + node require 둘 다(file:// 더블클릭에서도 열리게).
 */
(function (root) {
  'use strict';

  var PAIRS = [['이', '가'], ['을', '를'], ['은', '는'], ['과', '와'], ['으로', '로']];
  var SKIP = /[\s'"‘’“”)\]}>.,!?…·]/;

  // 끝소리: null(모름) / { batchim: 받침 있음, rieul: ㄹ 받침 }
  function ending(word) {
    var s = String(word == null ? '' : word), i = s.length - 1;
    while (i >= 0 && SKIP.test(s.charAt(i))) i--;
    if (i < 0) return null;
    var ch = s.charAt(i), code = s.charCodeAt(i) - 0xAC00;
    if (code >= 0 && code <= 11171) { var jong = code % 28; return { batchim: jong !== 0, rieul: jong === 8 }; }
    if (/[0-9]/.test(ch)) {
      // 10·100처럼 0으로 끝나면 '십·백'… — 0 하나는 '영'(받침), 그 밖 끝의 0도 받침(십·백·천은 모두 받침)
      return { batchim: '013678'.indexOf(ch) >= 0, rieul: '178'.indexOf(ch) >= 0 };
    }
    if (/[A-Za-z]/.test(ch)) { var u = ch.toUpperCase(); return { batchim: 'LMNR'.indexOf(u) >= 0, rieul: 'LR'.indexOf(u) >= 0 }; }
    return null;
  }

  function pairOf(p) { for (var i = 0; i < PAIRS.length; i++) if (PAIRS[i].indexOf(p) >= 0) return PAIRS[i]; return null; }

  // 조사만 고른다(p = 짝의 어느 쪽이든)
  function particle(word, p) {
    var pair = pairOf(p);
    if (!pair) return p;
    var e = ending(word);
    if (!e) return pair[1];
    if (pair[0] === '으로') return e.batchim && !e.rieul ? '으로' : '로';
    return e.batchim ? pair[0] : pair[1];
  }
  function attach(word, p) { return String(word) + particle(word, p); }
  // 예전 judge.js 모양: 받침 있으면 a, 없으면 b
  function josa(word, a, b) { var e = ending(word); return e && e.batchim ? a : b; }
  function ro(word) { return particle(word, '으로'); }

  // 이름 여러 개 잇기: 둘 = "A와 B"(앞말 받침에 따라 과/와), 셋 이상 = "A, B, C"
  function join(names) {
    var list = [].concat(names).filter(function (n) { return n !== undefined && n !== null && n !== ''; });
    if (list.length === 2) return attach(list[0], '와') + ' ' + list[1];
    return list.join(', ');
  }
  function fill(tpl, vals) {
    vals = vals || {};
    return String(tpl).replace(/\{(\w+)(?::([^}]+))?\}/g, function (m, key, p) {
      var v = vals[key];
      if (v === undefined || v === null || (Array.isArray(v) && !v.length)) return '';
      var word = Array.isArray(v) ? join(v) : String(v);
      return p ? attach(word, p) : word;
    });
  }

  var api = { particle: particle, attach: attach, josa: josa, ro: ro, join: join, fill: fill };
  root.DR = root.DR || {};
  root.DR.Josa = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
