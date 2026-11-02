# 시작 화면 이미지

내장 image_gen으로 생성. 게임 코드는 수정하지 않았습니다.

| 파일 | 크기(px) | 용량(KB, 1000바이트) | 용도 |
|---|---|---:|---|
| bg-sky.webp | 2560×1080 | 107.8 | 불투명 밤하늘 / 가장 뒤 레이어 |
| bg-far.png | 2560×720 | 1102.9 | 먼 건물 / 투명 반복 레이어 |
| bg-mid.png | 2560×720 | 2313.6 | 중간 건물·끊어진 데이터 선 / 투명 반복 레이어 |
| bg-road.png | 2560×360 | 1143.7 | 젖은 도로·가드레일 / 투명 반복 레이어 |
| mission-m1.webp | 640×400 | 67.9 | 1임무 침수 골목·감시 카메라 썸네일 |
| mission-m2.webp | 640×400 | 58.4 | 2임무 재활용 선별장·건전지 하나 썸네일 |
| og-image.png | 1200×630 | 1507.0 | 공유 미리보기 / 왼쪽 약 40% 제목용 여백 |

배경 2~4번은 같은 그림 두 장을 나란히 배치한 `*-seam-check.png`로 육안 확인했습니다. 도로의 경계 부근 가드레일 기둥 간격은 재생성하여 수정했습니다.

확인: 지정 크기, PNG 알파, 불투명 하늘, WebP 3장 각각 400KB 이하. 미확인: 실제 게임에 적용한 화면과 스크롤 동작(코드 연결 요청 없음).

`preview-all.png`: 요청 순서대로 7장을 한 줄에 배치한 검토용 이미지. 원본에는 글자·사람·캐릭터가 없습니다.

생성 프롬프트 전체: `generation-prompts.json`.

## 게임 연결(2026-11-02, 시작 화면 다시 꾸미기)

게임은 아래 파일만 쓴다(`css/style.css`의 `.tl-*`, `js/title-scene.js`, `index.html` og 메타). 큰 PNG 원본은 그대로 두고, 게임용 사본을 브라우저 내장 인코더로 만들었다(알파 유지).

| 게임이 쓰는 파일 | 원본 | 용량 |
|---|---|---:|
| bg-sky.webp | (원본 그대로) | 108KB |
| bg-far.webp | bg-far.png 1103KB | 169KB |
| bg-mid.webp | bg-mid.png 2314KB | 362KB |
| bg-road.webp | bg-road.png 1144KB | 111KB |
| mission-m1.webp · mission-m2.webp | (원본 그대로) | 68KB · 58KB |
| og-image.jpg (og:image·twitter:image) | og-image.png 1507KB | 154KB |

- 저장소에 올리지 않는 것(검토·원본 보관용, 이 폴더에만 있음): `bg-far.png`·`bg-mid.png`·`bg-road.png`·`og-image.png`(원본), `*-seam-check.png`, `preview-all.png`.
- 3 임무 썸네일은 이 폴더에 없어 게임 코드 그림(`DR.CardArt.scene(m3,'S1')`)으로 대신한다.
- AI 봇·주인공 초상은 `assets/characters/`(robot·onyu·daon-portraits.png, 이미 저장소에 있던 파일)를 쓴다.
