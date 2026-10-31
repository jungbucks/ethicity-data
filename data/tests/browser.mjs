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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // 자동 일시정지(창 포커스 잃음)는 끈다 — 테스트가 페이지를 여러 개 열면 포커스가 옮겨 달리기가 멈춰 버림. 일시정지 자체는 flow-browser가 키·버튼으로 확인
  if (!opts.autoPause) await page.addInitScript(() => { window.__DR_NO_AUTOPAUSE = true; });
  await page.goto(pathToFileURL(path.join(DATA_DIR, 'index.html')).href + (opts.query || ''));
  return { browser, page, errors };
}
