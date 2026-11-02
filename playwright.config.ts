import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const PORT = 4173;
const video = resolve('tests/e2e/fixtures/pikachu-card.y4m');

/**
 * Roda contra o build de produção servido como no GitHub Pages: subcaminho e HTTPS.
 * A câmera é simulada com um vídeo real de entrada, então o caminho inteiro até o modelo
 * é exercitado: permissão, stream, captura e inferência.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `https://localhost:${PORT}/pokedex-ai/`,
    ignoreHTTPSErrors: true,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: [
    {
      command: `node scripts/serve-pages.mjs --port ${PORT} --https`,
      url: `https://localhost:${PORT}/pokedex-ai/`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: true,
    },
    {
      command: 'node scripts/serve-pages.mjs --port 4174',
      url: 'http://localhost:4174/pokedex-ai/',
      reuseExistingServer: true,
    },
  ],
  projects: [
    {
      name: 'celular',
      use: {
        ...devices['Pixel 7'],
        permissions: ['camera'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-video-capture=${video}`,
          ],
        },
      },
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /camera/ },
  ],
});
