/*
 * xorshift32 난수 — 같은 seed면 같은 수열(공공성 편 rng.js와 같은 방식). 0은 1로 바꾼다.
 */
(function (root) {
  'use strict';

  function create(seed) {
    var x = (Number(seed) >>> 0) || 1;
    return {
      next: function () {
        x ^= x << 13; x >>>= 0;
        x ^= x >>> 17;
        x ^= x << 5; x >>>= 0;
        return x / 4294967296;
      }
    };
  }

  var api = { create: create };
  root.DR = root.DR || {};
  root.DR.Rng = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
