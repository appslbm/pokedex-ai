import { expect, test as base, type Page } from '@playwright/test';

/** Ruídos esperados no ambiente de teste, não defeitos da aplicação. */
const EXPECTED = [
  /when fetching the script/i, // certificado autoassinado do servidor local impede o service worker
  /status of 404/i, // o GitHub Pages responde 404 em rotas profundas; é o fallback funcionando
];

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !EXPECTED.some((p) => p.test(message.text()))) errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
      await use(errors);
      expect(errors, 'erros no console').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const cards = (page: Page) => page.getByTestId('pokemon-card');

export async function openCatalog(page: Page, query = '') {
  await page.goto(`./${query}`);
  await expect(cards(page).first()).toBeVisible();
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
