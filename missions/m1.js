/*
 * 1 임무 — 침수 판별 AI(기획서 §7). 장면·조합·카드 수·대사는 모두 여기서 고친다.
 * danger:true = 침수 조합(빠지면 침수를 '안전'으로 통과시키는 위험 실패),
 * danger:false = 정상 조합(빠지면 멀쩡한 길을 막는 불편 실패).
 * boundary:true = 경계 조합 — 일반 드문 카드로도, 올바르게 분류한 "?" 카드(2장 몫)로도 채워진다.
 * fakes = 그림과 이름표가 안 맞는 가짜(도로 사진이 아닌 것, spec §4). label = 붙은 이름표(카드 종류 key),
 * truth = 진짜 종류(없으면 null). 한 장면에 2장 이상 쌓이면 그 장면이 오염된다(config.fakeLimit).
 */
(function (root) {
  'use strict';

  var m1 = {
    id: 'm1', title: '침수 판별 AI', next: 'm2', bag: 30, runSeconds: 90, supplementSeconds: 30, seed: 1101, fires: 6,
    labelOptions: [
      { id: 'flood_deep', text: '침수(깊음)' },
      { id: 'flood_shallow', text: '침수(얕음)' },
      { id: 'wet', text: '정상(젖음)' },
      { id: 'dry', text: '정상(마름)' }
    ],
    cardTypes: {
      day_deep:      { icons: ['day', 'flood_deep'],      art: { time: 'day', water: 'deep' } },
      day_shallow:   { icons: ['day', 'flood_shallow'],   art: { time: 'day', water: 'shallow' } },
      day_wet:       { icons: ['day', 'wet'],             art: { time: 'day', water: 'wet' } },
      day_dry:       { icons: ['day', 'dry'],             art: { time: 'day', water: 'dry' } },
      night_wet:     { icons: ['night', 'wet'],           art: { time: 'night', water: 'wet' } },
      night_neon:    { icons: ['night', 'wet'],           art: { time: 'night', water: 'wet', variant: 'neon' }, rare: true, variantText: '네온 반사' },
      night_deep:    { icons: ['night', 'flood_deep'],    art: { time: 'night', water: 'deep' }, rare: true },
      night_shallow: { icons: ['night', 'flood_shallow'], art: { time: 'night', water: 'shallow' }, rare: true },
      night_muddy:   { icons: ['night', 'flood_shallow'], art: { time: 'night', water: 'shallow', variant: 'muddy' }, rare: true, variantText: '흙탕물' }
    },
    ambiguous: [
      { id: 'q_neon', truthKey: 'night_neon', correctLabel: 'wet', icons: ['night', 'unknown'],
        art: { time: 'night', water: 'wet', variant: 'neon', ambiguity: 'high' },
        clues: [
          { type: 'usual_photo', text: '같은 장소, 비 안 오는 밤' },
          { type: 'sensor', text: '근처 수위 센서: 0 cm' }
        ] },
      { id: 'q_muddy', truthKey: 'night_muddy', correctLabel: 'flood_shallow', icons: ['night', 'unknown'],
        art: { time: 'night', water: 'shallow', variant: 'muddy', ambiguity: 'high' },
        clues: [
          { type: 'sensor', text: '수위 센서: 9 cm' },
          { type: 'wheel', text: '세워 둔 차 바퀴 아래쪽이 물에 잠김' }
        ] },
      { id: 'q_clean', truthKey: 'day_wet', correctLabel: 'wet', icons: ['day', 'unknown'],
        art: { time: 'day', water: 'wet', variant: 'clean', ambiguity: 'high' },
        clues: [
          { type: 'time', text: '촬영 시각: 오전 10:12 · 맑음' },
          { type: 'log', text: '청소차 운행 기록: 10:05 이 도로 물청소' }
        ] }
    ],
    fakes: [
      { id: 'f_pool', name: '수영장', label: 'day_deep', truth: null, count: 2, art: { place: 'pool', time: 'day' },
        line: "우리가 넣은 데이터에 수영장 사진이 '깊은 침수'로 섞여 들어갔다." },
      { id: 'f_fountain', name: '분수 광장', label: 'day_shallow', truth: null, count: 2, art: { place: 'fountain', time: 'day' },
        line: "우리가 넣은 데이터에 분수 광장 사진이 '얕은 침수'로 섞여 들어갔다." },
      { id: 'f_fridge', name: '냉장고', label: 'night_wet', truth: null, count: 2, art: { object: 'fridge' },
        line: "우리가 넣은 데이터에 냉장고 사진이 '비에 젖은 밤 도로'로 섞여 들어갔다." }
    ],
    outcomeText: { pass: '제대로 판단했다', inconvenience: '멀쩡한 길을 막았다 · 불편', danger: '잠긴 길을 통과시켰다 · 위험' },
    counts: {
      day_deep: 11, day_shallow: 9, day_wet: 4, day_dry: 4, night_wet: 6,
      night_neon: 3, night_deep: 3, night_shallow: 3, night_muddy: 3
    },
    scenes: [
      { id: 'S1', title: '낮 주택가 골목 침수', emphasis: 'normal', art: { place: 'alley', time: 'day', water: 'deep' },
        combos: [
          { id: 'S1_day_deep', keys: ['day_deep'], need: 2, danger: true, missingLine: '우리가 넣은 데이터에는 낮에 깊게 잠긴 도로가 부족했다.' },
          { id: 'S1_day_shallow', keys: ['day_shallow'], need: 2, danger: true, missingLine: '우리가 넣은 데이터에는 낮에 얕게 잠긴 도로가 부족했다.' }
        ],
        passLine: '물에 잠긴 낮 골목. 통행을 제대로 막았다.',
        cuts: {
          danger: '잠긴 골목이 \'안전\'으로 표시됐다. 들어서려던 차를 감독관이 세웠다.',
          inconvenience: '멀쩡한 골목까지 막혔다.'
        } },
      { id: 'S2', title: '물청소 직후의 낮 도로', emphasis: 'normal', art: { place: 'street', time: 'day', water: 'wet', variant: 'clean' },
        combos: [
          { id: 'S2_day_wet', keys: ['day_wet'], need: 2, danger: false, missingLine: '우리가 넣은 데이터에는 물에 젖었을 뿐인 낮 도로가 거의 없었다.' },
          { id: 'S2_day_dry', keys: ['day_dry'], need: 2, danger: false, missingLine: '우리가 넣은 데이터에는 마른 낮 도로가 부족했다.' }
        ],
        passLine: '물청소가 막 끝난 길. 젖었을 뿐이라고 알아보고 그대로 열어 두었다.',
        cuts: {
          danger: '젖은 길과 잠긴 길을 가리지 못했다.',
          inconvenience: '물청소만 끝난 길을 침수로 막았다. 버스가 빙 돌아간다.'
        } },
      { id: 'S3', title: '비 오는 밤 번화가 교차로', emphasis: 'normal', art: { place: 'crossing', time: 'night', water: 'wet', variant: 'neon' },
        combos: [
          { id: 'S3_night_wet', keys: ['night_wet'], need: 2, danger: false, missingLine: '우리가 넣은 데이터에는 비에 젖은 밤 도로가 거의 없었다.' },
          { id: 'S3_night_neon', keys: ['night_neon'], need: 2, danger: false, boundary: true, missingLine: '우리가 넣은 데이터에는 네온 불빛이 비친 밤 도로가 없었다.' },
          { id: 'S3_night_deep', keys: ['night_deep'], need: 2, danger: true, missingLine: '우리가 넣은 데이터에는 밤에 깊게 잠긴 도로가 부족했다.',
            // 이 장면의 정답은 '젖었을 뿐'이라, 깊은 침수 예시가 없으면 길을 막는 불편으로 나타난다
            fail: { kind: 'inconvenience', line: '네온 반사를 깊은 물로 착각해 교차로를 막았다. 밤에 정말 잠긴 도로를 본 적이 없으니 빛과 물을 구분할 기준이 없었다.' } }
        ],
        passLine: '네온이 번쩍이는 젖은 교차로. 침수가 아니라고 알아보고 길을 열어 두었다.',
        cuts: {
          danger: '젖은 교차로와 잠긴 길을 가리지 못했다.',
          inconvenience: '젖었을 뿐인 밤 교차로를 침수로 막았다. 버스가 우회하고 길이 막힌다.'
        } },
      { id: 'S4', title: '고가도로 아래 저지대 교차로', emphasis: 'low', art: { place: 'overpass', time: 'night', water: 'shallow' },
        combos: [
          { id: 'S4_night_shallow', keys: ['night_shallow'], need: 2, danger: true, missingLine: '우리가 넣은 데이터에는 물에 살짝 잠긴 밤 도로가 거의 없었다.' },
          { id: 'S4_night_muddy', keys: ['night_muddy'], need: 2, danger: true, boundary: true, missingLine: '우리가 넣은 데이터에는 흙탕물에 얕게 잠긴 밤 도로가 없었다.' },
          { id: 'S4_night_wet', keys: ['night_wet'], need: 2, danger: false, missingLine: '우리가 넣은 데이터에는 비에 젖은 밤 도로가 거의 없었다.',
            // 이 장면의 정답은 '얕은 침수(막기)'라, 젖은 예시가 없으면 주변 멀쩡한 길까지 막는 불편으로 나타난다
            fail: { kind: 'inconvenience', line: '얕게 잠긴 길은 막았지만, 옆의 젖기만 한 밤길까지 같이 막았다. 젖은 밤 도로를 본 적이 없으니 어디까지가 잠긴 건지 선을 긋지 못했다.' } }
        ],
        passLine: '고가 그림자 아래 얕은 물. 잘 안 보였지만 침수로 알아보고 막았다.',
        cuts: {
          danger: '고가 그림자 아래, 얕게 잠긴 길이 \'안전\'으로 떴다. 차가 들어서려는 순간 감독관이 막아 세웠다.',
          inconvenience: '얕게 잠긴 길과 함께, 멀쩡한 고가 아래 길까지 막아 버렸다. 차들이 멀리 돌아간다.'
        } }
    ],
    story: {
      intro: [
        { who: 'supervisor', text: '올여름 비는 처음 보는 규모야. 침수 판별 AI가 따라가지 못하고 있어.' },
        { who: 'bot', text: '삐빅! 침수 사진 3,000장 확보! 이름표도 제가 다 붙였어요! 임무 완료!' },
        { who: 'guide', text: '수거봇 데이터로 복구한 결과입니다. 밤의 젖은 도로 열두 곳을 침수로 판정해 통행을 막았습니다.' },
        { who: 'supervisor', text: '3,000장 대부분이 낮의 물웅덩이 사진이네. 멀쩡한 길이 막혔어.' },
        { who: 'guide', text: '추가 경보. 데이터 세계에 정체불명의 불꽃이 관측됩니다. 러너를 노리는 방해 세력으로 추정됩니다.' },
        { who: 'peer', text: '나도 오늘 자격 딴 동기야. 같이 가자! 이번엔 제대로 모아 보자.' },
        { who: 'supervisor', text: '러너, 출동. 무엇을 가져올지는 너희가 판단해. 넣을지는 내가 승인하고.' }
      ],
      guideBrief: '이 AI는 비 오는 날 밤에도 침수 도로와 젖은 도로를 구별해야 합니다. 무엇을 모을지는 러너의 판단 영역입니다.',
      supervisorQuestion: '브리핑 장면 네 개, 하나씩 다 떠올려 봤어?',
      responsibility: '승인한 건 나니까, 나도 같이 책임질게.',
      clientPass: [{ who: 'client', text: '덕분에 오늘 밤은 길 걱정을 좀 덜었네요.' }],
      clientFail: [{ who: 'client', text: '아직 몇 군데는 불안하네요. 다시 한번 부탁해요.' }],
      senior: [
        { who: 'senior', text: '첫날치고 나쁘지 않네.' },
        { who: 'senior', text: '근데 AI 너무 믿지는 마. AI는 네가 준 것 이상은 절대 몰라.' }
      ],
      outro: [
        { who: 'supervisor', text: '오늘 결과는 실제 AI가 아니라, 단순화한 규칙으로 만든 시뮬레이션이야.' },
        { who: 'supervisor', text: '실제 AI라면 어떻게 다를까? 그건 다 같이 이야기해 보자.' }
      ]
    }
  };

  root.DR = root.DR || {};
  root.DR.Missions = root.DR.Missions || {};
  root.DR.Missions.m1 = m1;
  if (typeof module !== 'undefined' && module.exports) module.exports = m1;
})(typeof window !== 'undefined' ? window : globalThis);
