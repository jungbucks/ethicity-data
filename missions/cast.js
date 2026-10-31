/*
 * 인물 — 이름은 기획서 가칭. 초상은 색과 도형으로만 구분한다(첫 버전).
 * 안내 AI(hex)는 복구 대상 AI 표현과 겹치지 않게 한다.
 */
(function (root) {
  'use strict';

  var cast = {
    runner:     { name: '나',      color: '#FFD24A', shape: 'circle' },
    peer:       { name: '동기',    color: '#5BE3A1', shape: 'square' },
    supervisor: { name: '감독관',  color: '#8FA8FF', shape: 'diamond' },
    guide:      { name: '안내 AI', color: '#7FF9FF', shape: 'hex' },
    bot:        { name: '수거봇',  color: '#FF9F5A', shape: 'bot' },
    senior:     { name: '선배',    color: '#E58BFF', shape: 'circle' },
    examiner:   { name: '시험관',  color: '#C9C9D9', shape: 'diamond' },
    client:     { name: '도로 관리원', color: '#A8E06A', shape: 'square' }
  };

  root.DR = root.DR || {};
  root.DR.Cast = cast;
  if (typeof module !== 'undefined' && module.exports) module.exports = cast;
})(typeof window !== 'undefined' ? window : globalThis);
