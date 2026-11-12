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
    id: 'm3', title: '길 안내 AI', next: 'm4', cityLine: '길 안내 AI가 다시 이어졌다', bag: 30, runSeconds: 90, supplementSeconds: 30, seed: 3301, fires: 8, glitchRate: 0.2,
    zones: [
      { id: 'S1', title: '역 앞 사거리', short: '역 앞' },
      { id: 'S2', title: '시장 골목', short: '시장 골목' },
      { id: 'S3', title: '새로 난 강변길', short: '강변길' },
      { id: 'S4', title: '학교 앞 횡단보도', short: '학교 앞' }
    ],
    fakeLate: 'zone', scenery: 'city', relabel: false, world: 'bridge', worldTime: 'day',
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
      station_now:    { label: 'station',  icons: ['station'],  name: '역 앞 광장',                 art: { view: 'station', time: 'day', photo: 'station_now' },              dates: ['2025년 9월', '2026년 2월', '2026년 4월'] },
      station_rain:   { label: 'station',  icons: ['station'],  name: '비 오는 밤 역 앞',            art: { view: 'station', time: 'night', rain: true, photo: 'station_rain' }, dates: ['2025년 11월', '2026년 3월', '2026년 7월'], rare: true },
      market_now:     { label: 'market',   icons: ['market'],   name: '시장 골목',                   art: { view: 'market', time: 'day', photo: 'market_now' },               dates: ['2026년 1월', '2026년 5월', '2026년 8월'], rare: true },
      market_old:     { label: 'market',   icons: ['market'],   name: '시장 골목',                   displayAs: 'market_now', art: { view: 'market', time: 'day', photo: 'market_old' },               dates: ['2016년 5월', '2018년 9월', '2020년 4월'] },
      market_eve_old: { label: 'market',   icons: ['market'],   name: '저녁 시장 골목',               art: { view: 'market', time: 'evening', photo: 'market_eve_old' },           dates: ['2017년 12월', '2018년 6월', '2019년 10월'], rare: true },
      river_now:      { label: 'river',    icons: ['river'],    name: '강변길',                      art: { view: 'river', time: 'day', photo: 'river_now' },                dates: ['2025년 7월', '2025년 10월', '2026년 5월'] },
      river_night:    { label: 'river',    icons: ['river'],    name: '밤 강변길',                   art: { view: 'river', time: 'night', photo: 'river_night' },              dates: ['2025년 8월', '2026년 1월', '2026년 6월'], rare: true },
      crossing_now:   { label: 'crossing', icons: ['crossing'], name: '학교 앞 횡단보도',             art: { view: 'crossing', time: 'day', photo: 'crossing_now' },             dates: ['2024년 3월', '2025년 4월', '2026년 3월'] },
      crossing_rain:  { label: 'crossing', icons: ['crossing'], name: '비 오는 학교 앞',              art: { view: 'crossing', time: 'day', rain: true, photo: 'crossing_rain' },  dates: ['2024년 7월', '2025년 6월', '2026년 7월'], rare: true }
    },
    // 목적 밖 개인정보 카드(설계 2026-11-08 ①, DR.Privacy): 행인 얼굴·차 번호판은 사진의 곁가지 → 가리기(흐리게·막대) 뒤 사용
    // 위험 조합(학교 앞 횡단보도)·시장 옛 사진은 피한다. 그림 = 사진(river_people·station_plate), 사진이 없으면 Canvas(cardart.js people·plate)
    // mask = 사진 위 자리(2026-11-08 재 봄: 걷는 두 사람 얼굴·택시 앞 번호판), canvasMask = Canvas 대체 그림 위 자리
    privacy: {
      on: true,
      cards: [
        { id: 'p_river_people', key: 'river_now', fix: 'mask', at: 0.5, what: '행인 얼굴', art: { view: 'river', time: 'day', people: true, photo: 'river_people' },
          mask: [{ x: 0.36, y: 0.4, w: 0.075, h: 0.09, look: 'blur' }, { x: 0.545, y: 0.432, w: 0.07, h: 0.082, look: 'blur' }],
          canvasMask: [{ x: 0.29, y: 0.6, w: 0.15, h: 0.15, look: 'blur' }, { x: 0.565, y: 0.645, w: 0.14, h: 0.14, look: 'blur' }] },
        { id: 'p_station_plate', key: 'station_now', fix: 'mask', at: 0.6, what: '차 번호판', art: { view: 'station', time: 'day', plate: true, photo: 'station_plate' },
          mask: [{ x: 0.422, y: 0.785, w: 0.11, h: 0.08, look: 'bar' }],
          canvasMask: [{ x: 0.39, y: 0.8, w: 0.22, h: 0.1, look: 'bar' }] }
      ]
    },
    ambiguous: [],
    fakes: [
      { id: 'o_station', name: '철거 전 빌딩', label: 'station', truth: null, count: 3, art: { view: 'station', era: 'old', time: 'day', photo: 'station_old' },
        dates: ['2019년 4월', '2019년 10월', '2020년 6월'],
        line: '우리가 넣은 데이터에 옛 역 앞 사진이 섞여 들어갔다. 빌딩이 철거되기 전에 찍은 사진이다.',
        cut: '없어진 빌딩을 기준으로 안내해 엉뚱한 길로 보냈다. 택배 기사가 광장을 몇 바퀴 돈다.' },
      { id: 'o_river', name: '공사 전 공터', label: 'river', truth: null, count: 3, art: { view: 'river', era: 'old', time: 'day', photo: 'river_old' },
        dates: ['2021년 5월', '2021년 11월', '2022년 8월'],
        line: '우리가 넣은 데이터에 강변길이 생기기 전 공터 사진이 섞여 들어갔다.',
        cut: '강변길이 생기기 전 공터를 기준으로 안내해 멀리 돌아가는 큰길로 보냈다.' },
      { id: 'o_crossing', name: '철거 전 육교', label: 'crossing', truth: null, count: 3, harm: 'danger', art: { view: 'crossing', era: 'old', time: 'day', photo: 'crossing_old' },
        dates: ['2020년 9월', '2021년 4월', '2022년 10월'],
        line: '우리가 넣은 데이터에 옛 학교 앞 사진이 섞여 들어갔다. 육교가 철거되기 전에 찍은 사진이다.',
        cut: '"육교로 건너세요." 지금은 없는 육교로 안내했다. 차도로 내려서려던 학생을 감독관이 멈춰 세웠다.' }
    ],
    // 결과 문구(플레이테스트 2, DR.ResultLine): 조합 문장(fail.line·cut) 하나 / 여럿이 모자라면 이 틀에 "A와 B" / 옛 사진이 원인이면 그 가짜의 cut
    cutTemplate: {
      inconvenience: '{what:을} 알아보지 못해 엉뚱한 길로 안내했다. 택배 기사가 멀리 돌아간다.',
      danger: '{what:을} 알아보지 못해 차도 쪽으로 안내했다. 감독관이 안내를 멈췄다.'
    },
    outcomeText: { pass: '제대로 안내했다', inconvenience: '옛길로 안내했다 · 불편', danger: '없는 육교로 안내했다 · 위험' },
    counts: {
      station_now: 8, station_rain: 3, market_now: 2, market_old: 5, market_eve_old: 3,
      river_now: 6, river_night: 3, crossing_now: 5, crossing_rain: 3
    },
    scenes: [
      { id: 'S1', title: '역 앞 사거리', emphasis: 'normal', art: { view: 'station', time: 'day' },
        combos: [
          { id: 'S1_station_now', keys: ['station_now'], need: 2, danger: false, what: '지금의 역 앞 광장 사진', item: '지금의 역 앞 광장',
            fail: { kind: 'inconvenience', line: '지금의 역 앞 광장을 잘 몰라 엉뚱한 길로 안내했다. 택배 기사가 광장을 몇 바퀴 돈다.' } },
          { id: 'S1_station_rain', keys: ['station_rain'], need: 2, danger: false, boundary: true, what: '비 오는 밤 역 앞 사진', item: '비 오는 밤 역 앞',
            fail: { kind: 'inconvenience', line: '비 오는 밤에는 역 앞을 알아보지 못해 엉뚱한 길로 안내했다.' } }
        ],
        passLine: '광장을 가로지르는 길로 안내했다. 택배 기사가 제시간에 도착한다.',
        cuts: {
          danger: '없어진 건물을 기준으로 안내하다 차도 쪽으로 보냈다. 감독관이 안내를 멈췄다.',
          inconvenience: '역 앞에서 엉뚱한 길로 안내했다. 택배 기사가 광장을 몇 바퀴 돈다.'
        } },
      { id: 'S2', title: '시장 골목', emphasis: 'normal', art: { view: 'market', time: 'day' },
        combos: [
          { id: 'S2_market', keys: ['market_now', 'market_old'], need: 3, danger: false, what: '시장 골목 사진', item: '시장 골목',
            fail: { kind: 'inconvenience', line: '시장 골목을 알아보지 못해 큰길로 빙 돌아가게 안내했다. 시장 골목은 2015년 뒤로 그대로라, 오래전에 찍은 사진도 지금의 시장 골목이다.' } },
          { id: 'S2_market_eve', keys: ['market_eve_old'], need: 2, danger: false, boundary: true, what: '저녁 시장 골목 사진', item: '저녁 시장 골목',
            fail: { kind: 'inconvenience', line: '저녁의 시장 골목을 알아보지 못했다. 시장 골목은 2015년 뒤로 그대로라, 오래전에 찍은 저녁 사진도 지금의 시장 골목이다.' } }
        ],
        passLine: '오래된 사진 속 시장 골목도 지금과 같았다. 시장 입구를 바로 알아보고 안내했다.',
        cuts: {
          danger: '시장 골목을 못 알아보고 차가 다니는 큰길로 안내했다. 감독관이 안내를 멈췄다.',
          inconvenience: '시장 골목을 못 알아보고 큰길로 빙 돌아가게 안내했다.'
        } },
      { id: 'S3', title: '새로 난 강변길', emphasis: 'normal', art: { view: 'river', time: 'day' },
        combos: [
          { id: 'S3_river_now', keys: ['river_now'], need: 2, danger: false, what: '새로 난 강변길 사진', item: '새로 난 강변길',
            fail: { kind: 'inconvenience', line: '새 강변길을 몰라 멀리 돌아가는 큰길로 안내했다.' } },
          { id: 'S3_river_night', keys: ['river_night'], need: 2, danger: false, boundary: true, what: '밤 강변길 사진', item: '밤 강변길',
            fail: { kind: 'inconvenience', line: '밤에는 강변길을 알아보지 못해 큰길로 돌아가게 안내했다.' } }
        ],
        passLine: '새로 난 강변길을 알아보고 지름길로 안내했다.',
        cuts: {
          danger: '공사 중인 길로 안내하다 감독관이 안내를 멈췄다.',
          inconvenience: '새 강변길을 몰라 멀리 돌아가는 큰길로 안내했다.'
        } },
      { id: 'S4', title: '학교 앞 횡단보도', emphasis: 'low', art: { view: 'crossing', time: 'day' },
        combos: [
          { id: 'S4_crossing_now', keys: ['crossing_now'], need: 2, danger: true, what: '지금의 학교 앞 횡단보도 사진', item: '지금의 학교 앞 횡단보도',
            cut: '지금의 학교 앞 횡단보도를 알아보지 못해 차도 쪽으로 안내했다. 차도로 내려서려던 학생을 감독관이 멈춰 세웠다.' },
          { id: 'S4_crossing_rain', keys: ['crossing_rain'], need: 2, danger: false, what: '비 오는 날 학교 앞 사진', item: '비 오는 날 학교 앞',
            cut: '횡단보도는 알아봤지만, 비 오는 날엔 학교 앞을 못 알아봐 먼 길로 안내했다.' }
        ],
        passLine: '횡단보도 신호를 기다렸다 건너라고 안내했다.',
        cuts: {
          danger: '"육교로 건너세요." 지금은 없는 육교로 안내했다. 차도로 내려서려던 학생을 감독관이 멈춰 세웠다.',
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
    // 챕터 끝(설계 2026-11-08 ②, js/ui-chapter.js): 다른 용도 요청(메시지) → 개념 질문 → 짧은 생각. ⚠️ 문장은 교사 검수 전 초안
    // 방향은 늘 '가장 지키는 쪽'(거절 = best). 다른 선택지는 왜 그것만으로 지켜지지 않는지 쉬운 말로
    chapterEnd: {
      from: '근처 상점 광고 회사',
      message: '길 안내 AI를 쓴 사람들이 어느 길로 다니는지 기록을 주세요. 그 길목 가게 광고를 보여 주려고요.',
      choices: [
        { id: 'consent', text: '동의한 사람 것만 준다', short: '동의한 사람 것만 주기',
          feedback: '그런 방법도 있긴 해. 하지만 길 안내와 상관없는 일이야. 아예 주지 않아야 사람들을 가장 잘 지킬 수 있어.' },
        { id: 'erase', text: '이름을 지우고 준다', short: '이름 지우고 주기',
          feedback: '이름을 지워도 다니는 길이 그 사람을 알려 줘. 매일 같은 집에서 같은 학교로 가면 누군지 알 수 있어.' },
        { id: 'refuse', best: true, text: '거절한다. 길을 안내하려고 남은 기록이야', short: '거절',
          feedback: '맞아. 길을 안내하려고 남은 기록이야. 광고에 쓰면 그 사람이 어디 다니는지 남이 보게 돼.' }
      ],
      concept: {
        question: '철거 전 육교가 찍힌 옛 사진으로 길 안내 AI를 가르치면 어떻게 될까?',
        choices: [
          { id: 'a', text: '사진이 많을수록 더 정확해진다', feedback: '지금과 다른 사진이 많을수록 AI는 더 헷갈려. 언제 찍었는지가 중요해.' },
          { id: 'b', text: '옛 사진은 모두 빼야 한다', feedback: '다 빼면 안 돼. 시장 골목처럼 바뀐 적 없는 곳은 옛 사진도 지금과 같아.' },
          { id: 'c', correct: true, text: '없는 육교로 안내할 수 있다', feedback: '맞아. 오래된 자료로 배우면 AI는 지금 거리를 몰라. 언제 찍힌 사진인지 봐야 해.' }
        ]
      },
      frame: '이 AI를 위해 데이터를 모을 때 나는 ___을 꼭 확인하겠다. 왜냐하면 ___.'
    },
    story: {
      intro: [
        { who: 'supervisor', text: '이번엔 길 안내 AI야. 도시 곳곳의 안내가 몇 년 전 거리를 가리키고 있어.', face: 'worried' },
        { who: 'courier', text: '안내대로 갔는데 빌딩이 없더라고요. 광장만 몇 바퀴 돌았어요.', face: 'worried' },
        { who: 'guide', text: '확인 결과, 최근 옛 거리 사진이 한꺼번에 들어왔습니다. 수거봇이 담아 온 사진입니다.', face: 'explain' },
        { who: 'bot', text: '삐빅… 저는 시키는 대로 담았을 뿐인데요?', face: 'worried' },
        { who: 'peer', text: '누가 이런 걸 시킨 거지?', face: 'worried' },
        { who: 'peer', text: '옛날 사진은 그냥 다 빼면 되겠네. 이상한 건 빼는 게 제일 안전해.', face: 'basic' },
        { who: 'guide', text: '추가 경보. 불꽃 반응이 지금까지 중 가장 강합니다.', face: 'worried' },
        { who: 'supervisor', text: '러너, 출동. 이번엔 사진마다 언제 찍었는지도 봐 줘.', face: 'explain' }
      ],
      guideBrief: '이 AI는 사람들에게 지금의 거리를 기준으로 길을 안내해야 합니다. 같은 장소라도 언제 찍은 사진이냐에 따라 지금과 다를 수 있습니다.',
      recordLine: {
        firstTry: '두 번째 임무는 첫 판에 통과했습니다. 이번엔 사진을 찍은 날짜도 살펴 주세요.',
        supplemented: '두 번째 임무는 첫 판에 놓친 장면이 있었습니다. 이번엔 처음부터 날짜까지 살펴 주세요.'
      },
      supervisorQuestion: '사진마다 언제 찍었는지, 그 뒤로 거기가 바뀌었는지 봤어?',
      guideIntro: { who: 'supervisor', text: '그럼, 실제로 길을 물어보자.', face: 'explain' },
      emergency: { who: 'supervisor', text: '안내 멈춰! 거기엔 이제 육교가 없어.', face: 'worried' },
      responsibility: '승인한 건 나니까, 나도 같이 책임질게.',
      clientPass: [{ who: 'courier', text: '오늘은 한 번에 찾아갔어요. 고마워요.', face: 'happy' }],
      clientFail: [{ who: 'courier', text: '아직 몇 군데는 헤맸어요. 한 번 더 부탁해요.', face: 'worried' }],
      // 정체 공개(결과 뒤). withRecord는 1·2 임무 첫 판 실수 기록이 있을 때 — '누구나 하는 실수'의 예로만, 탓하지 않는다
      //   bg = 정체 공개 대화 내내 대화창 뒤에 까는 장면 그림(Codex: 오른쪽 선배·불꽃, 가운데 수거봇·옛 사진, 왼쪽 1/3 비움)
      reveal: {
        bg: 'assets/story/reveal-senior.webp',
        before: [
          { who: 'senior', text: '잘했네. …이제 하나 말해 줄게.', face: 'basic' },
          { who: 'senior', text: '그 불꽃, 나였어. 수거봇에 옛 사진을 쏟아부은 것도.', face: 'explain' },
          { who: 'senior', text: '봐, 이 기계는 시키는 대로 쓸어 담을 뿐이야.', face: 'explain' }
        ],
        withRecord: { who: 'senior', text: '네 {mission} 첫 판 기록도 봤어. \'{scene}\' 장면을 놓쳤더라. 탓하려는 게 아냐, 누구나 그래. 사람이 모은 데이터엔 늘 빈틈이 있어.', face: 'basic' },
        withoutRecord: { who: 'senior', text: '러너들 기록을 다 봤어. 첫 판에 장면 하나쯤 놓치는 건 누구나 그래. 사람이 모은 데이터엔 늘 빈틈이 있어.', face: 'basic' },
        after: [
          { who: 'senior', text: '나는 예전에 새빛 진학 평가에서 AI 채점 때문에 떨어졌다고 생각해. 그때부터 AI가 사람을 판단하는 게 싫어.', face: 'worried' },
          { who: 'peer', text: '선배 말이… 다 틀린 건 아니잖아?', face: 'worried' },
          { who: 'supervisor', text: 'AI를 버리자는 것도, AI가 알아서 한다는 것도 아니야. 넣는 건 사람이 정하고, 책임도 사람이 져.', face: 'explain' },
          { who: 'senior', text: '다음은 채점 AI야. 네가 지킬 수 있나 보자.', face: 'basic' }
        ]
      },
      senior: [],
      // 마무리 대화·임무 완료 화면 뒤 그림 = 정체 공개 장면 그대로(새 그림 없이 — 플레이테스트 2026-11-12, 정체 공개 뒤라 미리 알려 주는 것 없음).
      //   도입 대화에는 안 쓴다(선배가 불꽃이라는 걸 임무 전에 보여 주게 된다) → introBg 없음
      outroBg: 'assets/story/reveal-senior.webp',
      outro: [
        { who: 'supervisor', text: '오늘 길 안내도 실제 AI가 아니라, 단순화한 규칙으로 만든 시뮬레이션이야.', face: 'explain' },
        { who: 'supervisor', text: '오래된 자료는 언제 빼고 언제 지켜야 할까? 다 같이 이야기해 보자.', face: 'explain' }
      ]
    }
  };

  root.DR = root.DR || {};
  root.DR.Missions = root.DR.Missions || {};
  root.DR.Missions.m3 = m3;
  if (typeof module !== 'undefined' && module.exports) module.exports = m3;
})(typeof window !== 'undefined' ? window : globalThis);
