/*
 * 오프닝 — 세계관 도입(docs/specs/2026-11-05-opening-tutorial-draft.md §3). 첫 장면 → 사진·이름표 분리 → 학교 삽입 컷 → 데이터 세계 → 자격시험.
 * 그림 파일(assets/story/opening/*.webp, Codex 제작 — 원본 PNG·프롬프트는 저장소 밖)이 없거나 못 읽어도 글과 버튼으로 진행한다. 글자는 그림에 넣지 않는다.
 * 학교 삽입 컷은 후반 주제의 복선일 뿐 — 선배와의 관계·시험 이름을 밝히지 않는다.
 */
(function (root) {
  'use strict';

  var opening = {
    beats: [
      { id: 'shelter', img: 'assets/story/opening/01-shelter.webp', alt: '보호소 안내대에서 강아지가 안내 로봇을 올려다보고, 옆 화면에는 고양이 그림이 떠 있다',
        lead: '강아지 앞에서 안내 AI가 말했다. ‘고양이입니다.’',
        lines: [{ who: '직원', text: '사진을 보고도 왜 틀리는 걸까?' }], action: '무슨 일이 있었지?' },
      { id: 'split', img: 'assets/story/opening/01-shelter.webp', alt: '강아지 옆 안내 화면에 고양이 그림이 떠 있다',
        split: { photo: 'assets/cards/animals/d01.webp', photoAlt: '강아지 사진', label: '고양이' },
        lead: '안내 단말이 배운 자료를 열어 보니, 사진과 이름표가 따로 있었다.', action: '다음' },
      { id: 'school', img: 'assets/story/opening/02-answer.webp', alt: '교실 책상 위 손글씨 답안지와 태블릿. 태블릿에는 답의 일부만 보이고 빨간 표시가 떠 있다', overlay: '오답',
        lines: [{ who: '학생', text: '이유도 썼는데… 왜 틀렸지?' }, { who: '선생님', text: '잠깐, 쓴 문장을 제대로 읽지 못했네. 내가 다시 볼게.' }], action: '다음' },
      { id: 'world', img: 'assets/story/opening/03-data-world.webp', alt: '접속 창 너머의 보호소와 사진 카드가 떠 있는 세 갈래 네온 길',
        lines: [{ who: '시험관', text: 'AI를 가르칠 때는 사진과 이름표를 함께 써.' }, { who: '시험관', text: '빠진 사진을 채우고, 틀린 이름표를 확인하는 것도 러너의 일이야.' }],
        note: '이곳은 도시의 데이터를 길과 카드로 볼 수 있는 가상 공간이다.', action: '시험장으로 접속' },
      { id: 'gate', img: 'assets/story/opening/04-exam-{hero}.webp', alt: '출발선에 자세를 낮춘 주인공과 길을 가리키는 시험관', info: '{hero} · 고2 · 오늘: 러너 자격시험',
        lines: [{ who: 'runner', text: '오늘만 통과하면, 나도 정식 러너다.' }, { who: '시험관', text: '가방은 10칸. 개 사진 5장, 고양이 사진 5장을 가져와.' }, { who: '시험관', text: '이름표가 틀린 것도 있어. 돌아오면 사진과 맞는지 확인해.' }, { who: 'runner', text: '달리기라면 자신 있어요. 고르는 건… 해 볼게요!' }],
        action: '실기 준비' }
    ]
  };

  root.DR = root.DR || {};
  root.DR.Prologue = { opening: opening };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DR.Prologue;
})(typeof window !== 'undefined' ? window : globalThis);
