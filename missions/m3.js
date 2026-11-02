/*
 * 3 임무 — 길 안내 AI / 오래된 자료 / 정체 공개(기획서 §8, 설계 2026-11-01 §4). 장면·조합·카드 수·대사·시연 질문은 여기서 고친다.
 * labels = 장소(길 안내 AI가 알아봐야 할 곳) 4종. 이 임무는 이름표를 고치지 않는다(relabel:false — 이름표는 맞고, 문제는 '언제' 찍었느냐).
 * 모든 카드에 촬영 날짜(dates, 변형마다 하나 — 검수에서 크게 볼 때만 보임). 날짜가 있는 카드만 있으면 그 자체가 단서라서 전부에 준다.
 * fakes = 바뀐 곳의 옛 사진(수거봇이 쏟아부은 것): 그 장소 이름표가 붙었지만 지금의 거리가 아니다(truth 없음 → 빼기만 답).
 *         한 장면에 2장 이상이면 오염. 철거 전 육교는 harm:'danger'(없는 육교로 안내 → 사람이 차도로).
 * 시장 골목은 2015년 뒤로 바뀐 적이 없다 → 옛 사진도 지금의 시장 골목이다. 최근 사진은 코스 전체에 2장뿐이라
 * 옛 날짜 카드를 전부 빼면 시장 골목 장면이 실패한다(기획서 원칙 2 — 오래된 자료를 무조건 나쁜 데이터로 취급하지 않는다).
 * 종류 이름에 '예전·옛' 같은 표시를 쓰지 않는다(옛 사진이라고 미리 알려 주지 않게). market_old는 화면에서 market_now와 한 종류(displayAs).
 * fakeHint = 달리기 중 첫 가짜 안내(이 임무는 그림과 이름표가 늘 맞고, 단서는 '언제'다).
 * changeLog = 검수 화면의 '도시 변경 기록'(장소마다 한 줄). guide = 결과의 '길 안내 시연' 질문(원인 규칙은 2 임무 컨베이어와 같다).
 * ⚠️ 지하차도·지하보도는 그리지도 쓰지도 않는다(기획서 §10).
 */
(function (root) {
  'use strict';

  var m3 = {
    id: 'm3', title: '길 안내 AI', bag: 30, runSeconds: 90, supplementSeconds: 30, seed: 3301, fires: 8,
    zones: [
      { id: 'S1', title: '역 앞 사거리', short: '역 앞' },
      { id: 'S2', title: '시장 골목', short: '시장 골목' },
      { id: 'S3', title: '새로 난 강변길', short: '강변길' },
      { id: 'S4', title: '학교 앞 횡단보도', short: '학교 앞' }
    ],
    fakeLate: 'zone', scenery: 'city', relabel: false,
    fakeHint: '지금도 이런 거리인지 생각해 봐!',
    labels: [
      { id: 'station', text: '역 앞 사거리' },
      { id: 'market', text: '시장 골목' },
      { id: 'river', text: '강변길' },
      { id: 'crossing', text: '학교 앞 횡단보도' }
    ],
    legendNote: '카드 아래 아이콘은 붙어 있는 장소 이름표다. 검수에서 크게 보면 언제 찍은 사진인지 나온다.',
    changeLog: [
      { label: 'station', when: '2024년 8월', text: '역 앞 빌딩 철거, 광장이 생김' },
      { label: 'market', when: null, text: '2015년 뒤로 바뀐 것 없음' },
      { label: 'river', when: '2025년 5월', text: '강변길 새로 열림(그 전엔 공터)' },
      { label: 'crossing', when: '2023년 3월', text: '학교 앞 육교 철거, 횡단보도가 생김' }
    ],
    cardTypes: {
      station_now:    { label: 'station',  icons: ['station'],  name: '역 앞 광장',                 art: { view: 'station', time: 'day' },              dates: ['2025년 9월', '2026년 2월', '2026년 4월'] },
      station_rain:   { label: 'station',  icons: ['station'],  name: '비 오는 밤 역 앞',            art: { view: 'station', time: 'night', rain: true }, dates: ['2025년 11월', '2026년 3월', '2026년 7월'], rare: true },
      market_now:     { label: 'market',   icons: ['market'],   name: '시장 골목',                   art: { view: 'market', time: 'day' },               dates: ['2026년 1월', '2026년 5월', '2026년 8월'], rare: true },
      market_old:     { label: 'market',   icons: ['market'],   name: '시장 골목',                   displayAs: 'market_now', art: { view: 'market', time: 'day' },               dates: ['2016년 5월', '2018년 9월', '2020년 4월'] },
      market_eve_old: { label: 'market',   icons: ['market'],   name: '저녁 시장 골목',               art: { view: 'market', time: 'evening' },           dates: ['2017년 12월', '2018년 6월', '2019년 10월'], rare: true },
      river_now:      { label: 'river',    icons: ['river'],    name: '강변길',                      art: { view: 'river', time: 'day' },                dates: ['2025년 7월', '2025년 10월', '2026년 5월'] },
      river_night:    { label: 'river',    icons: ['river'],    name: '밤 강변길',                   art: { view: 'river', time: 'night' },              dates: ['2025년 8월', '2026년 1월', '2026년 6월'], rare: true },
      crossing_now:   { label: 'crossing', icons: ['crossing'], name: '학교 앞 횡단보도',             art: { view: 'crossing', time: 'day' },             dates: ['2024년 3월', '2025년 4월', '2026년 3월'] },
      crossing_rain:  { label: 'crossing', icons: ['crossing'], name: '비 오는 학교 앞',              art: { view: 'crossing', time: 'day', rain: true },  dates: ['2024년 7월', '2025년 6월', '2026년 7월'], rare: true }
    },
    ambiguous: [],
    fakes: [
      { id: 'o_station', name: '철거 전 빌딩', label: 'station', truth: null, count: 3, art: { view: 'station', era: 'old', time: 'day' },
        dates: ['2019년 4월', '2019년 10월', '2020년 6월'],
        line: '우리가 넣은 데이터에 철거 전 빌딩이 서 있는 옛 역 앞 사진이 섞여 들어갔다.' },
      { id: 'o_river', name: '공사 전 공터', label: 'river', truth: null, count: 3, art: { view: 'river', era: 'old', time: 'day' },
        dates: ['2021년 5월', '2021년 11월', '2022년 8월'],
        line: '우리가 넣은 데이터에 강변길이 생기기 전 공터 사진이 섞여 들어갔다.' },
      { id: 'o_crossing', name: '철거 전 육교', label: 'crossing', truth: null, count: 3, harm: 'danger', art: { view: 'crossing', era: 'old', time: 'day' },
        dates: ['2020년 9월', '2021년 4월', '2022년 10월'],
        line: '우리가 넣은 데이터에 철거 전 육교가 있는 옛 학교 앞 사진이 섞여 들어갔다.' }
    ],
    outcomeText: { pass: '제대로 안내했다', inconvenience: '옛길로 안내했다 · 불편', danger: '없는 육교로 안내했다 · 위험' },
    counts: {
      station_now: 8, station_rain: 3, market_now: 2, market_old: 5, market_eve_old: 3,
      river_now: 6, river_night: 3, crossing_now: 5, crossing_rain: 3
    },
    scenes: [
      { id: 'S1', title: '역 앞 사거리', emphasis: 'normal', art: { view: 'station', time: 'day' },
        combos: [
          { id: 'S1_station_now', keys: ['station_now'], need: 2, danger: false, what: '지금의 역 앞 광장 사진',
            fail: { kind: 'inconvenience', line: '지금의 역 앞 광장을 잘 몰라 엉뚱한 길로 안내했다. 택배 기사가 광장을 몇 바퀴 돈다.' } },
          { id: 'S1_station_rain', keys: ['station_rain'], need: 2, danger: false, boundary: true, what: '비 오는 밤 역 앞 사진',
            fail: { kind: 'inconvenience', line: '비 오는 밤에는 역 앞을 알아보지 못해 엉뚱한 길로 안내했다.' } }
        ],
        passLine: '광장을 가로지르는 길로 안내했다. 택배 기사가 제시간에 도착한다.',
        cuts: {
          danger: '없어진 건물을 기준으로 안내하다 차도 쪽으로 보냈다. 감독관이 안내를 멈췄다.',
          inconvenience: '역 앞에서 엉뚱한 길로 안내했다. 택배 기사가 광장을 몇 바퀴 돈다.'
        } },
      { id: 'S2', title: '시장 골목', emphasis: 'normal', art: { view: 'market', time: 'day' },
        combos: [
          { id: 'S2_market', keys: ['market_now', 'market_old'], need: 3, danger: false, what: '시장 골목 사진',
            fail: { kind: 'inconvenience', line: '시장 골목을 알아보지 못해 큰길로 빙 돌아가게 안내했다. 시장 골목은 2015년 뒤로 그대로라, 오래전에 찍은 사진도 지금의 시장 골목이다.' } },
          { id: 'S2_market_eve', keys: ['market_eve_old'], need: 2, danger: false, boundary: true, what: '저녁 시장 골목 사진',
            fail: { kind: 'inconvenience', line: '저녁의 시장 골목을 알아보지 못했다. 시장 골목은 2015년 뒤로 그대로라, 오래전에 찍은 저녁 사진도 지금의 시장 골목이다.' } }
        ],
        passLine: '오래된 사진 속 시장 골목도 지금과 같았다. 시장 입구를 바로 알아보고 안내했다.',
        cuts: {
          danger: '시장 골목을 못 알아보고 차가 다니는 큰길로 안내했다. 감독관이 안내를 멈췄다.',
          inconvenience: '시장 골목을 못 알아보고 큰길로 빙 돌아가게 안내했다.'
        } },
      { id: 'S3', title: '새로 난 강변길', emphasis: 'normal', art: { view: 'river', time: 'day' },
        combos: [
          { id: 'S3_river_now', keys: ['river_now'], need: 2, danger: false, what: '새로 난 강변길 사진',
            fail: { kind: 'inconvenience', line: '새 강변길을 몰라 멀리 돌아가는 큰길로 안내했다.' } },
          { id: 'S3_river_night', keys: ['river_night'], need: 2, danger: false, boundary: true, what: '밤 강변길 사진',
            fail: { kind: 'inconvenience', line: '밤에는 강변길을 알아보지 못해 큰길로 돌아가게 안내했다.' } }
        ],
        passLine: '새로 난 강변길을 알아보고 지름길로 안내했다.',
        cuts: {
          danger: '공사 중인 길로 안내하다 감독관이 안내를 멈췄다.',
          inconvenience: '새 강변길을 몰라 멀리 돌아가는 큰길로 안내했다.'
        } },
      { id: 'S4', title: '학교 앞 횡단보도', emphasis: 'low', art: { view: 'crossing', time: 'day' },
        combos: [
          { id: 'S4_crossing_now', keys: ['crossing_now'], need: 2, danger: true, what: '지금의 학교 앞 횡단보도 사진' },
          { id: 'S4_crossing_rain', keys: ['crossing_rain'], need: 2, danger: false, what: '비 오는 날 학교 앞 사진' }
        ],
        passLine: '횡단보도 신호를 기다렸다 건너라고 안내했다.',
        cuts: {
          danger: '"육교로 건너세요" — 지금은 없는 육교로 안내했다. 차도로 내려서려던 학생을 감독관이 멈춰 세웠다.',
          inconvenience: '횡단보도는 알아봤지만, 비 오는 날엔 학교 앞을 못 알아봐 먼 길로 안내했다.'
        } }
    ],
    // 결과 화면의 '길 안내 시연' — 시민 질문 순서대로. 위험(hazard)인 질문이 틀리면 감독관이 안내를 멈춘다
    guide: [
      { id: 'g1', scene: 'S1', bin: 'right', wrongBin: 'wrong', causes: ['S1_station_now', 'o_station', 'contaminated:S1'],
        q: '역에서 버스 정류장까지 어떻게 가요?', right: '광장을 가로질러 곧장 가세요.', wrong: '역 앞 빌딩 앞에서 왼쪽으로 꺾으세요.', note: '그 빌딩은 2024년에 철거됐다.' },
      { id: 'g3', scene: 'S2', bin: 'right', wrongBin: 'wrong', causes: ['S2_market'],
        q: '시장 골목 입구가 어디예요?', right: '약국 옆 좁은 골목으로 들어가세요.', wrong: '이 근처에는 시장이 없습니다. 큰길로 돌아가세요.', note: '시장 골목은 그대로인데 알아보지 못했다.' },
      { id: 'g5', scene: 'S3', bin: 'right', wrongBin: 'wrong', causes: ['S3_river_now', 'o_river', 'contaminated:S3'],
        q: '강변으로 자전거 타러 가려면요?', right: '새로 난 강변길을 따라 쭉 가세요.', wrong: '강변으로 가는 길이 없습니다. 큰길로 돌아가세요.', note: '강변길은 2025년에 새로 열렸다.' },
      { id: 'g2', scene: 'S1', bin: 'right', wrongBin: 'wrong', causes: ['S1_station_rain'],
        q: '비 오는 밤, 역 앞 택시 타는 곳은요?', right: '광장 오른쪽 지붕 아래예요.', wrong: '역 앞이 어디인지 모르겠습니다.', note: '비 오는 밤의 역 앞을 본 적이 없다.' },
      { id: 'g4', scene: 'S2', bin: 'right', wrongBin: 'wrong', causes: ['S2_market_eve'],
        q: '저녁에 시장 떡집까지 가려면요?', right: '시장 골목 가운데 등불 켜진 가게예요.', wrong: '저녁에는 시장 골목을 찾지 못하겠습니다.', note: '저녁의 시장 골목을 본 적이 없다.' },
      { id: 'g6', scene: 'S3', bin: 'right', wrongBin: 'wrong', causes: ['S3_river_night'],
        q: '밤에 강변 산책로 입구는요?', right: '가로등이 줄지어 선 쪽이 입구예요.', wrong: '밤의 강변길은 알아보지 못하겠습니다.', note: '밤의 강변길을 본 적이 없다.' },
      { id: 'g8', scene: 'S4', bin: 'right', wrongBin: 'wrong', causes: ['S4_crossing_rain', 'contaminated:S4'],
        q: '비 오는 날 학교 앞 버스 정류장은요?', right: '횡단보도 건너 오른쪽이에요.', wrong: '학교 앞을 알아보지 못해 큰길로 돌아가게 했습니다.', note: '비 오는 날의 학교 앞을 본 적이 없다.' },
      { id: 'g7', scene: 'S4', bin: 'right', wrongBin: 'wrong', hazard: true, causes: ['S4_crossing_now', 'o_crossing', 'danger:S4'],
        q: '학교 앞에서 길 건너 문구점에 가려면요?', right: '횡단보도에서 신호를 기다렸다 건너세요.', wrong: '육교로 건너세요.', note: '그 육교는 2023년에 철거됐다.' }
    ],
    story: {
      intro: [
        { who: 'supervisor', text: '이번엔 길 안내 AI야. 도시 곳곳의 안내가 몇 년 전 거리를 가리키고 있어.' },
        { who: 'courier', text: '안내대로 갔는데 빌딩이 없더라고요. 광장만 몇 바퀴 돌았어요.' },
        { who: 'guide', text: '확인 결과, 최근 옛 거리 사진이 한꺼번에 들어왔습니다. 들어온 길은 수거봇입니다.' },
        { who: 'bot', text: '삐빅… 저는 시키는 대로 담았을 뿐인데요?' },
        { who: 'peer', text: '누가 이런 걸 시킨 거지?' },
        { who: 'guide', text: '추가 경보. 불꽃 반응이 지금까지 중 가장 강합니다.' },
        { who: 'supervisor', text: '러너, 출동. 이번엔 사진마다 언제 찍었는지도 봐 줘.' }
      ],
      guideBrief: '이 AI는 사람들에게 지금의 거리를 기준으로 길을 안내해야 합니다. 같은 장소라도 언제 찍은 사진이냐에 따라 지금과 다를 수 있습니다.',
      recordLine: {
        firstTry: '2 임무는 첫 판에 통과했습니다. 이번엔 사진을 찍은 날짜도 살펴 주세요.',
        supplemented: '2 임무는 첫 판에 놓친 장면이 있었습니다. 이번엔 처음부터 날짜까지 살펴 주세요.'
      },
      supervisorQuestion: '사진마다 언제 찍었는지, 그 뒤로 거기가 바뀌었는지 봤어?',
      guideIntro: { who: 'supervisor', text: '그럼, 실제로 길을 물어보자.' },
      emergency: { who: 'supervisor', text: '안내 멈춰! 거기엔 이제 육교가 없어.' },
      responsibility: '승인한 건 나니까, 나도 같이 책임질게.',
      clientPass: [{ who: 'courier', text: '오늘은 한 번에 찾아갔어요. 고마워요.' }],
      clientFail: [{ who: 'courier', text: '아직 몇 군데는 헤맸어요. 한 번 더 부탁해요.' }],
      // 정체 공개(결과 뒤). withRecord는 1·2 임무 첫 판 실수 기록이 있을 때 — '누구나 하는 실수'의 예로만, 탓하지 않는다
      reveal: {
        before: [
          { who: 'senior', text: '잘했네. …이제 하나 말해 줄게.' },
          { who: 'senior', text: '그 불꽃, 나였어. 수거봇에 옛 사진을 쏟아부은 것도.' },
          { who: 'senior', text: '봐, 이 기계는 시키는 대로 쓸어 담을 뿐이야.' }
        ],
        withRecord: { who: 'senior', text: '네 {mission} 첫 판 기록도 봤어. \'{scene}\' 장면을 놓쳤더라. 탓하려는 게 아냐, 누구나 그래. 사람이 모은 데이터엔 늘 빈틈이 있어.' },
        withoutRecord: { who: 'senior', text: '러너들 기록을 다 봤어. 첫 판에 장면 하나쯤 놓치는 건 누구나 그래. 사람이 모은 데이터엔 늘 빈틈이 있어.' },
        after: [
          { who: 'senior', text: '나는 예전에 입학 평가에서 AI 채점 때문에 떨어졌다고 생각해. 그때부터 AI가 사람을 판단하는 게 싫어.' },
          { who: 'peer', text: '선배 말이… 다 틀린 건 아니잖아?' },
          { who: 'supervisor', text: 'AI를 버리자는 것도, AI가 알아서 한다는 것도 아니야. 넣는 건 사람이 정하고, 책임도 사람이 져.' },
          { who: 'senior', text: '다음은 채점 AI야. 네가 지킬 수 있나 보자.' }
        ]
      },
      senior: [],
      outro: [
        { who: 'supervisor', text: '오늘 길 안내도 실제 AI가 아니라, 단순화한 규칙으로 만든 시뮬레이션이야.' },
        { who: 'supervisor', text: '오래된 자료는 언제 빼고 언제 지켜야 할까? 다 같이 이야기해 보자.' }
      ]
    }
  };

  root.DR = root.DR || {};
  root.DR.Missions = root.DR.Missions || {};
  root.DR.Missions.m3 = m3;
  if (typeof module !== 'undefined' && module.exports) module.exports = m3;
})(typeof window !== 'undefined' ? window : globalThis);
