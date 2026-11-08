/*
 * 4 임무 — 채점 AI / 최종 결판 / 도시 재연결(기획서 §8, 설계 2026-11-01 §5). 장면·조합·카드 수·대사·채점 시연 답안지는 여기서 고친다.
 * 시험은 객관식(가상 "새빛 진학 평가"), 답 = 선택지 번호 1~5. labels = 그 다섯 번호(이름표 = AI가 배우는 정답).
 * 채점 AI는 원래 숫자 0~9를 읽는 AI라서, 잘못 배우면 선택지에 없는 번호(7·8)로 읽어 ✕를 찍는다.
 *   labelExtra = 가짜 카드에만 붙는 선택지 밖 번호(글자·아이콘만, 고치기 버튼 없음). labelOptions = "?" 카드 버튼(1~5).
 *   labelStyle 'digit' = 이름표 고치기 버튼을 동그라미 숫자 하나로(375px 폰에서 다섯 개 한 줄, 설계 §5.5).
 * 위험 = 맞게 쓴 답을 틀렸다고 채점(S2·S4 — 닮은 숫자가 있는 장면) / 불편 = 못 읽어 사람이 다시 채점(S1·S3).
 * fakes[].scenes = 그 가짜가 쌓이는 장면(설계 §5.10). '7'·'8'은 어느 종류의 이름표도 아니라서 데이터로 정한다.
 *   붙은 이름표를 플레이어가 바꾸면 바뀐 이름표 기준(DR.Cards.fakeScenes). S4를 노리는 가짜는 없다(결판 보장, 설계 §5.6).
 * showdownScene = 결판(선배의 옛 답안을 읽었나 = 그 장면의 조합이 다 찼나, DR.Judge.readable).
 * peerCards = 결판에서 못 읽었을 때 동기가 내놓는 카드(크게 기운 1 ×2 · 표 안 답 ×2).
 * 종류 이름에 '헷갈리는·틀린·못 쓴' 같은 말을 쓰지 않는다(미리 알려 주지 않게). 독특한 필체 = 개성 있는 글씨.
 * ⚠️ 실제 시험·학교 이름 금지. "AI 때문에 떨어졌다"를 사실로 말하지 않는다(선배는 "~라고 생각해").
 */
(function (root) {
  'use strict';

  var NEAT = ['neat_1', 'neat_2', 'neat_3', 'neat_4', 'neat_5'];

  var m4 = {
    id: 'm4', title: '채점 AI', cityLine: '채점 AI까지, 도시가 다시 이어졌다', bag: 30, runSeconds: 90, supplementSeconds: 30, seed: 4401, fires: 8,
    zones: [
      { id: 'S1', title: '또박또박 쓴 답', short: '또박또박' },
      { id: 'S2', title: '흘려 쓴 답', short: '흘려 쓴 답' },
      { id: 'S3', title: '교과서와 다른 풀이', short: '다른 풀이' },
      { id: 'S4', title: '선배의 옛 답안', short: '옛 답안' }
    ],
    fakeLate: 'zone', scenery: 'exam', labelStyle: 'digit', showdownScene: 'S4',
    fakeHint: '붙은 번호가 손글씨와 맞는지 봐!',
    labels: [
      { id: '1', text: '1번' }, { id: '2', text: '2번' }, { id: '3', text: '3번' }, { id: '4', text: '4번' }, { id: '5', text: '5번' }
    ],
    labelOptions: [
      { id: '1', text: '1번' }, { id: '2', text: '2번' }, { id: '3', text: '3번' }, { id: '4', text: '4번' }, { id: '5', text: '5번' }
    ],
    labelExtra: [
      { id: '7', text: '7번(선택지에 없는 번호)' },
      { id: '8', text: '8번(선택지에 없는 번호)' }
    ],
    legendNote: '카드 아래 번호는 붙어 있는 이름표다. 이 시험의 선택지는 1~5번.',
    inspectNote: '카드를 누르면 크게 볼 수 있다. 손글씨와 붙은 번호가 안 맞으면 번호를 고치거나 뺀다. "?" 카드는 단서를 보고 번호를 붙이거나, 넣지 않기로 정한다.',
    relabelNote: '손글씨와 맞지 않으면 맞는 번호로 고친다. 맞는 번호가 없으면 빼자.',
    cardTypes: {
      neat_1:    { label: '1', icons: ['1'], name: '또박또박 쓴 1', art: { digit: '1', style: 'neat' } },
      neat_2:    { label: '2', icons: ['2'], name: '또박또박 쓴 2', art: { digit: '2', style: 'neat' } },
      neat_3:    { label: '3', icons: ['3'], name: '또박또박 쓴 3', art: { digit: '3', style: 'neat' } },
      neat_4:    { label: '4', icons: ['4'], name: '또박또박 쓴 4', art: { digit: '4', style: 'neat' } },
      neat_5:    { label: '5', icons: ['5'], name: '또박또박 쓴 5', art: { digit: '5', style: 'neat' } },
      flag_1:    { label: '1', icons: ['1'], name: '흘려 쓴 1', art: { digit: '1', style: 'flag' } },
      loop_3:    { label: '3', icons: ['3'], name: '흘려 쓴 3', art: { digit: '3', style: 'loop' } },
      angular_2: { label: '2', icons: ['2'], name: '각지게 쓴 2', art: { digit: '2', style: 'angular' }, rare: true },
      round_5:   { label: '5', icons: ['5'], name: '둥글게 쓴 5', art: { digit: '5', style: 'round' }, rare: true },
      table_4:   { label: '4', icons: ['4'], name: '표 안에 쓴 답', art: { digit: '4', style: 'table' }, rare: true },
      slant_1:   { label: '1', icons: ['1'], name: '크게 기운 1', art: { digit: '1', style: 'slant' }, rare: true }
    },
    // "?" 카드: 선택지 안에서 헷갈리는 것만(7·8은 버튼이 없어 "?"로 내면 답이 뻔하다). 맞게 붙이면 2장 몫
    ambiguous: [
      { id: 'q_25', truthKey: 'angular_2', correctLabel: '2', icons: ['unknown'],
        art: { digit: '2', style: 'smudge' },
        clues: [
          { type: 'same_student', text: '같은 학생이 다른 문제에 쓴 2 — 아래가 평평한 같은 모양' },
          { type: 'stroke', text: '연필 자국 확대: 위가 둥글게 시작해 한 획으로 내려온다(5는 윗줄을 따로 긋는다)' }
        ] },
      { id: 'q_35', truthKey: 'loop_3', correctLabel: '3', icons: ['unknown'],
        art: { digit: '3', style: 'flat' },
        clues: [
          { type: 'same_student', text: '같은 학생이 쓴 5 — 윗줄이 떨어져 있다(이 답은 붙어 있다)' },
          { type: 'stroke', text: '연필 자국 확대: 가운데가 안쪽으로 꺾인다' }
        ] }
    ],
    // 목적 밖 개인정보 카드(설계 2026-11-08 ①, DR.Privacy): 또박또박 쓴 평범한 답(S4 독특한 답 아님)에 학생 이름 → 가리기 뒤 사용
    // 이름은 읽히지 않는 흘림 획(cardart.js nameLine) — 숫자 모양이 아니게
    privacy: {
      on: true,
      cards: [
        { id: 'p_name_2', key: 'neat_2', fix: 'mask', at: 0.5, what: '학생 이름', art: { digit: '2', style: 'neat', name: true },
          mask: [{ x: 0.57, y: 0.02, w: 0.39, h: 0.13, look: 'bar' }] },
        { id: 'p_name_4', key: 'neat_4', fix: 'mask', at: 0.5, what: '학생 이름', art: { digit: '4', style: 'neat', name: true },
          mask: [{ x: 0.57, y: 0.02, w: 0.39, h: 0.13, look: 'bar' }] }
      ]
    },
    // 이름표가 틀린 답안(2 임무 방식 — 고치거나 빼기). 7·8 = 선택지 밖, 2에 '5' = 선택지 안, 낙서 = 고칠 수 없음
    fakes: [
      { id: 'x_17', name: '흘려 쓴 1', label: '7', truth: 'flag_1', count: 3, harm: 'danger', scenes: ['S2'], art: { digit: '1', style: 'flag' },
        line: "우리가 넣은 데이터에 흘려 쓴 1 답안이 '7번' 이름표로 섞여 들어갔다. AI가 깃발 달린 1을 7로 배웠다." },
      { id: 'x_38', name: '흘려 쓴 3', label: '8', truth: 'loop_3', count: 3, harm: 'danger', scenes: ['S2'], art: { digit: '3', style: 'loop' },
        line: "우리가 넣은 데이터에 흘려 쓴 3 답안이 '8번' 이름표로 섞여 들어갔다. AI가 고리가 닫힌 3을 8로 배웠다." },
      { id: 'x_25', name: '각지게 쓴 2', label: '5', truth: 'angular_2', count: 2, harm: 'danger', scenes: ['S2'], art: { digit: '2', style: 'angular' },
        line: "우리가 넣은 데이터에 각지게 쓴 2 답안이 '5번' 이름표로 섞여 들어갔다. AI가 각진 2를 5로 배웠다." },
      { id: 'x_scribble', name: '답 칸의 낙서', label: '1', truth: null, count: 2, harm: 'inconvenience', scenes: ['S1'], art: { style: 'scribble' },
        line: "우리가 넣은 데이터에 답 칸의 낙서·지우개 자국이 '1번' 이름표로 섞여 들어갔다. 낙서를 답으로 읽어 선생님이 다시 봐야 했다." }
    ],
    outcomeText: { pass: '제대로 채점했다', inconvenience: '사람 채점으로 넘겼다 · 불편', danger: '맞게 쓴 답에 ✕ · 위험' },
    counts: {
      neat_1: 3, neat_2: 3, neat_3: 3, neat_4: 3, neat_5: 3,
      flag_1: 4, loop_3: 4, angular_2: 3, round_5: 3, table_4: 3, slant_1: 3
    },
    scenes: [
      { id: 'S1', title: '또박또박 쓴 답', emphasis: 'normal', art: { exam: 'neat' },
        combos: [
          { id: 'S1_neat', keys: NEAT, need: 5, danger: false, what: '또박또박 쓴 답안',
            fail: { kind: 'inconvenience', line: '처음 보는 반듯한 숫자도 확신이 없어 "사람 채점"으로 넘겼다. 선생님이 손으로 다시 채점한다.' } }
        ],
        passLine: '반듯하게 쓴 번호는 처음 보는 답안도 바로 읽고 맞게 채점했다.',
        cuts: {
          danger: '맞게 쓴 답을 다른 번호로 읽어 ✕가 찍혔다. 감독관이 채점을 멈추고 사람이 다시 보기로 했다.',
          inconvenience: '반듯한 숫자도 확신이 없어 "사람 채점"으로 넘겼다. 선생님이 손으로 다시 채점한다.'
        } },
      { id: 'S2', title: '흘려 쓴 답', emphasis: 'normal', art: { exam: 'quick' },
        combos: [
          { id: 'S2_flag_1', keys: ['flag_1'], need: 2, danger: true, what: '흘려 쓴 1',
            fail: { kind: 'danger', line: '흘려 쓴 1을 본 적이 없어 7로 읽었다. 시험지에 7번은 없어서 맞게 쓴 답에 ✕가 찍혔다.' } },
          { id: 'S2_loop_3', keys: ['loop_3'], need: 2, danger: true, what: '흘려 쓴 3',
            fail: { kind: 'danger', line: '고리가 닫힌 3을 8로 읽었다. 8번은 없는 번호라 ✕가 찍혔다.' } },
          { id: 'S2_25', keys: ['angular_2', 'round_5'], need: 3, danger: true, boundary: true, what: '각지게 쓴 2와 둥글게 쓴 5',
            fail: { kind: 'danger', line: '각지게 쓴 2를 5로 읽었다. 학생은 2번을 골랐는데 5번으로 채점됐다.' } }
        ],
        passLine: '흘려 쓴 1과 3, 각지게 쓴 2와 둥글게 쓴 5도 학생이 고른 번호로 읽었다.',
        cuts: {
          danger: '흘려 쓴 번호를 다른 숫자로 읽어 맞게 쓴 답에 ✕가 찍혔다. 감독관이 채점을 멈췄다.',
          inconvenience: '흘려 쓴 번호를 읽지 못해 "사람 채점"으로 넘겼다. 선생님이 손으로 다시 채점한다.'
        } },
      { id: 'S3', title: '교과서와 다른 풀이', emphasis: 'normal', art: { exam: 'table' },
        combos: [
          { id: 'S3_table', keys: ['table_4'], need: 2, danger: false, boundary: true, what: '표 안에 쓴 답',
            fail: { kind: 'inconvenience', line: "표 끝에 쓴 답을 찾지 못해 '답 없음'으로 넘겼다. 선생님이 손으로 다시 채점한다." } },
          { id: 'S3_neat', keys: NEAT, need: 2, danger: false, what: '또박또박 쓴 답안',
            fail: { kind: 'inconvenience', line: '반듯한 숫자도 확신이 없어 "사람 채점"으로 넘겼다.' } }
        ],
        passLine: '풀이를 표로 정리한 답안도 표 끝 칸에서 답을 찾아 읽었다.',
        cuts: {
          danger: '표 안의 숫자를 답으로 잘못 읽어 맞게 쓴 답에 ✕가 찍혔다. 감독관이 채점을 멈췄다.',
          inconvenience: "답 칸이 비어 있어 '답 없음'으로 보고 사람 채점으로 넘겼다."
        } },
      { id: 'S4', title: '선배의 옛 답안', emphasis: 'low', art: { exam: 'slant' },
        combos: [
          { id: 'S4_slant_1', keys: ['slant_1'], need: 2, danger: true, what: '크게 기운 1',
            fail: { kind: 'danger', line: '크고 기운 1을 7로 읽었다. 있지도 않은 번호라며 ✕ — 맞게 쓴 답이 틀렸다고 채점됐다.' } },
          { id: 'S4_table', keys: ['table_4'], need: 2, danger: false, boundary: true, what: '표 안에 쓴 답',
            fail: { kind: 'inconvenience', line: "표 끝 칸에 쓴 답을 찾지 못해 '답 없음'으로 넘겼다. 선생님이 손으로 다시 채점한다." } }
        ],
        passLine: '크고 기운 1도 1로 읽었다. 표 끝 칸에 쓴 답도 찾아 맞게 채점했다.',
        cuts: {
          danger: '크고 기운 1을 7로 읽었다. 있지도 않은 번호라며 ✕ — 감독관이 채점을 멈췄다.',
          inconvenience: "표 끝 칸의 답을 찾지 못해 '답 없음'으로 넘겼다. 선생님이 손으로 다시 채점한다."
        } }
    ],
    peerCards: [{ key: 'slant_1', n: 2 }, { key: 'table_4', n: 2 }],
    // 결과 화면의 '채점 시연'(2 임무 컨베이어와 같은 원인 규칙, DR.Conveyor.sort) — 처음 보는 답안지, 지나가는 순서대로.
    //   chose = 학생이 고른 번호, answer = 정답, bin = 맞는 채점('o' ○ / 'x' ✕), wrongBin = 틀릴 때('x' 맞게 쓴 답에 ✕ / 'hold' 사람 채점),
    //   read = 틀릴 때 AI가 읽은 번호(없으면 못 읽음), hazard = 틀리면 감독관이 멈춤(위험).
    //   위험 답안지는 위험 원인만 갖는다(위험 장면 ⇔ 멈춤, 테스트로 고정): 조합 빠짐(S2·S4) · 'any:가짜'(그 가짜가 어떤 이름표로든 오염) · 'danger:S#'.
    //   gr3 = 정말 틀린 답(학생 4번, 정답 2번) — 늘 ✕가 맞는 채점("✕ = 나쁨"이 아니라 "맞는 답에 ✕"가 문제). 선배 답안은 시연에 넣지 않는다(결판에서 따로).
    grading: [
      { id: 'gr1', scene: 'S1', art: 'neat_3', variant: 3, chose: '3', answer: '3', bin: 'o', wrongBin: 'hold', causes: ['S1_neat', 'contaminated:S1'] },
      { id: 'gr4', scene: 'S2', art: 'flag_1', variant: 3, chose: '1', answer: '1', bin: 'o', wrongBin: 'x', read: '7', hazard: true, causes: ['S2_flag_1', 'any:x_17'] },
      { id: 'gr8', scene: 'S3', art: 'table_4', variant: 3, chose: '4', answer: '4', bin: 'o', wrongBin: 'hold', causes: ['S3_table', 'contaminated:S3'] },
      { id: 'gr3', scene: 'S1', art: 'neat_4', variant: 4, chose: '4', answer: '2', bin: 'x', wrongBin: 'hold', causes: [] },
      { id: 'gr5', scene: 'S2', art: 'loop_3', variant: 3, chose: '3', answer: '3', bin: 'o', wrongBin: 'x', read: '8', hazard: true, causes: ['S2_loop_3', 'any:x_38'] },
      { id: 'gr11', scene: 'S4', art: 'slant_1', variant: 4, chose: '1', answer: '1', bin: 'o', wrongBin: 'x', read: '7', hazard: true, causes: ['S4_slant_1', 'danger:S4'] },
      { id: 'gr6', scene: 'S2', art: 'angular_2', variant: 3, chose: '2', answer: '2', bin: 'o', wrongBin: 'x', read: '5', hazard: true, causes: ['S2_25', 'any:x_25'] },
      { id: 'gr9', scene: 'S3', art: 'neat_1', variant: 4, chose: '1', answer: '1', bin: 'o', wrongBin: 'hold', causes: ['S3_neat', 'contaminated:S3'] },
      { id: 'gr2', scene: 'S1', art: 'neat_1', variant: 5, chose: '1', answer: '1', bin: 'o', wrongBin: 'x', read: '7', hazard: true, causes: ['danger:S1'] },
      { id: 'gr7', scene: 'S2', art: 'round_5', variant: 3, chose: '5', answer: '5', bin: 'o', wrongBin: 'x', read: '2', hazard: true, causes: ['S2_25'] },
      { id: 'gr12', scene: 'S4', art: 'table_4', variant: 4, chose: '4', answer: '4', bin: 'o', wrongBin: 'hold', causes: ['S4_table', 'contaminated:S4'] },
      { id: 'gr10', scene: 'S3', art: 'neat_3', variant: 4, chose: '3', answer: '3', bin: 'o', wrongBin: 'x', read: '8', hazard: true, causes: ['danger:S3'] },
      { id: 'gr13', scene: 'S2', art: 'loop_3', variant: 5, chose: '3', answer: '3', bin: 'o', wrongBin: 'hold', causes: ['contaminated:S2'] }
    ],
    // 챕터 끝(설계 2026-11-08 ②, js/ui-chapter.js): 다른 용도 요청(메시지) → 개념 질문 → 짧은 생각. ⚠️ 문장은 교사 검수 전 초안
    // 방향은 늘 '가장 지키는 쪽'(거절 = best). 다른 선택지는 왜 그것만으로 지켜지지 않는지 쉬운 말로
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
        question: "크게 기운 1처럼 독특한 답을 '이상하다'고 다 빼면 어떻게 될까?",
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
        { who: 'guide', text: '확인 결과, 채점 AI가 손글씨 번호를 잘못 읽고 있습니다. 1을 7로, 3을 8로 — 시험지에 없는 번호로요.', face: 'explain' },
        { who: 'bot', text: '삐빅! 이번엔 아무것도 안 담았어요. 감독관님이 새 기준을 알려 주셨거든요!', face: 'basic' },
        { who: 'senior', text: '드문 글씨는 결국 지워져. 내 것처럼.', face: 'worried' },
        { who: 'peer', text: '선배 글씨처럼 크게 기운 건 빼자. AI가 헷갈리잖아.', face: 'basic' },
        { who: 'supervisor', text: '러너, 출동. 붙은 번호도, 낯선 글씨도 끝까지 봐 줘.', face: 'explain' }
      ],
      guideBrief: '이 AI는 새빛 진학 평가 답안지의 답 칸에 손으로 쓴 번호(1~5)를 읽고 채점합니다. 원래 숫자 0~9를 읽는 AI라, 잘못 읽으면 시험지에 없는 번호가 나올 수 있습니다.',
      // 3 임무 기록에 따라 브리핑에 한 줄(기록이 없으면 — 임무 고르기로 바로 들어옴 — 이 줄 없음)
      recordLine: {
        firstTry: '3 임무는 첫 판에 통과했습니다. 이번엔 붙은 번호와 낯선 글씨를 끝까지 살펴 주세요.',
        supplemented: '3 임무는 첫 판에 놓친 장면이 있었습니다. 이번엔 처음부터 붙은 번호와 낯선 글씨를 살펴 주세요.'
      },
      supervisorQuestion: '드물고 낯선 글씨, 빼 버린 거 없어? 붙은 번호는 다 봤고?',
      responsibility: '승인한 건 나니까, 나도 같이 책임질게.',
      gradeIntro: { who: 'supervisor', text: '그럼, 실제로 채점해 보자.', face: 'explain' },
      emergency: { who: 'supervisor', text: '잠깐, 이건 사람이 다시 보자.', face: 'worried' },
      // 달리기 중 구역에 들어설 때 한 줄(첫 가짜 안내와 같은 알림 틀, 첫 달리기에서만) — 레이스는 없다
      runLines: [
        { zone: 'S2', who: 'senior', text: '1을 7로 읽는 기계야. 곧 보게 될걸.', face: 'basic' },
        { zone: 'S4', who: 'senior', text: '여기부터 내 글씨 같은 것들이야. 담을지 말지는 네가 정해.', face: 'basic' }
      ],
      clientPass: [{ who: 'grader', text: '오늘 답안지는 제가 다시 볼 게 거의 없겠어요.', face: 'basic' }],
      clientFail: [{ who: 'grader', text: '아직 제가 다시 봐야 할 답안이 있어요. 한 번 더 부탁해요.', face: 'worried' }],
      // 결판(장면 결과 바로 뒤): 선배의 옛 답안을 우리 AI가 읽나(DR.Judge.readable). bg = 대화 내내 뒤에 까는 장면 그림,
      //   sheet = 대화창 위에 얹는 선배 답안(코드 그림, 'AI가 읽은 답' — ask 줄은 빈 자리, 그 뒤는 읽은 결과)
      showdown: {
        bg: 'assets/story/showdown-senior.webp',
        ask: [
          { who: 'senior', text: '새빛 진학 평가 때 내 답안이야. 네 AI로 읽어 봐.', face: 'basic' }
        ],
        readPass: { who: 'guide', text: '채점 결과 — AI가 읽은 답: 1 · ○', face: 'explain' },
        readFail: { who: 'guide', text: '채점 결과 — AI가 읽은 답: 7, 선택지에 없는 번호 · ✕', face: 'explain' },
        // 크게 기운 1은 읽었는데 표 안 답을 못 배운 경우(S4 불편): 표 끝 칸의 답을 찾지 못함
        readHold: { who: 'guide', text: '채점 결과 — AI가 읽은 답: 없음, 표 끝 칸의 답을 찾지 못함 · 사람 채점', face: 'explain' },
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
          { who: 'peer', text: '크게 기운 1 두 장이랑 표 안에 쓴 답 두 장. 보충 달리기가 끝나면 가방에 넣을게.', face: 'basic' }
        ],
        peerFixed: { who: 'peer', text: '이번엔 내가 같이 책임질게. 이건 꼭 넣자.', face: 'basic' },
        peerBox: { who: 'peer', text: '나도 이거 챙겨 왔어. 다음엔 처음부터 넣을게.', face: 'happy' }
      },
      // 도시 재연결(도시 복구 5/5) 뒤 의뢰인 한 줄 — 모두 통과면 pass, 다른 장면이 남았으면 partial. 택배 기사 = 3 임무 의뢰인 회수
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
      // 해커의 이후: 화해·사과 장면 없음. 마지막은 말없이 카드를 넘기는 모습(그림)
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
