// 주인공 3D 모델(러너용): 공통 팩 온유(남)·다온(여) 시트 → 앞·뒤 그림(nano-banana) → 3D(Tripo 멀티뷰) GLB.
//   node data/tools/hero-3d.mjs image [onyu daon]   그림만(뒷모습·앞모습 각 1장, 회당 약 0.04달러)
//   node data/tools/hero-3d.mjs model [onyu daon]   그림 → GLB(Tripo, 회당 약 0.3달러)
// 공통 팩은 data 브랜치에 없으므로 privacy 작업 폴더의 shared를 읽는다(SHARED 환경 변수로 바꿀 수 있음).
// fal 키·호출은 publicness 도구(fal.mjs)를 그대로 쓴다(키 = publicness/.env, 커밋 금지).
// 결과는 data/tools/_hero/(gitignore) — 게임에 넣을 것만 따로 꾸려 커밋한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAL = process.env.FAL_TOOLS || 'D:/Works/ethicity-games-mid-publicness/publicness/tools/fal.mjs';
const { upload, run, download } = await import('file:///' + FAL.replace(/\\/g, '/'));
const SHARED = process.env.SHARED || 'D:/Works/ethicity-games-mid/shared/ethicity-elementary-common-v1';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '_hero');
fs.mkdirSync(OUT, { recursive: true });

const HERO = {
  onyu: 'a boy: fluffy messy brown hair, round glasses, cream shirt collar under a dark teal sweater vest, cream long sleeves, brown trousers, cream sneakers, a navy blue school backpack',
  daon: 'a girl: brown hair in two low pigtails with orange hair ties and an orange square hair clip, lavender hooded zip jacket over a cream top, navy blue jeans rolled at the ankle, cream sneakers, a small lavender backpack',
};
const VIEW = {
  back: 'seen exactly from BEHIND (back view, we see the back of the head and the whole backpack, no face visible)',
  front: 'seen exactly from the FRONT (front view, facing the viewer, friendly calm face)',
};
const prompt = (id, view) => 'Image 1 is the official character sheet of our game (rows: front, left, right, back, close-ups). '
  + `Make ONE clean full-body image of this exact character — ${HERO[id]} — ${VIEW[view]}. `
  + 'Same chibi proportions (big head, short body), same colors and outfit as image 1. Standing straight in a relaxed A-pose, arms slightly away from the body, feet slightly apart. '
  + 'Render it as a smooth stylized 3D toy figure (soft matte vinyl, simple shapes) ready for 3D reconstruction: NOT pixel art, no outlines. '
  + 'Flat even lighting, no shadows, no ground, isolated on a pure white #FFFFFF background, the whole body centered and fully visible. No text.';

const [stage = 'image', ...ids] = process.argv.slice(2);
const list = ids.length ? ids : Object.keys(HERO);
const log = (o) => fs.appendFileSync(path.join(OUT, 'log.jsonl'), JSON.stringify(Object.assign({ at: new Date().toISOString() }, o)) + '\n');

for (const id of list) {
  if (stage === 'image') {
    const sheet = await upload(path.join(SHARED, 'characters', id + '-source.png'));
    for (const view of Object.keys(VIEW)) {
      try {
        const res = await run('fal-ai/nano-banana/edit', { prompt: prompt(id, view), image_urls: [sheet], num_images: 1, output_format: 'png' });
        const url = res.images?.[0]?.url;
        if (!url) throw new Error('결과 없음 ' + JSON.stringify(res).slice(0, 200));
        const out = path.join(OUT, `${id}-${view}.png`);
        await download(url, out);
        log({ id, view, out, seconds: res._seconds });
        console.log(`✓ ${id}-${view}.png (${res._seconds}s)`);
      } catch (e) { console.log(`✗ ${id}-${view}: ${e.message.slice(0, 160)}`); }
    }
  } else if (stage === 'model') {
    try {
      // 멀티뷰는 앞·뒤 크기가 같아야 한다 → 흰 여백을 잘라 같은 키(900px)로, 1024 정사각 가운데·발끝 같은 높이에
      const sharp = (await import('file:///D:/Works/sih26/node_modules/sharp/lib/index.js')).default;
      const norm = async (view) => {
        const f = path.join(OUT, `${id}-${view}.png`), o = path.join(OUT, `${id}-${view}-norm.png`);
        const body = await sharp(await sharp(f).flatten({ background: '#fff' }).trim({ background: '#fff', threshold: 12 }).toBuffer()).resize({ height: 900 }).toBuffer();
        const m = await sharp(body).metadata();
        await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#fff' } }).composite([{ input: body, left: Math.round((1024 - m.width) / 2), top: 62 }]).png().toFile(o);
        return o;
      };
      const input = { front_image_url: await upload(await norm('front')), back_image_url: await upload(await norm('back')), face_limit: 6000, texture: 'HD', pbr: false };
      const res = await run('tripo3d/tripo/v2.5/multiview-to-3d', input);
      fs.writeFileSync(path.join(OUT, id + '-response.json'), JSON.stringify(res, null, 2));
      const url = res.model_mesh?.url || res.base_model?.url || res.pbr_model?.url;
      if (!url) throw new Error('모델 주소 없음 ' + JSON.stringify(res).slice(0, 200));
      const size = await download(url, path.join(OUT, id + '.glb'));
      log({ id, model: id + '.glb', kb: Math.round(size / 1024), seconds: res._seconds });
      console.log(`✓ ${id}.glb ${Math.round(size / 1024)}KB (${res._seconds}s)`);
    } catch (e) { console.log(`✗ ${id} model: ${e.message.slice(0, 200)}`); }
  } else if (stage === 'pack') {
    // GLB → data/assets/models/hero-<id>.js (DR.heroModelData[id]) — file://에서도 읽히게 JS 한 파일로(publicness glb-pack 형식)
    const { readGlb, packModel, texturePage } = await import('file:///' + path.join(path.dirname(FAL), 'glb-pack.mjs').replace(/\\/g, '/'));
    const g = readGlb(path.join(OUT, id + '.glb'));
    const info = {}, tex = await texturePage(g.texture, { bright: process.env.BRIGHT || 1.5, size: 1024, q: 0.85, info });
    const data = packModel(g, { rot: Number(process.env.ROT ?? Math.PI / 2), fit: 'unit', texture: tex });
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'models');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `hero-${id}.js`);
    fs.writeFileSync(out, `/* 자동 생성 — data/tools/hero-3d.mjs (공통 팩 ${id} 시트 → nano-banana 앞·뒤 → Tripo 멀티뷰). 직접 고치지 말 것 */\n`
      + `window.DR = window.DR || {}; DR.heroModelData = DR.heroModelData || {}; DR.heroModelData[${JSON.stringify(id)}] = ${JSON.stringify(data)};\n`);
    console.log(`✓ ${out} ${Math.round(fs.statSync(out).size / 1024)}KB · 삼각형 ${data.triangles} · 밝기 ${JSON.stringify(info)}`);
  }
}
