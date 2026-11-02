import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve('tests/e2e/fixtures');
const WIDTH = 640;
const HEIGHT = 480;

/** Converte RGB em YUV 4:2:0, o formato do arquivo Y4M que o Chrome usa como câmera falsa. */
function toYuv420(rgb: Buffer): Buffer {
  const luma = Buffer.alloc(WIDTH * HEIGHT);
  const u = Buffer.alloc((WIDTH * HEIGHT) / 4);
  const v = Buffer.alloc((WIDTH * HEIGHT) / 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 3;
      const [r, g, b] = [rgb[i], rgb[i + 1], rgb[i + 2]];
      luma[y * WIDTH + x] = 0.257 * r + 0.504 * g + 0.098 * b + 16;
      if (y % 2 === 0 && x % 2 === 0) {
        const j = (y / 2) * (WIDTH / 2) + x / 2;
        u[j] = -0.148 * r - 0.291 * g + 0.439 * b + 128;
        v[j] = 0.439 * r - 0.368 * g - 0.071 * b + 128;
      }
    }
  }
  return Buffer.concat([luma, u, v]);
}

async function scene(thumb: string, background: { r: number; g: number; b: number }) {
  const art = await sharp(thumb).resize(420, 420, { kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background } })
    .composite([{ input: art, left: (WIDTH - 420) / 2, top: (HEIGHT - 420) / 2 }])
    .png()
    .toBuffer();
}

export default async function globalSetup() {
  mkdirSync(DIR, { recursive: true });
  const target = path.join(DIR, 'pikachu-card.y4m');
  const photo = path.join(DIR, 'charizard.png');
  const noPokemon = path.join(DIR, 'not-pokemon.png');
  if (existsSync(target) && existsSync(photo) && existsSync(noPokemon)) return;

  const pikachu = await scene('public/img/thumb/25.webp', { r: 232, g: 228, b: 218 });
  const raw = await sharp(pikachu).removeAlpha().raw().toBuffer();
  const frame = toYuv420(raw);
  const header = Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F10:1 Ip A1:1 C420jpeg\n`);
  const marker = Buffer.from('FRAME\n');
  writeFileSync(target, Buffer.concat([header, ...Array.from({ length: 4 }, () => [marker, frame]).flat()]));

  writeFileSync(photo, await scene('public/img/thumb/6.webp', { r: 250, g: 250, b: 250 }));

  // Algo que certamente não é um Pokémon: uma cena abstrata de faixas em tons de madeira.
  const stripes = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const tone = 120 + 40 * Math.sin((x + y * 0.3) / 18) + 14 * Math.sin(y / 5);
      const i = (y * WIDTH + x) * 3;
      stripes[i] = tone + 30;
      stripes[i + 1] = tone;
      stripes[i + 2] = tone - 40;
    }
  }
  await sharp(stripes, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).png().toFile(noPokemon);
}
