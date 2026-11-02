import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const PORT = 4173;
const video = resolve('tests/e2e/fixtures/pikachu-card.y4m');
/** Com PAGES_URL definida, os testes rodam contra o site publicado, e não contra o emulador local. */
const PAGES_URL = process.env.PAGES_URL;

/**
 * Roda contra o build de produção servido como no GitHub Pages: subcaminho e HTTPS.
 * A câmera é simulada com um vídeo real de entrada, então o caminho inteiro até o modelo
 * é exercitado: permissão, stream, captura e inferência.
 *
 * Para validar a publicação: PAGES_URL=https://usuario.github.io/repo/ npx playwright test
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
    baseURL: PAGES_URL ?? `https://localhost:${PORT}/pokedex-ai/`,
    ignoreHTTPSErrors: !PAGES_URL,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: PAGES_URL
    ? undefined
    : [
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
