/*
 * 첫 시험 — 러너 자격시험 실기: 보호소 입양 안내 AI(docs/specs/2026-11-05-opening-tutorial-draft.md §4).
 * 먼저 조작, 그다음 의심: 코스 중반 뒤에 사진과 이름표가 다른 카드 2장. 달리는 동안 안내하지 않고(fakeHint false), 검수·시연에서 확인한다.
 * 판정은 DR.Judge.exam(사진 기준 개·고양이 각 5장 + 이름표 일치).
 */
(function (root) {
  'use strict';

  var tutorial = {
    id: 'tutorial', title: '러너 자격 시험', cityLine: '데이터 러너가 처음 길을 냈다', bag: 10, runSeconds: 45, seed: 7, fires: 2, glitchRate: 0, fireFrom: 0.55, world: 'bridge',
    labelOptions: [],
    runGoal: [{ key: 'dog', name: '개' }, { key: 'cat', name: '고양이' }], // 달리는 동안 HUD·시작 전 안내에 보이는 목표(장 수는 조합 need)
    wallHint: '분홍 노이즈에 부딪히면 카드가 1장 떨어져',
    fakeHint: false, fakeFrom: 0.5,
    cardTypes: {
      dog: { icons: ['dog'], art: { animal: 'dog' } },
      cat: { icons: ['cat'], art: { animal: 'cat' } }
    },
    ambiguous: [],
    // 사진과 이름표가 다른 카드 — 개 8장·고양이 8장 중 각 1장(코스 카드 수는 그대로)
    fakes: [
      { id: 'f_dog_as_cat', name: '개', label: 'cat', truth: 'dog', count: 1, art: { animal: 'dog' } },
      { id: 'f_cat_as_dog', name: '고양이', label: 'dog', truth: 'cat', count: 1, art: { animal: 'cat' } }
    ],
    counts: { dog: 7, cat: 7 },
    scenes: [
      // art.img = 브리핑 장면 카드에 쓰는 그림 파일(2026-11-12, 512² — tools/story-art.mjs --cards-only). 못 읽으면 예전 Canvas 그림(개 + 고양이)
      { id: 'T1', title: '보호소 입양 안내', art: { place: 'shelter', time: 'day', img: 'assets/story/practice-shelter.webp' },
        combos: [
          { id: 'T1_dog', keys: ['dog'], need: 5, danger: false, what: '개 사진' },
          { id: 'T1_cat', keys: ['cat'], need: 5, danger: false, what: '고양이 사진' }
        ],
        passLine: '개는 개로, 고양이는 고양이로. 입양 안내가 다시 돌아간다.',
        cuts: { danger: '', inconvenience: '' } }
    ],
    story: {
      guideBrief: '보호소 AI가 개와 고양이를 구별하도록 사진을 준비하자.',
      inspectHint: '사진 속 동물과 이름표가 같은지 봐.',
      wrongLine: '이 사진은 {truth}인데, {given}라고 가르쳤네. 이름표를 다시 확인해 볼까?',
      goodLine: '사진과 이름표가 잘 맞아.',
      fixedLine: '이름표를 고치니 AI가 배우는 말도 바뀌었어.',
      emptyLine: '가방이 비었어. AI는 네가 준 것 이상은 몰라. 다시 수집해 봐.',
      simNote: '단순화된 시뮬레이션입니다. 실제 AI가 늘 이렇게 틀리지는 않습니다.', // 짧게(플레이테스트 12)
      // 합격 대화 뒤 그림 = 오프닝의 시험장 장면(출발선의 주인공과 시험관 — {hero} = 고른 주인공, app.js tutorialPass). 새 그림 없이(플레이테스트 2026-11-12)
      outroBg: 'assets/story/opening/04-exam-{hero}.webp',
      outro: [
        { who: 'examiner', text: '개 {dog}장, 고양이 {cat}장. 사진과 이름표도 확인했네.', face: 'happy' },
        { who: 'examiner', text: '합격. 현장에선 무엇이 얼마나 필요한지도 네가 판단해야 해.', face: 'explain' },
        { who: 'runner', text: '좋아. 이번엔 진짜 도시로!', face: 'happy' }
      ]
    }
  };

  root.DR = root.DR || {};
  root.DR.Missions = root.DR.Missions || {};
  root.DR.Missions.tutorial = tutorial;
  if (typeof module !== 'undefined' && module.exports) module.exports = tutorial;
})(typeof window !== 'undefined' ? window : globalThis);
