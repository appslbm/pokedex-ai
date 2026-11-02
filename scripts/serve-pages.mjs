#!/usr/bin/env node
/**
 * Serve dist/ imitando o comportamento do GitHub Pages, para validar localmente:
 *  - o site fica em um subcaminho (/pokedex-ai/);
 *  - rota desconhecida responde 404 com o conteúdo de 404.html, sem reescrita mágica;
 *  - nenhum cabeçalho especial (sem COOP/COEP), como no Pages;
 *  - HTTPS opcional (--https), necessário para câmera e service worker fora de localhost.
 *
 * Uso: node scripts/serve-pages.mjs [--port 4173] [--base /pokedex-ai/] [--https]
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';

const argument = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const port = Number(argument('port', 4173));
const base = argument('base', '/pokedex-ai/');
const secure = process.argv.includes('--https');
const dist = path.resolve('dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function certificate() {
  const dir = path.join(tmpdir(), 'pokedex-ai-cert');
  mkdirSync(dir, { recursive: true });
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  if (!existsSync(key)) {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '30', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

function handler(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  const send = (status, file) => {
    response.writeHead(status, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'max-age=600',
    });
    createReadStream(file).pipe(response);
  };
  const notFound = () => send(404, path.join(dist, '404.html'));

  if (!pathname.startsWith(base)) return notFound();
  const relative = pathname.slice(base.length);
  let file = path.resolve(dist, relative);
  if (!file.startsWith(dist)) return notFound();
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  return existsSync(file) ? send(200, file) : notFound();
}

const server = secure ? createHttps(certificate(), handler) : createHttp(handler);
server.listen(port, () => console.log(`Pages local: ${secure ? 'https' : 'http'}://localhost:${port}${base}`));
