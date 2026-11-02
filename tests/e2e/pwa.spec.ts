import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Service worker exige certificado confiável, então este arquivo usa http://localhost,
 * que os navegadores também tratam como contexto seguro. Mesmo subcaminho do Pages.
 */
const BASE = 'http://localhost:4174/pokedex-ai/';

test.describe('PWA', () => {
  test.use({ baseURL: BASE, ignoreHTTPSErrors: false });

  test('identifica sem internet depois de usar o scanner uma vez', async ({ page, context }) => {
    test.setTimeout(120_000);
    const photo = path.resolve('tests/e2e/fixtures/charizard.png');
    await page.goto('scanner');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.getByTestId('file-input').setInputFiles(photo);
    await expect(page.getByTestId('result-name')).toHaveText('Charizard', { timeout: 60_000 });
    await page.waitForTimeout(1000);

    await context.setOffline(true);
    await page.reload();
    await page.getByTestId('file-input').setInputFiles(photo);
    await expect(page.getByTestId('result-name')).toHaveText('Charizard', { timeout: 60_000 });
    await context.setOffline(false);
  });

  test('manifesto válido e com escopo no subcaminho', async ({ request }) => {
    const response = await request.get(`${BASE}manifest.webmanifest`);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.start_url).toBe('/pokedex-ai/');
    expect(manifest.scope).toBe('/pokedex-ai/');
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) {
      expect((await request.get(new URL(icon.src, BASE).href)).ok(), icon.src).toBe(true);
    }
  });

  test('funciona sem internet depois da primeira visita', async ({ page, context }) => {
    await page.goto('./');
    await expect(page.getByTestId('pokemon-card').first()).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    // Visita uma ficha para colocá-la no cache, e espera o service worker gravar.
    await page.goto('pokemon/25');
    await expect(page.getByTestId('pokemon-name')).toHaveText('Pikachu');
    await page.waitForTimeout(800);

    await context.setOffline(true);
    await page.goto('./');
    await expect(page.getByTestId('pokemon-card').first()).toBeVisible();
    await expect(page.getByTestId('result-count')).toHaveText('1.025 resultados');
    await page.getByTestId('search-input').fill('charizard');
    await expect(page.getByTestId('pokemon-card').first()).toContainText('Charizard');

    // Rota profunda sem rede: o service worker entrega o aplicativo.
    await page.goto('favoritos');
    await expect(page.getByRole('heading', { name: 'Favoritos' })).toBeVisible();
    await page.goto('pokemon/25');
    await expect(page.getByTestId('pokemon-name')).toHaveText('Pikachu');

    // Ficha nunca visitada: mensagem clara, não tela em branco.
    await page.goto('pokemon/700');
    await expect(page.getByText('Não foi possível abrir esta ficha')).toBeVisible();
    await context.setOffline(false);
  });
});
