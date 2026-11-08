/*
 * 2 임무 — 분리배출 분류 AI(기획서 §8, spec §5). 장면·조합·카드 수·대사·컨베이어 물건은 모두 여기서 고친다.
 * labels = 분류함(이름표) 7종. 카드 종류(cardTypes)마다 label이 그 이름표를 가리킨다 — 이름표 하나가 여러 종류를 덮는다
 *          (예: '캔' = 음료 캔·통조림 캔). 카드 아이콘 = 이름표 아이콘 하나(icons: [label]).
 * hazard:true = 위험물(건전지). 이름표가 틀린 위험물이 장면에 쌓이면 그 장면은 '위험'으로 실패한다(압착기 화재).
 * fakes = 이름표가 틀린 카드(2 임무 주제: 검수에서 고칠 수 있다). truth = 진짜 종류(null이면 어떤 이름표도 맞지 않는다 → 빼기만).
 * conveyor = 결과 화면에서 처음 보는 물건(학습 카드에 안 쓴 변형 3~4). bin = 맞는 함, wrongBin = 틀릴 때 가는 함,
 *            causes = 틀리는 원인(조합 id: 그 조합이 빠짐 / 가짜 id: 그 가짜가 이 물건의 장면을 오염 / 'contaminated:S#': 그 장면이 무엇으로든 오염 /
 *            'danger:S#': 그 장면이 '위험'으로 실패). 장면마다 건전지 물건이 하나씩 있어 '위험' 장면 = 그 장면에서 비상 정지(테스트로 고정).
 * scenes[].art.wrongBin = 결과 컷(불편)에서 물건이 잘못 들어간 함 — 컷 문구와 맞춘다.
 * ⚠️ 분리배출 내용은 실제 규칙과 맞아야 한다(2026-11 확인: 영수증 감열지·칫솔 = 종량제, 건전지 = 전지류 따로,
 *    종이팩은 종이와 따로, 투명 페트는 라벨 떼고 찌그러뜨려 따로 — 찌그러진 투명 페트도 투명 페트).
 */
(function (root) {
  'use strict';

  var m2 = {
    id: 'm2', title: '분리배출 분류 AI', next: 'm3', cityLine: '분리배출 분류 AI가 다시 이어졌다', bag: 30, runSeconds: 90, supplementSeconds: 30, seed: 2201, fires: 6,
    // 달리기 구역(장면 순서) · 가짜는 자기 구역 뒤쪽 절반 · 배경은 선별장(js/run-scenery.js)
    zones: [
      { id: 'S1', title: '음료 캔과 통조림 캔', short: '캔' },
      { id: 'S2', title: '찌그러진 페트병과 비닐', short: '페트·비닐' },
      { id: 'S3', title: '우유팩·신문지·영수증', short: '종이·영수증' },
      { id: 'S4', title: '캔 사이에 섞인 건전지', short: '건전지' }
    ],
    fakeLate: 'zone', scenery: 'sorting',
    labels: [
      { id: 'can', text: '캔' },
      { id: 'pet', text: '투명 페트' },
      { id: 'pack', text: '종이팩' },
      { id: 'paper', text: '종이' },
      { id: 'vinyl', text: '비닐' },
      { id: 'battery', text: '건전지' },
      { id: 'trash', text: '일반쓰레기' }
    ],
    legendNote: '카드 아래 아이콘은 붙어 있는 이름표(분류함)다. 그림과 이름표가 맞는지 보자.',
    cardTypes: {
      can_drink:   { label: 'can',     icons: ['can'],     name: '음료 캔',         art: { object: 'can_drink', photo: 'can_drink' } },
      pet_clear:   { label: 'pet',     icons: ['pet'],     name: '투명 페트병',     art: { object: 'pet_clear', photo: 'pet_clear' } },
      vinyl_bag:   { label: 'vinyl',   icons: ['vinyl'],   name: '비닐봉지',        art: { object: 'vinyl_bag', photo: 'vinyl_bag' } },
      paper_news:  { label: 'paper',   icons: ['paper'],   name: '신문지·종이 상자', art: { object: 'paper_news', photos: ['paper_news', 'paper_box'] } },
      pack_milk:   { label: 'pack',    icons: ['pack'],    name: '우유팩',          art: { object: 'pack_milk', photo: 'pack_milk' } },
      can_tin:     { label: 'can',     icons: ['can'],     name: '통조림 캔',       art: { object: 'can_tin', photo: 'can_tin' }, rare: true },
      pet_crushed: { label: 'pet',     icons: ['pet'],     name: '찌그러진 페트병', art: { object: 'pet_crushed', photo: 'pet_crushed' }, rare: true },
      trash_misc:  { label: 'trash',   icons: ['trash'],   name: '일반쓰레기',      art: { object: 'trash_misc', photos: ['trash_glove', 'trash_sponge', 'trash_tissue'] }, rare: true },
      battery_aa:  { label: 'battery', icons: ['battery'], name: '건전지',          art: { object: 'battery_aa', photo: 'battery_aa' }, rare: true, hazard: true }
    },
    ambiguous: [],
    fakes: [
      { id: 'f_receipt', name: '영수증', label: 'paper', truth: 'trash_misc', count: 3, art: { object: 'receipt', photo: 'receipt' },
        line: "우리가 넣은 데이터에 영수증 사진이 '종이'로 섞여 들어갔다." },
      { id: 'f_toothbrush', name: '칫솔', label: 'pet', truth: 'trash_misc', count: 2, art: { object: 'toothbrush', photo: 'toothbrush' },
        line: "우리가 넣은 데이터에 칫솔 사진이 '투명 페트'로 섞여 들어갔다." },
      { id: 'f_battery', name: '건전지', label: 'can', truth: 'battery_aa', count: 3, art: { object: 'battery_aa', photo: 'battery_aa' },
        line: "우리가 넣은 데이터에 건전지 사진이 '캔'으로 섞여 들어갔다." },
      { id: 'f_cat', name: '고양이', label: 'vinyl', truth: null, count: 2, art: { animal: 'cat' },
        line: "우리가 넣은 데이터에 고양이 사진이 '비닐'로 섞여 들어갔다." }
    ],
    outcomeText: { pass: '제대로 분류했다', inconvenience: '엉뚱한 함으로 갔다 · 불편', danger: '압착기에 건전지가 들어갔다 · 위험' },
    counts: {
      can_drink: 9, pet_clear: 8, vinyl_bag: 6, paper_news: 7, pack_milk: 5,
      can_tin: 3, pet_crushed: 3, trash_misc: 3, battery_aa: 3
    },
    scenes: [
      { id: 'S1', title: '음료 캔과 통조림 캔', emphasis: 'normal', art: { place: 'sorting', focus: ['can_drink', 'can_tin'], wrongBin: 'vinyl' },
        combos: [
          { id: 'S1_can_drink', keys: ['can_drink'], need: 2, danger: false, what: '음료 캔' },
          { id: 'S1_can_tin', keys: ['can_tin'], need: 2, danger: false, boundary: true, what: '통조림 캔' }
        ],
        passLine: '납작한 음료 캔도, 뚱뚱한 통조림 캔도 캔 함으로 들어갔다.',
        cuts: {
          danger: '캔 사이에 섞인 건전지가 압착기로 들어갔다. 불꽃이 튀자 감독관이 비상 정지 버튼을 눌렀다.',
          inconvenience: '캔이 엉뚱한 함으로 갔다. 선별장 직원이 손으로 다시 골라낸다.'
        } },
      { id: 'S2', title: '찌그러진 페트병과 비닐', emphasis: 'normal', art: { place: 'sorting', focus: ['pet_crushed', 'vinyl_bag'], wrongBin: 'trash' },
        combos: [
          { id: 'S2_pet_clear', keys: ['pet_clear'], need: 2, danger: false, what: '투명 페트병' },
          { id: 'S2_pet_crushed', keys: ['pet_crushed'], need: 2, danger: false, boundary: true, what: '찌그러진 페트병' },
          { id: 'S2_vinyl_bag', keys: ['vinyl_bag'], need: 2, danger: false, what: '비닐봉지' }
        ],
        passLine: '찌그러진 페트병도 투명 페트 함으로, 구겨진 비닐은 비닐 함으로.',
        cuts: {
          danger: '페트 사이에 섞인 건전지가 압착기로 들어갔다. 불꽃이 튀자 감독관이 비상 정지 버튼을 눌렀다.',
          inconvenience: '찌그러진 페트병과 비닐이 엉뚱한 함으로 갔다. 선별장 직원이 손으로 다시 골라낸다.'
        } },
      { id: 'S3', title: '우유팩·신문지·영수증', emphasis: 'normal', art: { place: 'sorting', focus: ['pack_milk', 'f_receipt'], wrongBin: 'paper' },
        combos: [
          { id: 'S3_pack_milk', keys: ['pack_milk'], need: 2, danger: false, what: '우유팩' },
          { id: 'S3_paper_news', keys: ['paper_news'], need: 2, danger: false, what: '신문지와 종이 상자' },
          { id: 'S3_trash_misc', keys: ['trash_misc'], need: 2, danger: false, what: '재활용이 안 되는 일반쓰레기' }
        ],
        passLine: '우유팩은 종이팩 함으로, 신문지는 종이 함으로, 영수증은 일반쓰레기로.',
        cuts: {
          danger: '종이 사이에 섞인 건전지가 압착기로 들어갔다. 불꽃이 튀자 감독관이 비상 정지 버튼을 눌렀다.',
          inconvenience: '종이 함에 영수증과 우유팩이 섞였다. 그 종이 더미는 재활용이 어려워 선별장 직원이 다시 골라낸다.'
        } },
      { id: 'S4', title: '캔 사이에 섞인 건전지', emphasis: 'low', art: { place: 'sorting', focus: ['can_drink', 'battery_aa'], wrongBin: 'trash' },
        combos: [
          { id: 'S4_battery_aa', keys: ['battery_aa'], need: 2, danger: true, what: '건전지' },
          { id: 'S4_can_drink', keys: ['can_drink'], need: 2, danger: false, what: '음료 캔' }
        ],
        passLine: '캔 더미 속 작은 건전지를 골라내 건전지 함으로 보냈다. 압착기는 조용하다.',
        cuts: {
          danger: '캔 사이에 섞인 건전지가 캔 함을 거쳐 압착기로 들어갔다. 불꽃이 튀자 감독관이 비상 정지 버튼을 눌렀다.',
          inconvenience: '건전지는 골라냈지만, 멀쩡한 캔까지 엉뚱한 함으로 보냈다. 선별장 직원이 손으로 다시 골라낸다.'
        } }
    ],
    // 결과 화면의 컨베이어 — 지나가는 순서대로(14개). 건전지(위험물)가 틀린 함으로 가면 비상 정지
    conveyor: [
      { id: 'cv1', art: 'can_drink', variant: 3, scene: 'S1', bin: 'can', wrongBin: 'vinyl', causes: ['S1_can_drink', 'contaminated:S1'] },
      { id: 'cv2', art: 'pet_clear', variant: 3, scene: 'S2', bin: 'pet', wrongBin: 'vinyl', causes: ['S2_pet_clear', 'contaminated:S2'] },
      { id: 'cv3', art: 'pack_milk', variant: 3, scene: 'S3', bin: 'pack', wrongBin: 'paper', causes: ['S3_pack_milk', 'contaminated:S3'] },
      { id: 'cv4', art: 'can_tin', variant: 3, scene: 'S1', bin: 'can', wrongBin: 'trash', causes: ['S1_can_tin'] },
      { id: 'cv5', art: 'paper_news', variant: 3, scene: 'S3', bin: 'paper', wrongBin: 'trash', causes: ['S3_paper_news'] },
      { id: 'cv6', art: 'vinyl_bag', variant: 3, scene: 'S2', bin: 'vinyl', wrongBin: 'trash', causes: ['S2_vinyl_bag', 'f_cat'] },
      { id: 'cv7', art: 'f_receipt', variant: 3, scene: 'S3', bin: 'trash', wrongBin: 'paper', causes: ['f_receipt', 'S3_trash_misc'] },
      { id: 'cv13', art: 'battery_aa', variant: 5, scene: 'S3', bin: 'battery', wrongBin: 'paper', causes: ['danger:S3'] },
      { id: 'cv8', art: 'pet_crushed', variant: 3, scene: 'S2', bin: 'pet', wrongBin: 'trash', causes: ['S2_pet_crushed'] },
      { id: 'cv14', art: 'battery_aa', variant: 6, scene: 'S2', bin: 'battery', wrongBin: 'pet', causes: ['danger:S2'] },
      { id: 'cv9', art: 'battery_aa', variant: 3, scene: 'S1', bin: 'battery', wrongBin: 'can', causes: ['f_battery', 'danger:S1'] },
      { id: 'cv10', art: 'f_toothbrush', variant: 3, scene: 'S2', bin: 'trash', wrongBin: 'pet', causes: ['f_toothbrush'] },
      { id: 'cv11', art: 'can_drink', variant: 4, scene: 'S4', bin: 'can', wrongBin: 'trash', causes: ['S4_can_drink', 'contaminated:S4'] },
      { id: 'cv12', art: 'battery_aa', variant: 4, scene: 'S4', bin: 'battery', wrongBin: 'can', causes: ['S4_battery_aa', 'f_battery', 'danger:S4'] }
    ],
    story: {
      intro: [
        { who: 'supervisor', text: '이번엔 재활용 선별장이야. 분류 AI가 물건을 자꾸 엉뚱한 함에 넣고 있어.', face: 'worried' },
        { who: 'bot', text: '삐빅! 분리배출 사진 5,000장! 이름표도 제가 다 붙였어요! 이번엔 진짜 임무 완료!', face: 'basic' },
        { who: 'guide', text: '수거봇 데이터로 복구한 결과입니다. 오늘 오전에만 물건 여러 개가 다른 함으로 갔습니다.', face: 'explain' },
        { who: 'sorter', text: '잘못 간 건 결국 저희가 손으로 다시 골라요. 캔 함에 건전지라도 섞이면 압착기에서 불이 날 수도 있고요.', face: 'worried' },
        { who: 'peer', text: '찌그러진 페트병 같은 건 빼자. 이상한 건 빼는 게 깔끔하잖아.', face: 'basic' },
        { who: 'guide', text: '추가 경보. 데이터 세계의 불꽃이 다시 관측됩니다.', face: 'worried' },
        { who: 'senior', text: '1 임무 봤어. 다음엔 나랑 같이 달려 보자. 누가 더 제대로 모으나.', face: 'happy' },
        { who: 'supervisor', text: '러너, 출동. 이번엔 사진에 붙은 이름표도 하나하나 봐 줘.', face: 'explain' }
      ],
      guideBrief: '이 AI는 선별장 컨베이어 위 물건을 일곱 개 분류함 중 하나에 넣어야 합니다. 사진에 붙은 이름표가 곧 AI가 배우는 정답입니다.',
      // 1 임무 기록에 따라 브리핑에 한 줄(기획서 §9 "대사 변화 한 줄"). 기록이 없으면(임무 고르기로 바로 들어옴) 이 줄 없음
      recordLine: {
        firstTry: '1 임무는 첫 판에 통과했습니다. 이번에는 사진만큼 이름표도 살펴 주세요.',
        supplemented: '1 임무는 첫 판에 놓친 장면이 있었습니다. 이번에는 처음부터 이름표까지 살펴 주세요.'
      },
      supervisorQuestion: '카드마다 붙은 이름표, 그림이랑 맞는지 다 봤어?',
      conveyorIntro: { who: 'supervisor', text: '그럼, 실제로 돌려 보자.', face: 'explain' },
      emergency: { who: 'supervisor', text: '비상 정지! {bin} 함에 건전지가 들어갔어.', face: 'worried' }, // {bin} = 건전지가 들어간 함
      responsibility: '승인한 건 나니까, 나도 같이 책임질게.',
      clientPass: [{ who: 'sorter', text: '오늘은 손으로 다시 고를 게 거의 없겠어요. 고마워요.', face: 'basic' }],
      clientFail: [{ who: 'sorter', text: '아직 몇 개는 제가 다시 골라야겠네요. 한 번 더 부탁해요.', face: 'worried' }],
      senior: [
        { who: 'senior', text: '컨베이어, 꽤 잘 돌아가네.', face: 'happy' },
        { who: 'senior', text: '근데 기계가 틀리면 결국 사람이 다시 골라야 하잖아. 난 그게 계속 마음에 걸려.', face: 'worried' }
      ],
      outro: [
        { who: 'supervisor', text: '오늘 컨베이어도 실제 AI가 아니라, 단순화한 규칙으로 만든 시뮬레이션이야.', face: 'explain' },
        { who: 'supervisor', text: '이름표가 틀린 사진이 실제 AI에 들어가면 어떻게 될까? 다 같이 이야기해 보자.', face: 'explain' }
      ]
    }
  };

  root.DR = root.DR || {};
  root.DR.Missions = root.DR.Missions || {};
  root.DR.Missions.m2 = m2;
  if (typeof module !== 'undefined' && module.exports) module.exports = m2;
})(typeof window !== 'undefined' ? window : globalThis);
