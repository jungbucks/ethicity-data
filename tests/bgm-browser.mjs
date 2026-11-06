// 달리기 배경음악(js/bgm.js · assets/bgm/arcade-rush.mp3): 달리기에서만 0.14로 재생, 끝나면 서서히 멈춤, 보충 달리기에서 이어서,
// 일시정지 메뉴 "배경음악" 끄기 → 바로 무음 + 새로고침 뒤에도 꺼짐, 탭 숨김이면 멈춤, file://에서 재생, 콘솔 오류 없음
import assert from 'node:assert/strict';
import { openGame } from './browser.mjs';

const ALL2 = { day_deep: 2, day_shallow: 2, day_wet: 2, day_dry: 2, night_wet: 2, night_neon: 2, night_deep: 2, night_shallow: 2, night_muddy: 2 };
const bgm = (page) => page.evaluate(() => DR.Bgm.state());
const waitPlaying = (page) => page.waitForFunction(() => { const s = DR.Bgm.state(); return s.playing && s.time > 0.3 && Math.abs(s.volume - 0.14) < 0.005; }, null, { timeout: 10000 });
const waitSilent = (page) => page.waitForFunction(() => !DR.Bgm.state().playing, null, { timeout: 4000 });
async function readResults(page) {
  while (await page.locator('#screen-result .result-scene').count()) await page.locator('#btn-next').click();
}

const { browser, page, errors } = await openGame({ query: '?start=flood' });
try {
  // 대화·브리핑: 무음
  await page.locator('#btn-skip').click();
  let s = await bgm(page);
  assert.equal(s.on, true, '기본 켜짐');
  await page.waitForTimeout(500);
  assert.equal((await bgm(page)).playing, false, '브리핑은 무음(첫 입력의 잠금 풀기는 소리 없이 틀었다 멈춤)');
  assert.equal((await bgm(page)).paused, true, '잠금 풀기 뒤 멈춰 있음');

  // 달리기: 재생, 볼륨 0.14, 되풀이, 파일은 file://의 arcade-rush.mp3
  await page.locator('#btn-run').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await waitPlaying(page);
  s = await bgm(page);
  assert.ok(s.loop, 'loop');
  const src = await page.evaluate(() => { const a = [...document.querySelectorAll('audio')]; return a.length; });
  assert.equal(src, 0, '<audio>는 DOM에 붙이지 않는다(Audio 객체)');
  const t1 = (await bgm(page)).time; await page.waitForTimeout(600);
  assert.ok((await bgm(page)).time > t1 + 0.3, '재생 시간이 흐른다');
  // 되풀이: 곡 길이 ≈166.8초(앞뒤 무음 덜어 냄), 끝 직전으로 옮기면 처음으로 돌아가 계속 재생
  assert.ok(Math.abs((await bgm(page)).duration - 166.8) < 0.3, 'duration ' + (await bgm(page)).duration);
  await page.evaluate(() => { const a = DR.Bgm.audio(); a.currentTime = a.duration - 0.4; });
  await page.waitForFunction(() => { const s = DR.Bgm.state(); return s.playing && s.time > 0.2 && s.time < 3; }, null, { timeout: 5000 });

  // 탭 숨김 → 멈춤, 다시 보임 → 재생
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal((await bgm(page)).playing, false, '탭 숨김이면 멈춤');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await waitPlaying(page);

  // 달리기 끝 → 검수: 0.6초 줄여 멈춤
  await page.evaluate((c) => { DR.App.debugFill(c); DR.Run.finishNow(); }, { ...ALL2, night_shallow: 0, night_muddy: 0, day_deep: 11, day_shallow: 9 });
  await page.locator('#screen-inspect').waitFor({ state: 'visible' });
  assert.equal((await bgm(page)).want, false);
  const mid = await bgm(page);
  assert.ok(mid.playing, '바로 끊지 않고 서서히(페이드 중) ' + JSON.stringify(mid));
  await waitSilent(page);
  const paused = await bgm(page);
  assert.ok(paused.volume < 0.01, 'faded to 0: ' + paused.volume);

  // 결과 → 보충 달리기: 멈춘 자리부터 이어서 다시 재생
  await page.locator('#btn-submit').click();
  await page.locator('#btn-confirm').click();
  await page.locator('#screen-result .result-scene').waitFor();
  assert.equal((await bgm(page)).playing, false, '결과는 무음');
  await readResults(page);
  for (let i = 0; i < 6; i++) await page.locator('#prep-grid .bag-card[data-key="day_deep"] .btn-remove').first().click();
  await page.locator('#btn-supplement').click();
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await waitPlaying(page);
  assert.ok((await bgm(page)).time >= paused.time, '보충 달리기는 멈춘 자리부터');

  // 일시정지 메뉴의 "배경음악" 끄기 → 바로 무음, ethicity.data.bgm = '0', 저장 형식(ethicity.data.save v1)은 그대로
  await page.keyboard.press('Escape');
  const box = page.locator('dialog[open] #opt-bgm');
  await box.waitFor();
  assert.ok(await box.isChecked());
  assert.ok((await page.locator('dialog[open] label.opt-toggle').innerText()).includes('배경음악'));
  await page.locator('dialog[open] label.opt-toggle').click();
  assert.equal(await box.isChecked(), false);
  assert.equal((await bgm(page)).playing, false, '끄면 바로 멈춤');
  assert.equal(await page.evaluate(() => localStorage.getItem('ethicity.data.bgm')), '0');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('ethicity.data.save')));
  assert.equal(save.v, 1); assert.equal(save.mission, 'flood');
  assert.equal(await page.evaluate(() => DR.Sfx.muted), false, '효과음은 그대로');
  await page.keyboard.press('KeyP'); // 메뉴 닫고 이어 달리기
  await page.waitForTimeout(800);
  assert.equal((await bgm(page)).playing, false, '꺼진 채 달리기');

  // 새로고침 뒤에도 꺼짐(달리기 디버그 진입) → 메뉴에서 다시 켜면 재생
  await page.goto(page.url().replace(/\?.*$/, '?run=flood'));
  await page.waitForFunction(() => DR.Run.peek().running, null, { timeout: 8000 });
  await page.waitForTimeout(1000);
  s = await bgm(page);
  assert.equal(s.on, false); assert.equal(s.want, true); assert.equal(s.playing, false, '새로고침 뒤에도 무음');
  await page.keyboard.press('Escape');
  await page.locator('dialog[open] #opt-bgm').waitFor();
  assert.equal(await page.locator('dialog[open] #opt-bgm').isChecked(), false);
  await page.locator('dialog[open] label.opt-toggle').click();
  await page.keyboard.press('KeyP');
  await waitPlaying(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('ethicity.data.bgm')), '1');

  // 처음으로(타이틀) → 멈춤
  await page.evaluate(() => DR.App.go('title'));
  await waitSilent(page);
  assert.deepEqual(errors, []);
  console.log('PASS bgm');
} finally { await browser.close(); }
