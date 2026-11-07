// 브라우저 테스트 공용: msedge 헤드리스로 data/index.html을 file://로 연다(팀원이 더블클릭으로 여는 것과 같은 조건).
// PLAYWRIGHT_MODULE=D:/Works/token_economy/node_modules/playwright
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
export const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const shotPath = (name) => path.join(DATA_DIR, 'tests', `_shot-${name}.png`);

export async function openGame(opts = {}) {
  const browser = opts.browser || await chromium.launch({
    channel: 'msedge', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport: opts.viewport || { width: 1366, height: 900 }, hasTouch: !!opts.hasTouch });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // 파일이 없을 때 콘솔의 'Failed to load resource'는 주소가 없어 대신 requestfailed로 어느 파일인지 남긴다.
  // 도시 복구 그림(assets/city/city-n.webp)은 아직 오지 않아 없는 게 정상(그림 자리를 숨기고 점 5칸) — 그 밖의 빠진 파일은 오류
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('requestfailed', (r) => { if (!/assets\/city\/city-\d\.webp$/.test(r.url())) errors.push('missing file: ' + r.url()); });
  // 자동 일시정지(창 포커스 잃음)는 끈다 — 테스트가 페이지를 여러 개 열면 포커스가 옮겨 달리기가 멈춰 버림. 일시정지 자체는 flow-browser가 키·버튼으로 확인
  if (!opts.autoPause) await page.addInitScript(() => { window.__DR_NO_AUTOPAUSE = true; });
  // 시작 화면을 떠나는 0.55초 전환은 테스트에서 건너뛴다(전환 자체는 title-browser가 titleFx로 확인)
  if (!opts.titleFx) await page.addInitScript(() => { window.__DR_FAST_TITLE = true; });
  await page.goto(pathToFileURL(path.join(DATA_DIR, 'index.html')).href + (opts.query || ''));
  return { browser, page, errors };
}
// 첫 시험 검수 → 시연 → 합격 버튼까지. 이름표 틀린 카드를 안 가져왔으면 연습 카드가 나오고, 고쳐야 넘어간다
export async function passExam(page) {
  await page.locator('#btn-submit').click();
  if (await page.locator('#btn-fix').count()) {
    await page.locator('#btn-fix').click();
    const wrong = await page.evaluate(() => { const m = DR.Missions.tutorial, st = DR.App.state, list = st.bag.concat(st.drill ? [st.drill] : []); return list.filter((c) => DR.Cards.isMislabeled(m, c)).map((c) => ({ id: c.id, truth: DR.Cards.truthKey(m, c) })); });
    for (const c of wrong) { await page.locator(`.exam-card[data-id="${c.id}"]`).click(); await page.locator('#btn-label-' + c.truth).click(); }
    await page.locator('#btn-submit').click();
  }
  await page.locator('#btn-next').click();
}
// 도시 복구 화면(깬 직후, 칸이 늘었을 때만)이 떠 있으면 [계속] — 임무 끝 흐름을 지나는 테스트가 쓴다
export async function passCity(page) {
  if (await page.locator('#screen-city').isVisible()) await page.locator('#btn-city-next').click();
}
