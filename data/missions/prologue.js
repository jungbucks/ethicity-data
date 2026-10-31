/*
 * 프롤로그 — 러너 프로필 + 독백. 왜 데이터 러너가 되었는지(밝고 신나게).
 * 마지막 줄은 튜토리얼 끝 시험관 대사("데이터 판단은… 아직")의 복선.
 */
(function (root) {
  'use strict';

  var prologue = {
    profile: [
      { label: '이름', value: '나(가칭) · 고2' },
      { label: '오늘', value: '러너 자격 시험' },
      { label: '좋아하는 것', value: '데이터 세계에서 달리기, 기록 갱신' },
      { label: '아직 서툰 것', value: '뭘 가져올지 고르기' }
    ],
    lines: [
      '처음 데이터 세계에 접속한 건 중학교 체험 수업 때였다.',
      '발밑으로 빛나는 길이 끝없이 뻗어 있었고, 달릴수록 끊어졌던 도시가 하나씩 이어졌다.',
      '그날부터 꿈은 하나. 저 길을 누구보다 빨리 달리는 것!',
      '요즘 도시는 너무 빨리 바뀌어서, AI가 아는 세상과 진짜 세상이 자꾸 어긋난다.',
      '그 끊어진 틈을 달려서 잇는 사람. 그게 데이터 러너다.',
      '시민 러너 자격 시험만 붙으면 학생도 될 수 있다. 그리고 오늘이 바로 그날이다.',
      '…뭘 가져와야 하는지는, 솔직히 아직 잘 모르겠지만.'
    ]
  };

  root.DR = root.DR || {};
  root.DR.Prologue = prologue;
  if (typeof module !== 'undefined' && module.exports) module.exports = prologue;
})(typeof window !== 'undefined' ? window : globalThis);
