#!/usr/bin/env node
/**
 * Mede o modelo DENTRO do navegador, pelo caminho real do usuário: envio do arquivo, Canvas,
 * Web Worker e ONNX Runtime. As cartas vêm das coleções de teste, que o modelo nunca viu.
 * Serve para provar que o pré-processamento em JavaScript equivale ao do treino.
 *
 * Uso: node tests/browser-accuracy.mjs [--samples 200] [--throttle 4]
 * Requer o build em dist/ e os dados de ml/.work/ (por isso não faz parte do `npm test`).
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('@playwright/test');

const argument = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? Number(process.argv[index + 1]) : fallback;
};
const SAMPLES = argument('samples', 200);
const THROTTLE = argument('throttle', 1);
const DATA = path.resolve('ml/.work/datasets');
const TMP = path.resolve('ml/.work/browser-eval');

const rows = JSON.parse(readFileSync('ml/.work/manifests/test_cards.json', 'utf8')).filter((r) => r.label);
const step = Math.max(1, Math.floor(rows.length / SAMPLES));
const sample = rows.filter((_, index) => index % step === 0).slice(0, SAMPLES);

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 7'], ignoreHTTPSErrors: true, locale: 'pt-BR' });
const page = await context.newPage();
await page.goto('https://localhost:4173/pokedex-ai/scanner');
if (THROTTLE > 1) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
}

let top1 = 0;
let top5 = 0;
let identified = 0;
let identifiedRight = 0;
const times = [];
let backend = '';

for (const [index, row] of sample.entries()) {
  const image = sharp(path.join(DATA, row.path));
  const { width, height } = await image.metadata();
  const file = path.join(TMP, `${index}.png`);
  // Mesmo recorte da avaliação em Python: só a ilustração.
  await image
    .extract({
      left: Math.round(width * 0.09),
      top: Math.round(height * 0.13),
      width: Math.round(width * 0.82),
      height: Math.round(height * 0.33),
    })
    .png()
    .toFile(file);

  await page.getByTestId('file-input').setInputFiles(file);
  const result = page.getByTestId('scan-result');
  await result.waitFor({ timeout: 90_000 });
  const top = (await result.getAttribute('data-top')).split(',').map(Number);
  const status = await result.getAttribute('data-status');
  backend = await result.getAttribute('data-backend');
  if (index > 0) times.push(Number(await result.getAttribute('data-elapsed')));
  if (top[0] === row.label) top1++;
  if (top.includes(row.label)) top5++;
  if (status === 'identified') {
    identified++;
    if (top[0] === row.label) identifiedRight++;
  }
  await page.getByRole('button', { name: 'Fechar resultado' }).click();
  await result.waitFor({ state: 'detached' });
}

await browser.close();
rmSync(TMP, { recursive: true, force: true });

times.sort((a, b) => a - b);
const percent = (value) => `${((value / sample.length) * 100).toFixed(1)}%`;
console.log(`Imagens: ${sample.length} | motor: ${backend} | redução de CPU: ${THROTTLE}x`);
console.log(`Top-1: ${percent(top1)} | Top-5: ${percent(top5)}`);
console.log(`Afirmou em ${percent(identified)}; acertou ${((identifiedRight / Math.max(1, identified)) * 100).toFixed(1)}% dessas vezes`);
console.log(`Inferência: mediana ${times[times.length >> 1]} ms, p95 ${times[Math.floor(times.length * 0.95)]} ms`);
