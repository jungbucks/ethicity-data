/*
 * 튜토리얼 — 러너 자격 시험 실기: 보호소 입양 안내 AI(기획서 §6).
 * 조작 익히기가 목적, 데이터 교훈은 아주 가볍게.
 */
(function (root) {
  'use strict';

  var tutorial = {
    id: 'tutorial', title: '러너 자격 시험', bag: 10, runSeconds: 45, seed: 7, fires: 2, fireFrom: 0.55,
    labelOptions: [],
    cardTypes: {
      dog: { icons: ['dog'], art: { animal: 'dog' } },
      cat: { icons: ['cat'], art: { animal: 'cat' } }
    },
    ambiguous: [],
    counts: { dog: 8, cat: 8 },
    scenes: [
      { id: 'T1', title: '보호소 입양 안내', art: { place: 'shelter', time: 'day' },
        combos: [
          { id: 'T1_dog', keys: ['dog'], need: 3, danger: false, missingLine: '우리가 넣은 데이터에는 강아지 사진이 부족했다.' },
          { id: 'T1_cat', keys: ['cat'], need: 3, danger: false, missingLine: '우리가 넣은 데이터에는 고양이 사진이 부족했다.' }
        ],
        passLine: '강아지는 강아지로, 고양이는 고양이로. 입양 안내가 다시 돌아간다.',
        cuts: { danger: '', inconvenience: '' } }
    ],
    story: {
      intro: [
        { who: 'examiner', text: '러너 자격 시험, 마지막 실기다.' },
        { who: 'examiner', text: '보호소 입양 안내 AI에 넣을 사진을 데이터 세계에서 모아 와.' },
        { who: 'runner', text: '달리기라면 자신 있어요!' }
      ],
      guideBrief: '이 AI는 보호소에 온 동물이 개인지 고양이인지 구별해서 안내해야 합니다.',
      // 실패 대사는 가방 모양에 따라: 비었음 / 한쪽만(한쪽 0장·다른 쪽 1장 이상) / 둘 다 있지만 모자람
      empty: [
        { who: 'guide', text: '…모르겠습니다. 배운 게 없습니다.' },
        { who: 'examiner', text: '가방이 비었어. AI는 네가 준 것 이상은 몰라. 다시 달려 봐.' }
      ],
      fail: [
        { who: 'guide', text: '(강아지를 보며) 고양이! …고양이입니다!' },
        { who: 'examiner', text: '귀엽긴 한데. 한쪽 사진만 잔뜩 들어갔네. 다시 달려 봐.' }
      ],
      failFew: [
        { who: 'guide', text: '개…일까요? 고양이…일까요?' },
        { who: 'examiner', text: '둘 다 있긴 한데, 아직 너무 적어. 다시 달려 봐.' }
      ],
      pass: [
        { who: 'guide', text: '개입니다. 고양이입니다. 개입니다.' }
      ],
      // 합격 뒤 시험관이 가방 구성을 짚는 한 줄({dog}·{cat} = 담은 장 수)
      passCount: '개 {dog}장, 고양이 {cat}장. 운 좋게 맞췄지만 골라 담은 건 아니지?',
      outro: [
        { who: 'examiner', text: '합격. 달리기 기록은 최고. 데이터 판단은… 아직.' },
        { who: 'runner', text: '아직이라니. 그래도 오늘부터 러너다!' }
      ]
    }
  };

  root.DR = root.DR || {};
  root.DR.Missions = root.DR.Missions || {};
  root.DR.Missions.tutorial = tutorial;
  if (typeof module !== 'undefined' && module.exports) module.exports = tutorial;
})(typeof window !== 'undefined' ? window : globalThis);
