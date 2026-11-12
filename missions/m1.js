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
    id: 'm1', title: '분실물 센터 AI', next: 'm2', cityLine: '분실물 센터 AI가 다시 이어졌다', bag: 30, runSeconds: 90, supplementSeconds: 30, seed: 1101, fires: 4, glitchRate: 0.05,
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
    // 목적 밖 개인정보 카드(설계 2026-11-08 ①, DR.Privacy): 흔한 모습 카드에만. 신분증·메시지는 사진의 곁가지 → 가리기 뒤 사용
    // wallet-id = 닫힌 지갑의 투명 카드 칸으로 신분증이 보이는 사진(2026-11-08 Codex 다시 그림) → 닫힌 지갑 종류로 센다
    privacy: {
      on: true,
      cards: [
        { id: 'p_wallet_id', key: 'wallet_closed', fix: 'mask', at: 0.5, what: '신분증', art: { photo: 'wallet-id' },
          mask: [{ x: 0.24, y: 0.27, w: 0.55, h: 0.35, look: 'bar' }] },
        { id: 'p_phone_msg', key: 'phone_front', fix: 'mask', at: 0.6, what: '메시지 알림', art: { photo: 'phone-lock-message' },
          mask: [{ x: 0.3, y: 0.27, w: 0.43, h: 0.32, look: 'bar' }] }
      ]
    },
    ambiguous: [],
    // 결과 문구(플레이테스트 2, DR.ResultLine): 조합마다 cut = 그 조합만 모자랄 때, 여럿이 모자라면 이 틀에 이름(item)을 "A와 B"로
    cutTemplate: { inconvenience: '{what:을} 알아보지 못해 분류 보류 칸으로 보냈다. 물건은 보관함에 그대로 있다.' },
    outcomeText: { pass: '종류별 목록에 올렸다', inconvenience: '일부 물건이 분류 보류로 남았다', danger: '일부 물건이 분류 보류로 남았다' },
    counts: { umbrella_open: 8, wallet_closed: 8, phone_front: 8, umbrella_folded: 5, wallet_open: 5, phone_back: 5 },
    scenes: [
      { id: 'S1', title: '우산', emphasis: 'normal', art: { place: 'lostfound', focus: ['umbrella_open', 'umbrella_folded'] },
        combos: [
          { id: 'S1_open', keys: ['umbrella_open'], need: 3, danger: false, what: '펼친 우산 사진', item: '펼친 우산',
            cut: '펼친 우산을 알아보지 못해 분류 보류 칸으로 보냈다. 물건은 보관함에 그대로 있다.' },
          { id: 'S1_folded', keys: ['umbrella_folded'], need: 3, danger: false, what: '접힌 우산 사진', item: '접힌 우산',
            cut: '접어서 묶은 우산을 알아보지 못해 분류 보류 칸으로 보냈다. 물건은 보관함에 그대로 있다.' }
        ],
        passLine: '펼친 우산도, 접어서 묶은 우산도 우산 목록에 떴다.',
        cuts: { danger: '자료에 없던 모습의 우산이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.', inconvenience: '자료에 없던 모습의 우산이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.' } },
      { id: 'S2', title: '지갑', emphasis: 'normal', art: { place: 'lostfound', focus: ['wallet_closed', 'wallet_open'] },
        combos: [
          { id: 'S2_closed', keys: ['wallet_closed'], need: 3, danger: false, what: '닫힌 지갑 사진', item: '닫힌 지갑',
            cut: '닫힌 지갑을 알아보지 못해 분류 보류 칸으로 보냈다. 물건은 보관함에 그대로 있다.' },
          { id: 'S2_open', keys: ['wallet_open'], need: 3, danger: false, what: '열린 지갑 사진', item: '열린 지갑',
            cut: '카드 칸이 보이게 열린 지갑을 알아보지 못해 분류 보류 칸으로 보냈다. 물건은 보관함에 그대로 있다.' }
        ],
        passLine: '닫힌 지갑도, 카드 칸이 보이게 열린 지갑도 지갑 목록에 떴다.',
        cuts: { danger: '자료에 없던 모습의 지갑이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.', inconvenience: '자료에 없던 모습의 지갑이 분류 보류 칸으로 갔다. 물건은 보관함에 그대로 있다.' } },
      { id: 'S3', title: '스마트폰', emphasis: 'normal', art: { place: 'lostfound', focus: ['phone_front', 'phone_back'] },
        combos: [
          { id: 'S3_front', keys: ['phone_front'], need: 3, danger: false, what: '앞면 스마트폰 사진', item: '앞면 스마트폰',
            cut: '화면이 위로 향한 스마트폰을 알아보지 못해 분류 보류 칸으로 보냈다. 물건은 보관함에 그대로 있다.' },
          { id: 'S3_back', keys: ['phone_back'], need: 3, danger: false, what: '뒷면 스마트폰 사진', item: '뒷면 스마트폰',
            cut: '카메라가 보이는 뒷면 스마트폰을 알아보지 못해 분류 보류 칸으로 보냈다. 물건은 보관함에 그대로 있다.' }
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
    // 챕터 끝(설계 2026-11-08 ②, js/ui-chapter.js): 다른 용도 요청(메시지) → 개념 질문 → 짧은 생각. ⚠️ 문장은 교사 검수 전 초안
    // 방향은 늘 '가장 지키는 쪽'(거절 = best). 다른 선택지는 왜 그것만으로 지켜지지 않는지 쉬운 말로
    chapterEnd: {
      from: '○○마트 마케팅팀',
      message: '분실물 센터에 남은 주인 연락처로 우리 마트 할인 문자를 보내고 싶어요. 연락처를 나눠 주실래요?',
      choices: [
        { id: 'consent', text: '주인들에게 먼저 동의를 받고 보낸다', short: '동의 받고 보내기',
          feedback: '동의를 묻는 문자도 결국 그 번호를 원래 목적과 다르게 쓰는 일이야. 물건을 돌려주는 일과 상관없는 부탁이라면 거절이 가장 안전해.' },
        { id: 'refuse', best: true, text: '거절한다. 연락처는 물건을 돌려주려고 받은 거야', short: '거절',
          feedback: '맞아. 모은 목적 안에서만 쓰는 게 원칙이야.' },
        // id 'erase'는 그대로 둔다(저장된 처음·마지막 선택 값 — 구조 유지). 글만 바꿈(플레이테스트 2026-11-12: '연락처를 지우고 보낸다'는 답이 될 수 없는 선택지였다)
        { id: 'erase', text: '이미 받은 연락처니까 그냥 나눠 준다', short: '그냥 나눠 주기',
          feedback: '연락처는 물건을 돌려주려고 받은 거야. 다른 일에 쓰면, 그 사람은 내 번호가 어디로 갔는지 모르게 돼.' }
      ],
      concept: {
        question: '접힌 우산 사진을 모으지 않으면, AI는 접힌 모습의 우산을 어떻게 할까?',
        choices: [
          { id: 'a', correct: true, text: '알아보지 못한다', feedback: '맞아. AI는 자료에 있던 모습만 알아봐. 빠진 모습은 분류 보류로 남아.' },
          { id: 'b', text: '비슷하니까 알아서 알아본다', feedback: '아니야. AI는 본 적 없는 모습을 짐작하지 못해. 그래서 여러 모습을 골고루 모아야 해.' },
          { id: 'c', text: '사진을 많이 모으면 접힌 모습도 저절로 알게 된다', feedback: '수거봇의 3,000장처럼 많아도 같은 모습만 있으면 소용없어. 빠진 모습을 넣어야 알아봐.' }
        ]
      },
      frame: '이 AI를 위해 데이터를 모을 때 나는 ___을 꼭 확인하겠다. 왜냐하면 ___.'
    },
    story: {
      // introBg·outroBg = 도입·마무리 대화 내내 대화창 뒤에 까는 장면 그림(app.js withBg가 줄마다 붙임 — 줄에 bg가 따로 있으면 그 줄 것이 우선)
      //   분실물 센터: 가운데 검색 모니터(펼친 우산만)·선반의 접힌 분홍 우산, 오른쪽 학생
      //   마무리 대화 = 해결된 장면(같은 방, 모니터에 접힌 분홍 우산 칸이 뜨고 학생이 웃으며 가리킴 — 2026-11-11). 도입 그림을 그대로 깔면 "이제 우산 칸에 떠요!"와 반대가 된다
      introBg: 'assets/story/m1-lostfound.webp',
      outroBg: 'assets/story/m1-lostfound-solved.webp',
      outroFailBg: 'assets/story/m1-lostfound.webp', // 끝내 통과하지 못한 판의 마무리 = 아직 목록에 안 뜨는 도입 장면 그대로(app.js runEnding)
      intro: [
        { who: 'student', text: '제 우산 여기 있잖아요. 왜 목록에 없어요?', face: 'worried' },
        { who: 'guide', text: '우산 검색 결과입니다. 펼친 우산만 찾았습니다.', face: 'explain' },
        { who: 'bot', text: '삐빅! 분실물 사진 3,000장 확보! 이름표도 제가 다 붙였어요! 임무 완료!', face: 'basic' },
        { who: 'supervisor', text: '사진을 펼쳐 보니 펼친 우산, 닫힌 지갑, 화면이 위로 향한 스마트폰이 반복되네.', face: 'worried' },
        { who: 'supervisor', text: '오늘 들어온 물건도 이 사진들처럼 놓여 있을까?', face: 'explain' },
        { who: 'guide', text: '추가 경보. 데이터 세계에 정체불명의 불꽃이 관측됩니다. 러너를 노리는 방해 세력으로 추정됩니다.', face: 'worried' },
        { who: 'peer', text: '나도 오늘 자격 딴 동기야. 같이 가자! 이번엔 제대로 모아 보자.', face: 'happy' },
        { who: 'peer', text: '이상하게 놓인 사진은 그냥 빼자. 이상한 건 AI만 헷갈려.', face: 'basic' },
        { who: 'supervisor', text: '러너, 출동. 무엇을 가져올지는 너희가 판단해. 넣을지는 내가 승인하고.', face: 'explain' }
      ],
      guideBrief: '이 AI는 직원이 접수한 물건을 종류별 검색 목록에 올립니다. 물건은 학생이 찾습니다. 무엇을 모을지는 러너가 판단합니다.',
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
