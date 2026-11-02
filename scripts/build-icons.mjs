#!/usr/bin/env node
/** Gera os ícones do PWA a partir de um desenho próprio: a lente da Pokédex. */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = 'public/icons';
const art = (scale = 1) => {
  const r = 150 * scale;
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8283f"/><stop offset="1" stop-color="#8f0a20"/></linearGradient>
    <radialGradient id="lens" cx=".38" cy=".34" r=".78"><stop offset="0" stop-color="#c8f1ff"/><stop offset=".45" stop-color="#2fb6ff"/><stop offset="1" stop-color="#0b4f96"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="${r + 26 * scale}" fill="#fff"/>
  <circle cx="256" cy="256" r="${r}" fill="url(#lens)"/>
  <circle cx="${256 - 52 * scale}" cy="${256 - 58 * scale}" r="${34 * scale}" fill="#fff" opacity=".9"/>
  <circle cx="${256 + 46 * scale}" cy="${256 + 52 * scale}" r="${14 * scale}" fill="#fff" opacity=".35"/>`;
};
const svg = (scale, radius) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><clipPath id="c"><rect width="512" height="512" rx="${radius}"/></clipPath><g clip-path="url(#c)">${art(scale)}</g></svg>`;

await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/icon.svg`, svg(1, 112));
const png = (source, size, file) => sharp(Buffer.from(source), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(`${OUT}/${file}`);
await png(svg(1, 112), 192, 'icon-192.png');
await png(svg(1, 112), 512, 'icon-512.png');
await png(svg(0.72, 0), 512, 'icon-maskable-512.png');
await png(svg(1, 0), 180, 'apple-touch-icon.png');
console.log('Ícones gerados');
