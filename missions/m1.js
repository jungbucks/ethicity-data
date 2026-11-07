/*
 * 1 임무 — 분실물 센터 AI(docs/specs/2026-11-06-m1-lost-found.md). 장면·조합·카드 수·대사는 모두 여기서 고친다.
 * 배우는 것: 이름표가 전부 맞아도 자료에 빠진 모습이 있으면 AI는 그 모습을 못 알아본다.
 * 카드 이름표는 두 모습 모두 같은 종류(우산·지갑·스마트폰)다 — 달리는 동안·첫 검수에선 모습을 글로 알려 주지 않고 사진으로 본다(hideShapes).
 * 조합(모습)은 따로 판정한다: 접힌 우산만 모자라면 접힌 우산만 '분류 보류' 칸으로 간다. 물건은 보관함에 그대로 있다.
 * 가짜 카드·"?" 카드는 넣지 않는다(이번 임무의 난점은 빠진 모습 하나).
 * 카드 그림 6장은 자료 묶음을 대표하는 그림이다. 같은 그림이 반복돼도 서로 다른 실물 사진을 모았다고 설명하지 않는다.
 */
(function (root) {
  'use strict';

  var m1 = {
    id: 'm1', title: '분실물 센터 AI', next: 'm2', cityLine: '분실물 센터 AI가 다시 이어졌다', bag: 30, runSeconds: 90, supplementSeconds: 30, seed: 1101, fires: 4,
    hideShapes: true, rareLate: 0.35, relabel: false, holdBin: 'hold', binWord: '칸', scenery: 'bridge', world: 'bridge',
    briefTitle: '오늘 접수대에 들어온 물건',
    zones: [
      { id: 'S1', title: '우산', short: '우산' },
      { id: 'S2', title: '지갑', short: '지갑' },
      { id: 'S3', title: '스마트폰', short: '스마트폰' }
    ],
    labels: [
      { id: 'umbrella', text: '우산' },
      { id: 'wallet', text: '지갑' },
      { id: 'phone', text: '스마트폰' },
      { id: 'hold', text: '분류 보류' }
    ],
    labelOptions: [],
    legendNote: '카드에는 물건 종류만 적혀 있다. 어떤 모습인지는 사진을 보자.',
    cardTypes: {
      umbrella_open:   { label: 'umbrella', icons: ['umbrella'], name: '펼친 우산', art: { photo: 'umbrella-open' } },
      umbrella_folded: { label: 'umbrella', icons: ['umbrella'], name: '접힌 우산', art: { photo: 'umbrella-folded' }, rare: true },
      wallet_closed:   { label: 'wallet',   icons: ['wallet'],   name: '닫힌 지갑', art: { photo: 'wallet-closed' } },
      wallet_open:     { label: 'wallet',   icons: ['wallet'],   name: '열린 지갑', art: { photo: 'wallet-open' }, rare: true },
      phone_front:     { label: 'phone',    icons: ['phone'],    name: '앞면 스마트폰', art: { photo: 'phone-front' } },
      phone_back:      { label: 'phone',    icons: ['phone'],    name: '뒷면 스마트폰', art: { photo: 'phone-back' }, rare: true }
    },
    ambiguous: [],
    outcomeText: { pass: '종류별 목록에 올렸다', inconvenience: '일부 물건이 분류 보류로 남았다', danger: '일부 물건이 분류 보류로 남았다' },
    counts: { umbrella_open: 8, wallet_closed: 8, phone_front: 8, umbrella_folded: 5, wallet_open: 5, phone_back: 5 },
    scenes: [
      { id: 'S1', title: '우산', emphasis: 'normal', art: { place: 'lostfound', focus: ['umbrella_open', 'umbrella_folded'] },
        combos: [
          { id: 'S1_open', keys: ['umbrella_open'], need: 3, danger: false, what: '펼친 우산 사진' },
          { id: 'S1_folded', keys: ['umbrella_folded'], need: 3, danger: false, what: '접힌 우산 사진' }
        ],
        passLine: '펼친 우산도, 접어서 묶은 우산도 우산 목록에 떴다.',
        cuts: { danger: '자료에 없던 모습의 우산이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.', inconvenience: '자료에 없던 모습의 우산이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.' } },
      { id: 'S2', title: '지갑', emphasis: 'normal', art: { place: 'lostfound', focus: ['wallet_closed', 'wallet_open'] },
        combos: [
          { id: 'S2_closed', keys: ['wallet_closed'], need: 3, danger: false, what: '닫힌 지갑 사진' },
          { id: 'S2_open', keys: ['wallet_open'], need: 3, danger: false, what: '열린 지갑 사진' }
        ],
        passLine: '닫힌 지갑도, 카드 칸이 보이게 열린 지갑도 지갑 목록에 떴다.',
        cuts: { danger: '자료에 없던 모습의 지갑이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.', inconvenience: '자료에 없던 모습의 지갑이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.' } },
      { id: 'S3', title: '스마트폰', emphasis: 'normal', art: { place: 'lostfound', focus: ['phone_front', 'phone_back'] },
        combos: [
          { id: 'S3_front', keys: ['phone_front'], need: 3, danger: false, what: '앞면 스마트폰 사진' },
          { id: 'S3_back', keys: ['phone_back'], need: 3, danger: false, what: '뒷면 스마트폰 사진' }
        ],
        passLine: '화면이 보이는 앞면도, 카메라가 보이는 뒷면도 스마트폰 목록에 떴다.',
        cuts: { danger: '자료에 없던 모습의 스마트폰이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.', inconvenience: '자료에 없던 모습의 스마트폰이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.' } }
    ],
    // 접수대 컨베이어 — 모습마다 2개씩, 지나가는 순서대로. 그 모습의 자료가 모자라면 그 물건만 분류 보류
    conveyor: [
      { id: 'cv1', art: 'umbrella_open', variant: 1, scene: 'S1', bin: 'umbrella', wrongBin: 'hold', causes: ['S1_open'] },
      { id: 'cv2', art: 'wallet_closed', variant: 1, scene: 'S2', bin: 'wallet', wrongBin: 'hold', causes: ['S2_closed'] },
      { id: 'cv3', art: 'phone_front', variant: 1, scene: 'S3', bin: 'phone', wrongBin: 'hold', causes: ['S3_front'] },
      { id: 'cv4', art: 'umbrella_folded', variant: 1, scene: 'S1', bin: 'umbrella', wrongBin: 'hold', causes: ['S1_folded'] },
      { id: 'cv5', art: 'wallet_open', variant: 1, scene: 'S2', bin: 'wallet', wrongBin: 'hold', causes: ['S2_open'] },
      { id: 'cv6', art: 'phone_back', variant: 1, scene: 'S3', bin: 'phone', wrongBin: 'hold', causes: ['S3_back'] },
      { id: 'cv7', art: 'wallet_closed', variant: 2, scene: 'S2', bin: 'wallet', wrongBin: 'hold', causes: ['S2_closed'] },
      { id: 'cv8', art: 'umbrella_folded', variant: 2, scene: 'S1', bin: 'umbrella', wrongBin: 'hold', causes: ['S1_folded'] },
      { id: 'cv9', art: 'phone_back', variant: 2, scene: 'S3', bin: 'phone', wrongBin: 'hold', causes: ['S3_back'] },
      { id: 'cv10', art: 'umbrella_open', variant: 2, scene: 'S1', bin: 'umbrella', wrongBin: 'hold', causes: ['S1_open'] },
      { id: 'cv11', art: 'wallet_open', variant: 2, scene: 'S2', bin: 'wallet', wrongBin: 'hold', causes: ['S2_open'] },
      { id: 'cv12', art: 'phone_front', variant: 2, scene: 'S3', bin: 'phone', wrongBin: 'hold', causes: ['S3_front'] }
    ],
    story: {
      intro: [
        { who: 'student', text: '제 우산 여기 있잖아요. 왜 목록에 없어요?' },
        { who: 'guide', text: '우산 검색 결과입니다. 펼친 우산만 찾았습니다.', face: 'explain' },
        { who: 'bot', text: '삐빅! 분실물 사진 3,000장 확보! 이름표도 제가 다 붙였어요! 임무 완료!', face: 'basic' },
        { who: 'supervisor', text: '사진을 펼쳐 보니 펼친 우산, 닫힌 지갑, 화면이 위로 향한 스마트폰이 반복되네.', face: 'worried' },
        { who: 'supervisor', text: '오늘 들어온 물건도 이 사진들처럼 놓여 있을까?', face: 'explain' },
        { who: 'guide', text: '추가 경보. 데이터 세계에 정체불명의 불꽃이 관측됩니다. 러너를 노리는 방해 세력으로 추정됩니다.', face: 'worried' },
        { who: 'peer', text: '나도 오늘 자격 딴 동기야. 같이 가자! 이번엔 제대로 모아 보자.', face: 'happy' },
        { who: 'peer', text: '이상하게 놓인 사진은 그냥 빼자. 이상한 건 AI만 헷갈려.', face: 'basic' },
        { who: 'supervisor', text: '러너, 출동. 무엇을 가져올지는 너희가 판단해. 넣을지는 내가 승인하고.', face: 'explain' }
      ],
      guideBrief: '이 AI는 직원이 접수한 물건을 종류별 검색 목록에 올립니다. 물건을 찾는 건 학생입니다. 무엇을 모을지는 러너의 판단 영역입니다.',
      supervisorQuestion: '접수대에서 본 물건들, 하나씩 다 떠올려 봤어?',
      responsibility: '승인한 건 나니까, 나도 같이 책임질게.',
      conveyorIntro: { who: 'supervisor', text: '그럼, 접수대에서 실제로 돌려 보자.', face: 'explain' },
      clientPass: [{ who: 'student', text: '이제 우산 칸에 떠요!' }],
      clientFail: [{ who: 'student', text: '아직 목록에 안 뜨는 물건이 있어요. 보관함에는 있는데…' }],
      senior: [
        { who: 'senior', text: '첫날치고 나쁘지 않네.', face: 'happy' },
        { who: 'senior', text: '근데 AI 너무 믿지는 마. AI는 네가 준 것 이상은 절대 몰라.', face: 'explain' }
      ],
      outro: [
        { who: 'supervisor', text: '오늘 결과는 실제 AI가 아니라, 단순화한 규칙으로 만든 시뮬레이션이야.', face: 'explain' },
        { who: 'supervisor', text: '실제 AI라면 어떻게 다를까? 그건 다 같이 이야기해 보자.', face: 'explain' }
      ]
    }
  };

  root.DR = root.DR || {};
  root.DR.Missions = root.DR.Missions || {};
  root.DR.Missions.m1 = m1;
  if (typeof module !== 'undefined' && module.exports) module.exports = m1;
})(typeof window !== 'undefined' ? window : globalThis);
