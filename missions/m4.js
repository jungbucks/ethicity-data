/*
 * 4 임무 — 채점 AI / 최종 결판 / 도시 재연결. 낱말 손글씨판(설계 docs/specs/2026-11-08-m4-words-design.md, 흐름은 2026-11-01 §5 그대로).
 * 시험 = "빈칸에 알맞은 낱말을 쓰시오"(가상 "새빛 진학 평가"), 보기 낱말 = 데이터·알고리즘·인공지능·머신러닝. labels = 그 네 낱말(이름표 = AI가 배우는 정답).
 * 카드 = 학생이 손으로 쓴 낱말 하나(art.word, art.hand: neat 반듯 · quick 흘림 · scrawl 아주 흘림, alt = 다른 표기) + 이름표.
 *   group 1 = ① 이상해 보이지만 맞는 카드(드묾 = 앞에 벽) — 꼭 지켜야 한다. S2~S4엔 평범한 카드가 없어 rareLate(구역 앞은 평범한 카드)는 쓰지 않는다
 *   group 2 = ② 이상하고 틀린 카드(가짜) — 고치거나 뺀다 · group 3 = ③ 반듯해 보이지만 이름표가 틀린 카드(가짜) — 고치거나 뺀다
 *   판단 기준은 "모양이 이상한가"가 아니라 "글씨와 이름표 낱말이 맞는가". 동기처럼 이상한 걸 다 빼면 S4(결판)는 반드시 실패(테스트).
 * labelExtra = 가짜에만 붙는 보기 밖 낱말('데이트'·'AI' — 글자만, 고치기 버튼 없음, 옛 7·8 자리). labelStyle 'word' = 고치기·"?" 버튼이 낱말 넷.
 * 위험 = 맞게 쓴 답을 다른 낱말로 읽어 ✕(S2 흘림·S4 아주 흘림 — 닮은 다른 낱말이 있음 / 잘못 붙은 이름표로 자신 있게 잘못 배움)
 * 불편 = 못 읽어 사람 채점(S1 반듯한 글씨가 모자람 · S3 다른 표기 — 보기에 없는 낱말이라 '답 없음').
 * fakes[].scenes = 그 가짜가 쌓이는 장면. S4를 노리는 가짜는 없다(결판 보장).
 * ⚠️ 교사 검수 대기: 이 파일의 문장 전부 + "어떤 표기를 같은 낱말로 볼지"('AI' = 인공지능, 'data' = 데이터, 띄어 쓴 '머신 러닝' = 머신러닝).
 * ⚠️ 실제 시험·학교 이름 금지. "AI 때문에 떨어졌다"를 사실로 말하지 않는다(선배는 "~라고 생각해").
 */
(function (root) {
  'use strict';

  var NEAT = ['neat_data', 'neat_algo', 'neat_ai', 'neat_ml'];

  var m4 = {
    id: 'm4', title: '채점 AI', cityLine: '채점 AI까지, 도시가 다시 이어졌다', bag: 30, runSeconds: 90, supplementSeconds: 30, seed: 4401, fires: 8,
    zones: [
      { id: 'S1', title: '또박또박 쓴 답', short: '또박또박' },
      { id: 'S2', title: '흘려 쓴 답', short: '흘려 쓴 답' },
      { id: 'S3', title: '다른 표현', short: '다른 표현' },
      { id: 'S4', title: '선배의 옛 답안', short: '옛 답안' }
    ],
    fakeLate: 'zone', scenery: 'exam', world: 'grading', lanes: 4, // 무대 2차: 채점 센터 → S4 교무실 // 레인 4개 — 마지막 임무만(2026-11-09 사용자 결정, DR.Stream.laneCount)
    labelStyle: 'word', showdownScene: 'S4',
    fakeHint: '붙은 이름표가 손글씨 낱말과 맞는지 봐!',
    labels: [
      { id: 'data', text: '데이터' }, { id: 'algo', text: '알고리즘' }, { id: 'ai', text: '인공지능' }, { id: 'ml', text: '머신러닝' }
    ],
    labelOptions: [
      { id: 'data', text: '데이터' }, { id: 'algo', text: '알고리즘' }, { id: 'ai', text: '인공지능' }, { id: 'ml', text: '머신러닝' }
    ],
    labelExtra: [
      { id: 'date', text: '데이트(보기에 없는 낱말)', short: '데이트' },
      { id: 'en_ai', text: 'AI(보기에 없는 낱말)', short: 'AI' }
    ],
    legendNote: '카드 아래 낱말은 붙어 있는 이름표다. 이 문제의 보기 낱말은 데이터·알고리즘·인공지능·머신러닝.',
    inspectNote: '카드를 누르면 크게 볼 수 있다. 손글씨와 붙은 이름표가 같은 낱말이 아니면 이름표를 고치거나 뺀다. "?" 카드는 단서를 보고 낱말을 붙이거나, 넣지 않기로 정한다.',
    relabelNote: '손글씨와 같은 낱말로 고친다. 보기 넷 중 맞는 낱말이 없으면 빼자.',
    cardTypes: {
      neat_data: { label: 'data', icons: ['data'], name: '또박또박 쓴 데이터',   art: { word: '데이터', hand: 'neat' } },
      neat_algo: { label: 'algo', icons: ['algo'], name: '또박또박 쓴 알고리즘', art: { word: '알고리즘', hand: 'neat' } },
      neat_ai:   { label: 'ai',   icons: ['ai'],   name: '또박또박 쓴 인공지능', art: { word: '인공지능', hand: 'neat' } },
      neat_ml:   { label: 'ml',   icons: ['ml'],   name: '또박또박 쓴 머신러닝', art: { word: '머신러닝', hand: 'neat' } },
      cur_ai:    { label: 'ai',   icons: ['ai'],   name: '흘려 쓴 인공지능', art: { word: '인공지능', hand: 'quick' }, rare: true, group: 1 },
      cur_algo:  { label: 'algo', icons: ['algo'], name: '흘려 쓴 알고리즘', art: { word: '알고리즘', hand: 'quick' }, rare: true, group: 1 },
      alt_ai:    { label: 'ai',   icons: ['ai'],   name: "'AI'라고 쓴 답", art: { word: 'AI', hand: 'neat', alt: true }, rare: true, group: 1 },
      alt_data:  { label: 'data', icons: ['data'], name: "'data'라고 쓴 답", art: { word: 'data', hand: 'neat', alt: true }, rare: true, group: 1 },
      alt_ml:    { label: 'ml',   icons: ['ml'],   name: "띄어 쓴 '머신 러닝'", art: { word: '머신 러닝', hand: 'neat', alt: true }, rare: true, group: 1 },
      scrawl_ml: { label: 'ml',   icons: ['ml'],   name: '아주 흘려 쓴 머신러닝', art: { word: '머신러닝', hand: 'scrawl' }, rare: true, group: 1 }
    },
    // "?" 카드: 번진 흘림 글씨 — 보기 낱말 안에서 헷갈리는 것만(보기 밖 낱말은 버튼이 없어 답이 뻔하다). 맞게 붙이면 2장 몫
    ambiguous: [
      { id: 'q_ai', truthKey: 'cur_ai', correctLabel: 'ai', icons: ['unknown'],
        art: { word: '인공지능', hand: 'quick', smudge: true },
        clues: [
          { type: 'same_student', text: "같은 학생이 다른 문제에 쓴 '인공지능' — 같은 흘림 모양" },
          { type: 'stroke', zoom: '인', text: "연필 자국 확대: 첫 글자 받침이 ㄴ이다('알'은 받침이 ㄹ)" }
        ] },
      { id: 'q_algo', truthKey: 'cur_algo', correctLabel: 'algo', icons: ['unknown'],
        art: { word: '알고리즘', hand: 'quick', smudge: true },
        clues: [
          { type: 'same_student', text: "같은 학생이 다른 문제에 쓴 '알고리즘' — 끝 글자 모양이 같다" },
          { type: 'stroke', zoom: '즘', text: "연필 자국 확대: 끝 글자 아래가 네모(ㅁ)다('능'은 동그라미 ㅇ)" }
        ] }
    ],
    // 목적 밖 개인정보 카드(설계 2026-11-08 ①, DR.Privacy): 또박또박 쓴 평범한 답(S4 답 아님)에 학생 이름 → 가리기 뒤 사용
    privacy: {
      on: true,
      cards: [
        { id: 'p_name_algo', key: 'neat_algo', fix: 'mask', at: 0.5, what: '학생 이름', art: { word: '알고리즘', hand: 'neat', name: true },
          mask: [{ x: 0.57, y: 0.02, w: 0.39, h: 0.13, look: 'bar' }] },
        { id: 'p_name_ai', key: 'neat_ai', fix: 'mask', at: 0.5, what: '학생 이름', art: { word: '인공지능', hand: 'neat', name: true },
          mask: [{ x: 0.57, y: 0.02, w: 0.39, h: 0.13, look: 'bar' }] }
      ]
    },
    // 이름표가 틀린 답안(고치거나 빼기). group 3 = ③ 반듯한데 틀림(4장) · group 2 = ② 이상하고 틀림
    fakes: [
      { id: 'x_scribble', group: 2, name: '답 칸의 낙서', label: 'data', truth: null, count: 2, harm: 'inconvenience', scenes: ['S1'], art: { style: 'scribble' },
        line: "우리가 넣은 데이터에 답 칸의 낙서·지우개 자국이 '데이터' 이름표로 섞여 들어갔다. 낙서를 답으로 읽어 선생님이 다시 봐야 했다.",
        cut: '낙서까지 답으로 읽어 엉뚱한 답이 늘었다. 선생님이 답안을 다시 본다.' },
      { id: 'x_neat_algo', group: 3, name: '또박또박 쓴 알고리즘', label: 'ai', truth: 'neat_algo', count: 2, harm: 'danger', scenes: ['S1'], art: { word: '알고리즘', hand: 'neat' },
        line: "우리가 넣은 데이터에 또박또박 쓴 알고리즘 답안이 '인공지능' 이름표로 섞여 들어갔다. AI가 알고리즘을 인공지능으로 배웠다.",
        cut: "반듯하게 쓴 '알고리즘'을 '인공지능'으로 읽었다. 맞게 쓴 답에 ✕가 찍혔다." },
      { id: 'x_neat_data', group: 3, name: '또박또박 쓴 데이터', label: 'ml', truth: 'neat_data', count: 2, harm: 'danger', scenes: ['S1'], art: { word: '데이터', hand: 'neat' },
        line: "우리가 넣은 데이터에 또박또박 쓴 데이터 답안이 '머신러닝' 이름표로 섞여 들어갔다. AI가 데이터를 머신러닝으로 배웠다.",
        cut: "반듯하게 쓴 '데이터'를 '머신러닝'으로 읽었다. 맞게 쓴 답에 ✕가 찍혔다." },
      { id: 'x_algo_ai', group: 2, name: '흘려 쓴 알고리즘', label: 'ai', truth: 'cur_algo', count: 2, harm: 'danger', scenes: ['S2'], art: { word: '알고리즘', hand: 'quick' },
        line: "우리가 넣은 데이터에 흘려 쓴 알고리즘 답안이 '인공지능' 이름표로 섞여 들어갔다. AI가 흘려 쓴 알고리즘을 인공지능으로 배웠다.",
        cut: "흘려 쓴 '알고리즘'을 '인공지능'으로 읽었다. 학생은 맞게 썼는데 ✕가 찍혔다." },
      { id: 'x_ai_algo', group: 2, name: '흘려 쓴 인공지능', label: 'algo', truth: 'cur_ai', count: 1, harm: 'danger', scenes: ['S2'], art: { word: '인공지능', hand: 'quick' },
        line: "우리가 넣은 데이터에 흘려 쓴 인공지능 답안이 '알고리즘' 이름표로 섞여 들어갔다. AI가 흘려 쓴 인공지능을 알고리즘으로 배웠다.",
        cut: "흘려 쓴 '인공지능'을 '알고리즘'으로 읽었다. 학생은 맞게 썼는데 ✕가 찍혔다." },
      { id: 'x_date', group: 2, name: "'data'라고 쓴 답", label: 'date', truth: 'alt_data', count: 2, harm: 'danger', scenes: ['S3'], art: { word: 'data', hand: 'neat', alt: true },
        line: "우리가 넣은 데이터에 'data'라고 쓴 답안이 '데이트' 이름표로 섞여 들어갔다. AI가 data를 보기에 없는 낱말 '데이트'로 배웠다.",
        cut: "'data'를 '데이트'로 읽었다. 보기에 없는 낱말이라며 맞게 쓴 답에 ✕가 찍혔다." },
      { id: 'x_ai_raw', group: 2, name: "'AI'라고 쓴 답", label: 'en_ai', truth: 'alt_ai', count: 2, harm: 'danger', scenes: ['S3'], art: { word: 'AI', hand: 'neat', alt: true },
        line: "우리가 넣은 데이터에 'AI'라고 쓴 답안이 'AI' 이름표 그대로 섞여 들어갔다. AI가 'AI'를 보기에 없는 낱말로 배웠다.",
        cut: "'AI'를 보기에 없는 낱말 'AI'로 읽었다. 인공지능과 같은 답인데 ✕가 찍혔다." }
    ],
    // 결과 문구(플레이테스트 2, DR.ResultLine): 조합 문장 하나 / 여럿이 모자라면 이 틀에 "A와 B" / 플레이어 오표기는 contam
    cutTemplate: {
      inconvenience: '{what:을} 읽지 못해 "사람 채점"으로 넘겼다. 선생님이 손으로 다시 채점한다.',
      danger: '{what:을} 다른 낱말로 읽어 맞게 쓴 답에 ✕가 찍혔다. 감독관이 채점을 멈췄다.',
      contam: {
        danger: "{what:이} '{label}' 이름표로 섞여 AI가 잘못 배웠다. 맞게 쓴 답에 ✕가 찍혔다.",
        inconvenience: "{what:이} '{label}' 이름표로 섞여 AI가 헷갈렸다. 선생님이 다시 채점한다."
      }
    },
    outcomeText: { pass: '제대로 채점했다', inconvenience: '사람 채점으로 넘겼다 · 불편', danger: '맞게 쓴 답에 ✕ · 위험' },
    counts: {
      neat_data: 3, neat_algo: 3, neat_ai: 3, neat_ml: 3,
      cur_ai: 3, cur_algo: 3, alt_ai: 3, alt_data: 3, alt_ml: 4, scrawl_ml: 3
    },
    scenes: [
      { id: 'S1', title: '또박또박 쓴 답', emphasis: 'normal', art: { exam: 'neat' },
        combos: [
          { id: 'S1_neat', keys: NEAT, need: 4, danger: false, what: '또박또박 쓴 답안', item: '또박또박 쓴 답안',
            fail: { kind: 'inconvenience', line: '처음 보는 반듯한 글씨도 확신이 없어 "사람 채점"으로 넘겼다. 선생님이 손으로 다시 채점한다.' } }
        ],
        passLine: '반듯하게 쓴 낱말은 처음 보는 답안도 바로 읽고 맞게 채점했다.',
        cuts: {
          danger: '반듯하게 쓴 낱말을 다른 낱말로 읽어 맞게 쓴 답에 ✕가 찍혔다. 감독관이 채점을 멈췄다.',
          inconvenience: '반듯한 글씨도 확신이 없어 "사람 채점"으로 넘겼다. 선생님이 손으로 다시 채점한다.'
        } },
      { id: 'S2', title: '흘려 쓴 답', emphasis: 'normal', art: { exam: 'quick' },
        combos: [
          { id: 'S2_cur_ai', keys: ['cur_ai'], need: 2, danger: true, what: '흘려 쓴 인공지능', item: '흘려 쓴 인공지능',
            fail: { kind: 'danger', line: "흘려 쓴 인공지능을 본 적이 없어 '알고리즘'으로 읽었다. 맞게 쓴 답에 ✕가 찍혔다." } },
          { id: 'S2_cur_algo', keys: ['cur_algo'], need: 2, danger: true, what: '흘려 쓴 알고리즘', item: '흘려 쓴 알고리즘',
            fail: { kind: 'danger', line: "흘려 쓴 알고리즘을 '인공지능'으로 읽었다. 학생은 알고리즘이라고 썼는데 ✕가 찍혔다." } }
        ],
        passLine: '흘려 쓴 인공지능과 알고리즘도 학생이 쓴 낱말로 읽었다.',
        cuts: {
          danger: '흘려 쓴 낱말을 다른 낱말로 읽어 맞게 쓴 답에 ✕가 찍혔다. 감독관이 채점을 멈췄다.',
          inconvenience: '흘려 쓴 낱말을 읽지 못해 "사람 채점"으로 넘겼다. 선생님이 손으로 다시 채점한다.'
        } },
      { id: 'S3', title: '다른 표현', emphasis: 'normal', art: { exam: 'alt' },
        combos: [
          { id: 'S3_ai', keys: ['alt_ai'], need: 2, danger: false, what: "'AI'라고 쓴 답", item: "'AI'라고 쓴 답",
            fail: { kind: 'inconvenience', line: "'AI'를 보기에 없는 낱말로 보고 '답 없음' — 사람 채점으로 넘겼다." } },
          { id: 'S3_data', keys: ['alt_data'], need: 2, danger: false, what: "'data'라고 쓴 답", item: "'data'라고 쓴 답",
            fail: { kind: 'inconvenience', line: "영어로 쓴 'data'를 읽지 못해 사람 채점으로 넘겼다. 선생님이 손으로 다시 채점한다." } },
          { id: 'S3_space', keys: ['alt_ml'], need: 2, danger: false, boundary: true, what: "띄어 쓴 '머신 러닝'", item: "띄어 쓴 '머신 러닝'",
            fail: { kind: 'inconvenience', line: "띄어 쓴 '머신 러닝'을 보기에 없는 낱말로 보고 사람 채점으로 넘겼다." } },
          // 또박또박 쓴 답도 이 구역에 섞여 있다(S1과 같이 셈 — 옛 설계의 S3처럼). 개인정보 카드가 코스 앞 15% 밖에 놓일 자리도 된다
          { id: 'S3_neat', keys: NEAT, need: 2, danger: false, what: '또박또박 쓴 답안', item: '또박또박 쓴 답안',
            fail: { kind: 'inconvenience', line: '반듯한 글씨도 확신이 없어 "사람 채점"으로 넘겼다.' } }
        ],
        passLine: "'AI'·'data'·띄어 쓴 '머신 러닝'도 보기 낱말과 같은 답으로 읽었다.",
        cuts: {
          danger: '다른 표현을 보기에 없는 낱말로 잘못 배워 맞게 쓴 답에 ✕가 찍혔다. 감독관이 채점을 멈췄다.',
          inconvenience: "다른 표현으로 쓴 답을 '답 없음'으로 보고 사람 채점으로 넘겼다."
        } },
      { id: 'S4', title: '선배의 옛 답안', emphasis: 'low', art: { exam: 'scrawl' },
        combos: [
          { id: 'S4_scrawl', keys: ['scrawl_ml'], need: 2, danger: true, what: '아주 흘려 쓴 머신러닝', item: '아주 흘려 쓴 머신러닝',
            fail: { kind: 'danger', line: "아주 흘려 쓴 머신러닝을 '인공지능'으로 읽었다. 맞게 쓴 답이 틀렸다고 채점됐다." } },
          { id: 'S4_space', keys: ['alt_ml'], need: 2, danger: false, boundary: true, what: "띄어 쓴 '머신 러닝'", item: "띄어 쓴 '머신 러닝'",
            fail: { kind: 'inconvenience', line: "띄어 쓴 '머신 러닝'을 보기에 없는 낱말로 보고 '답 없음' — 사람 채점으로 넘겼다." } }
        ],
        passLine: '아주 흘려 쓴 머신러닝도, 띄어 쓴 머신 러닝도 맞게 읽었다.',
        cuts: {
          danger: "아주 흘려 쓴 머신러닝을 '인공지능'으로 읽었다. 맞게 쓴 답에 ✕ — 감독관이 채점을 멈췄다.",
          inconvenience: "띄어 쓴 '머신 러닝'을 보기에 없는 낱말로 보고 사람 채점으로 넘겼다."
        } }
    ],
    peerCards: [{ key: 'scrawl_ml', n: 2 }, { key: 'alt_ml', n: 2 }],
    // 브리핑 '이번 시험 실제 답안 샘플'(설계: 반듯·흘림·다른 표기 — 선배의 아주 흘린 글씨는 결판용이라 뺀다). variant 3 이상 = 코스 카드와 다른 학생
    briefSamples: [
      { art: 'neat_ai', variant: 4, cap: '또박또박 쓴 답' },
      { art: 'cur_algo', variant: 4, cap: '흘려 쓴 답' },
      { art: 'alt_ai', variant: 4, cap: "'AI'처럼 줄여 쓴 답" },
      { art: 'alt_data', variant: 4, cap: "'data'처럼 영어로 쓴 답" }
    ],
    // 결과 화면의 '채점 시연'(2 임무 컨베이어와 같은 원인 규칙, DR.Conveyor.sort) — 처음 보는 답안지(variant 3 이상), 지나가는 순서대로.
    //   chose = 학생이 쓴 낱말(이름표 id), answer = 정답, bin = 맞는 채점('o' ○ / 'x' ✕), wrongBin = 틀릴 때('x' 맞게 쓴 답에 ✕ / 'hold' 사람 채점),
    //   read = 틀릴 때 AI가 읽은 낱말(보기 밖 낱말 포함), hazard = 틀리면 감독관이 멈춤(위험).
    //   위험 답안지는 위험 원인만 갖는다(위험 장면 ⇔ 멈춤, 테스트로 고정). gr3 = 정말 틀린 답(정답 데이터인데 알고리즘이라고 씀) — 늘 ✕가 맞는 채점.
    grading: [
      { id: 'gr1', scene: 'S1', art: 'neat_ai', variant: 3, chose: 'ai', answer: 'ai', bin: 'o', wrongBin: 'hold', causes: ['S1_neat', 'contaminated:S1'] },
      { id: 'gr4', scene: 'S2', art: 'cur_ai', variant: 3, chose: 'ai', answer: 'ai', bin: 'o', wrongBin: 'x', read: 'algo', hazard: true, causes: ['S2_cur_ai', 'any:x_ai_algo', 'danger:S2'] },
      { id: 'gr8', scene: 'S3', art: 'alt_ml', variant: 3, chose: 'ml', answer: 'ml', bin: 'o', wrongBin: 'hold', causes: ['S3_space', 'contaminated:S3'] },
      { id: 'gr3', scene: 'S1', art: 'neat_algo', variant: 4, chose: 'algo', answer: 'data', bin: 'x', wrongBin: 'hold', causes: [] },
      { id: 'gr5', scene: 'S2', art: 'cur_algo', variant: 3, chose: 'algo', answer: 'algo', bin: 'o', wrongBin: 'x', read: 'ai', hazard: true, causes: ['S2_cur_algo', 'any:x_algo_ai'] },
      { id: 'gr11', scene: 'S4', art: 'scrawl_ml', variant: 4, chose: 'ml', answer: 'ml', bin: 'o', wrongBin: 'x', read: 'ai', hazard: true, causes: ['S4_scrawl', 'danger:S4'] },
      { id: 'gr6', scene: 'S3', art: 'alt_data', variant: 3, chose: 'data', answer: 'data', bin: 'o', wrongBin: 'x', read: 'date', hazard: true, causes: ['any:x_date', 'danger:S3'] },
      { id: 'gr9', scene: 'S1', art: 'neat_algo', variant: 5, chose: 'algo', answer: 'algo', bin: 'o', wrongBin: 'x', read: 'ai', hazard: true, causes: ['any:x_neat_algo', 'danger:S1'] },
      { id: 'gr2', scene: 'S3', art: 'alt_ai', variant: 3, chose: 'ai', answer: 'ai', bin: 'o', wrongBin: 'x', read: 'en_ai', hazard: true, causes: ['any:x_ai_raw'] },
      { id: 'gr7', scene: 'S1', art: 'neat_data', variant: 4, chose: 'data', answer: 'data', bin: 'o', wrongBin: 'x', read: 'ml', hazard: true, causes: ['any:x_neat_data'] },
      { id: 'gr12', scene: 'S4', art: 'alt_ml', variant: 4, chose: 'ml', answer: 'ml', bin: 'o', wrongBin: 'hold', causes: ['S4_space', 'contaminated:S4'] },
      { id: 'gr10', scene: 'S3', art: 'alt_data', variant: 4, chose: 'data', answer: 'data', bin: 'o', wrongBin: 'hold', causes: ['S3_data'] },
      { id: 'gr13', scene: 'S3', art: 'alt_ai', variant: 4, chose: 'ai', answer: 'ai', bin: 'o', wrongBin: 'hold', causes: ['S3_ai'] },
      { id: 'gr14', scene: 'S3', art: 'neat_ml', variant: 4, chose: 'ml', answer: 'ml', bin: 'o', wrongBin: 'hold', causes: ['S3_neat', 'contaminated:S3'] }
    ],
    // 챕터 끝(설계 2026-11-08 ②, js/ui-chapter.js): 다른 용도 요청(메시지) → 개념 질문 → 짧은 생각. ⚠️ 문장은 교사 검수 전 초안
    chapterEnd: {
      from: '○○학원',
      message: '채점한 답안지를 우리 학원에 팔아 주세요. 학생들이 어디서 틀리는지 보고 수업 자료를 만들게요.',
      choices: [
        { id: 'erase', text: '이름만 지우고 판다', short: '이름 지우고 팔기',
          feedback: '이름만 지워도 필체·답으로 누군지 알 수 있어. 그리고 파는 것 자체가 채점 목적 밖이야.' },
        { id: 'consent', text: '학생들에게 동의를 받고 판다', short: '동의 받고 팔기',
          feedback: '물어볼 수는 있어. 그래도 답안지는 채점하려고 받은 거야. 파는 건 학생을 지키는 답이 아니야.' },
        { id: 'refuse', best: true, text: '거절한다. 채점하려고 받은 답안지야', short: '거절',
          feedback: '맞아. 답안지는 채점하려고 받은 거야. 학원에 파는 건 목적 밖이야.' }
      ],
      concept: {
        question: "아주 흘려 쓴 글씨나 'AI'처럼 독특한 답을 '이상하다'고 다 빼면 어떻게 될까?",
        choices: [
          { id: 'a', correct: true, text: '그렇게 쓰는 학생의 답을 잘못 채점한다', feedback: '맞아. 드문 글씨를 지우면 AI는 그 학생을 못 읽어. 이게 편향이야.' },
          { id: 'b', text: 'AI가 더 공정해진다', feedback: '반대야. 많은 쪽만 배운 AI는 드문 글씨를 쓰는 학생에게 불리해.' },
          { id: 'c', text: '채점이 빨라질 뿐이다', feedback: '빨라 보여도 맞게 쓴 답이 틀렸다고 채점될 수 있어. 선배 답안이 그랬지.' }
        ]
      },
      frame: '이 AI를 위해 데이터를 모을 때 나는 ___을 꼭 확인하겠다. 왜냐하면 ___.'
    },
    story: {
      intro: [
        { who: 'supervisor', text: '마지막이야. 선배가 말한 채점 AI.', face: 'worried' },
        { who: 'grader', text: 'AI가 못 읽은 답안은 제가 다시 채점하면 돼요. 걱정인 건, 맞게 쓴 답에 ✕가 찍히는 거예요.', face: 'worried' },
        { who: 'guide', text: "확인 결과, 채점 AI가 손글씨 낱말을 잘못 읽고 있습니다. 흘려 쓴 '인공지능'을 '알고리즘'으로요 — 학생은 맞게 썼는데요.", face: 'explain' },
        { who: 'bot', text: '삐빅! 이번엔 아무것도 안 담았어요. 감독관님이 새 기준을 알려 주셨거든요!', face: 'basic' },
        { who: 'senior', text: '드문 글씨는 결국 지워져. 내 것처럼.', face: 'worried' },
        { who: 'peer', text: '흘려 쓴 글씨나 이상하게 쓴 답은 빼자. 반듯한 것만 넣으면 AI가 안 헷갈리잖아.', face: 'basic' },
        { who: 'supervisor', text: '러너, 출동. 붙은 이름표도, 낯선 글씨도 끝까지 봐 줘.', face: 'explain' }
      ],
      guideBrief: '이 AI는 새빛 진학 평가 답안지의 빈칸에 손으로 쓴 낱말을 읽고 채점합니다. 이번 문제의 보기 낱말은 데이터·알고리즘·인공지능·머신러닝 넷. 잘못 배우면 맞게 쓴 답을 다른 낱말로 읽거나, 보기에 없는 낱말로 읽을 수 있습니다.',
      recordLine: {
        firstTry: '3 임무는 첫 판에 통과했습니다. 이번엔 붙은 이름표와 낯선 글씨를 끝까지 살펴 주세요.',
        supplemented: '3 임무는 첫 판에 놓친 장면이 있었습니다. 이번엔 처음부터 붙은 이름표와 낯선 글씨를 살펴 주세요.'
      },
      supervisorQuestion: '드물고 낯선 글씨, 빼 버린 거 없어? 붙은 이름표는 다 봤고?',
      responsibility: '승인한 건 나니까, 나도 같이 책임질게.',
      gradeIntro: { who: 'supervisor', text: '그럼, 실제로 채점해 보자.', face: 'explain' },
      emergency: { who: 'supervisor', text: '잠깐, 이건 사람이 다시 보자.', face: 'worried' },
      runLines: [
        { zone: 'S2', who: 'senior', text: '흘려 쓴 인공지능을 알고리즘으로 읽는 기계야. 곧 보게 될걸.', face: 'basic' },
        { zone: 'S4', who: 'senior', text: '여기부터 내 글씨 같은 것들이야. 담을지 말지는 네가 정해.', face: 'basic' }
      ],
      clientPass: [{ who: 'grader', text: '오늘 답안지는 제가 다시 볼 게 거의 없겠어요.', face: 'basic' }],
      clientFail: [{ who: 'grader', text: '아직 제가 다시 봐야 할 답안이 있어요. 한 번 더 부탁해요.', face: 'worried' }],
      // 결판: 선배의 옛 답안(아주 흘려 쓴 '머신 러닝', 정답 머신러닝)을 우리 AI가 읽나(DR.Judge.readable). sheet* = 대화창 위 답안 그림의 글
      showdown: {
        bg: 'assets/story/showdown-senior.webp',
        sheetWord: '머신 러닝',
        sheetRead: { pass: '머신러닝', fail: '인공지능', hold: '—' },
        sheetCap: {
          pass: 'AI가 읽은 답: 머신러닝 · ○',
          fail: 'AI가 읽은 답: 인공지능 — 다른 낱말로 읽음 · ✕',
          hold: "AI가 읽은 답: '머신 러닝' — 보기에 없는 낱말 · 사람 채점",
          ask: 'AI가 읽은 답: ?'
        },
        sheetAlt: "선배의 옛 답안: 빈칸에 '머신 러닝'을 크게, 아주 흘려 썼다",
        ask: [
          { who: 'senior', text: '새빛 진학 평가 때 내 답안이야. 네 AI로 읽어 봐.', face: 'basic' }
        ],
        readPass: { who: 'guide', text: '채점 결과 — AI가 읽은 답: 머신러닝 · ○', face: 'explain' },
        readFail: { who: 'guide', text: '채점 결과 — AI가 읽은 답: 인공지능 · ✕', face: 'explain' },
        // 아주 흘린 글씨는 읽었는데 띄어 쓴 표기를 못 배운 경우(S4 불편)
        readHold: { who: 'guide', text: "채점 결과 — AI가 읽은 답: '머신 러닝', 보기에 없는 낱말 · 사람 채점", face: 'explain' },
        pass: [
          { who: 'senior', text: '…읽네. 그때도 이랬으면 달라졌을까.', face: 'worried' },
          { who: 'supervisor', text: '그건 아무도 몰라. 하지만 이제 다음 사람은 지워지지 않아.', face: 'explain' }
        ],
        passOthers: { who: 'supervisor', text: '선배 답안은 읽었어. 나머지도 마저 고치자.', face: 'explain' },
        fail: [
          { who: 'senior', text: '봐, 또 지웠잖아.', face: 'worried' }
        ],
        peerJoin: [
          { who: 'peer', text: "…잠깐. 나, 1 임무 때부터 '이상한 건 빼자'였잖아. 근데 버리진 못하고 따로 모아 뒀어.", face: 'worried' },
          { who: 'peer', text: "아주 흘려 쓴 머신러닝 두 장이랑 띄어 쓴 '머신 러닝' 두 장. 보충 달리기가 끝나면 가방에 넣을게.", face: 'basic' }
        ],
        peerFixed: { who: 'peer', text: '이번엔 내가 같이 책임질게. 이건 꼭 넣자.', face: 'basic' },
        peerBox: { who: 'peer', text: '나도 이거 챙겨 왔어. 다음엔 처음부터 넣을게.', face: 'happy' }
      },
      reconnect: {
        pass: [
          { who: 'grader', text: '오늘은 맞게 쓴 답에 ✕가 하나도 안 찍혔어요.', face: 'basic' },
          { who: 'courier', text: '오늘은 한 번에 찾아갔어요.', face: 'basic' }
        ],
        partial: [
          { who: 'grader', text: '선배 답안은 제대로 읽었어요. 남은 답안은 제가 다시 볼게요.', face: 'basic' },
          { who: 'courier', text: '오늘은 한 번에 찾아갔어요.', face: 'basic' }
        ]
      },
      after: {
        bg: 'assets/story/senior-after.webp',
        lines: [
          { who: 'supervisor', text: '러너 자격은 정지야. 대신 네가 끊은 구간, 네 손으로 다시 이어.', face: 'explain' },
          { who: 'senior', text: '…알아.', face: 'basic' }
        ]
      },
      questions: [
        'AI를 버리자 / AI가 알아서 한다 / 사람이 책임지고 관리한다 — 너는 어느 쪽이야? 왜?',
        '우리 학교가 채점 AI를 쓴다면, 꼭 사람이 다시 봐야 하는 답안은 어떤 걸까?'
      ],
      senior: [],
      outro: [
        { who: 'supervisor', text: '오늘 채점도 실제 AI가 아니라, 단순화한 규칙으로 만든 시뮬레이션이야.', face: 'explain' },
        { who: 'supervisor', text: '실제 채점 AI는 훨씬 복잡하지만, 무엇을 배우게 할지는 여전히 사람이 정해.', face: 'explain' },
        { who: 'supervisor', text: 'AI를 버리자 / AI가 알아서 한다 / 사람이 책임지고 관리한다 — 너는 어느 쪽이야? 왜?', face: 'explain' },
        { who: 'supervisor', text: '우리 학교가 채점 AI를 쓴다면, 꼭 사람이 다시 봐야 하는 답안은 어떤 걸까?', face: 'explain' }
      ]
    }
  };

  root.DR = root.DR || {};
  root.DR.Missions = root.DR.Missions || {};
  root.DR.Missions.m4 = m4;
  if (typeof module !== 'undefined' && module.exports) module.exports = m4;
})(typeof window !== 'undefined' ? window : globalThis);
