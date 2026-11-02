import AxeBuilder from '@axe-core/playwright';
import { cards, expect, expectNoHorizontalScroll, openCatalog, test } from './helpers';

test.describe('catálogo', () => {
  test('carrega no subcaminho do GitHub Pages, com imagens reais', async ({ page }) => {
    await openCatalog(page);
    await expect(page.getByTestId('result-count')).toHaveText('1.025 resultados');
    await expect(cards(page).first()).toContainText('Bulbasaur');

    const loaded = await page.evaluate(async () => {
      const images = [...document.querySelectorAll<HTMLImageElement>('[data-testid=pokemon-card] img')].slice(0, 4);
      await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
      return images.map((img) => ({ src: img.src, width: img.naturalWidth }));
    });
    expect(loaded.length).toBeGreaterThan(0);
    for (const image of loaded) {
      expect(image.src).toContain('/pokedex-ai/img/thumb/');
      expect(image.width).toBeGreaterThan(0);
    }
  });

  test('usa virtualização e chega ao último Pokémon', async ({ page }) => {
    await openCatalog(page);
    expect(await cards(page).count()).toBeLessThan(80);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole('link', { name: /Pecharunt/ })).toBeVisible();
  });

  test('busca por nome, número e sem resultado', async ({ page }) => {
    await openCatalog(page);
    const search = page.getByTestId('search-input');

    await search.fill('pikachu');
    await expect(page.getByTestId('result-count')).toContainText('resultado');
    await expect(cards(page).first()).toContainText('Pikachu');
    await expect(page).toHaveURL(/q=pikachu/);

    await search.fill('#150');
    await expect(cards(page).first()).toContainText('Mewtwo');

    await search.fill('xyzabc');
    await expect(page.getByText('Nada por aqui')).toBeVisible();
  });

  test('filtra por tipo, região, geração e raridade', async ({ page }) => {
    await openCatalog(page);
    await page.getByTestId('open-filters').click();
    const dialog = page.getByRole('dialog', { name: 'Filtros' });
    await dialog.getByRole('button', { name: 'Fogo', exact: true }).click();
    await dialog.getByRole('button', { name: 'Kanto', exact: true }).click();
    await expect(page.getByTestId('apply-filters')).toHaveText('Ver 12 resultados');
    await page.getByTestId('apply-filters').click();

    await expect(page).toHaveURL(/tipo=fire/);
    await expect(page).toHaveURL(/regiao=kanto/);
    await expect(page.getByTestId('result-count')).toHaveText('12 resultados');

    await page.getByRole('button', { name: 'Remover filtro Kanto' }).click();
    await expect(page).not.toHaveURL(/regiao/);

    await openCatalog(page, '?geracao=9&raridade=mitico');
    await expect(page.getByTestId('result-count')).toHaveText('1 resultado');
    await expect(cards(page).first()).toContainText('Pecharunt');
  });

  test('mantém a busca ao voltar da ficha', async ({ page }) => {
    await openCatalog(page, '?q=eevee');
    await cards(page).first().click();
    await expect(page.getByTestId('pokemon-name')).toHaveText('Eevee');
    await page.goBack();
    await expect(page).toHaveURL(/q=eevee/);
    await expect(page.getByTestId('search-input')).toHaveValue('eevee');
  });

  test('inclui as formas alternativas quando pedido', async ({ page }) => {
    await openCatalog(page, '?formas=1');
    await expect(page.getByTestId('result-count')).toHaveText('1.351 resultados');
  });
});

test.describe('rotas', () => {
  for (const route of ['pokemon/25', 'scanner', 'favoritos', 'ajustes']) {
    test(`recarregar /${route} não quebra`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('main')).not.toBeEmpty();
      await page.reload();
      await expect(page.locator('main h1').first()).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
    });
  }

  test('endereço inexistente mostra aviso, não tela em branco', async ({ page }) => {
    await page.goto('nao-existe');
    await expect(page.getByText('Página não encontrada')).toBeVisible();
  });

  test('número inválido mostra aviso', async ({ page }) => {
    await page.goto('pokemon/99999');
    await expect(page.getByText('Pokémon não encontrado')).toBeVisible();
  });

  test('navega pelas abas principais sem recarregar', async ({ page }) => {
    await openCatalog(page);
    await page.getByRole('link', { name: 'Favoritos' }).click();
    await expect(page).toHaveURL(/favoritos/);
    await page.getByRole('link', { name: 'Ajustes' }).click();
    await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
    await page.getByRole('link', { name: 'Pokédex', exact: true }).click();
    await expect(cards(page).first()).toBeVisible();
  });
});

test.describe('ficha', () => {
  test('mostra dados completos e organizados', async ({ page }) => {
    await page.goto('pokemon/6');
    await expect(page.getByTestId('pokemon-name')).toHaveText('Charizard');
    await expect(page.getByText('Pokémon Chama', { exact: false })).toBeVisible();
    await expect(page.getByTestId('description')).not.toBeEmpty();
    await expect(page.getByText('Kanto', { exact: true })).toBeVisible();
    await expect(page.getByText('1,7 m')).toBeVisible();
    await expect(page.getByText('90,5 kg')).toBeVisible();
    await expect(page.getByText('Blaze')).toBeVisible();
    await expect(page.getByText('Oculta')).toBeVisible();

    await page.getByRole('tab', { name: 'Status' }).click();
    await expect(page.getByTestId('stat-total')).toHaveText('534');

    await page.getByRole('tab', { name: 'Evolução' }).click();
    await expect(page.getByRole('link', { name: /Charmander/ })).toBeVisible();
    await expect(page.getByText('Nível 16')).toBeVisible();
    await page.getByRole('link', { name: /Charmeleon/ }).click();
    await expect(page.getByTestId('pokemon-name')).toHaveText('Charmeleon');
  });

  test('Shiny troca a imagem e não altera a raridade', async ({ page }) => {
    await page.goto('pokemon/6');
    const image = page.getByTestId('hero-image');
    await expect(image).toHaveAttribute('src', /official-artwork\/6\.png/);
    await expect(page.getByTestId('rarity-badge').first()).toHaveText('Raro');
    await page.getByTestId('shiny-toggle').click();
    await expect(page.getByTestId('hero-image')).toHaveAttribute('src', /official-artwork\/shiny\/6\.png/);
    await expect(page.getByTestId('rarity-badge').first()).toHaveText('Raro');
  });

  test('alterna formas alternativas e atualiza a ficha', async ({ page }) => {
    await page.goto('pokemon/6');
    await page.getByRole('tab', { name: 'Formas' }).click();
    await page.getByRole('button', { name: /Mega Charizard X/ }).click();
    await expect(page.getByTestId('pokemon-name')).toHaveText('Mega Charizard X');
    await expect(page).toHaveURL(/forma=charizard-mega-x/);
    await page.reload();
    await expect(page.getByTestId('pokemon-name')).toHaveText('Mega Charizard X');
  });

  test('imagem oficial carrega de verdade', async ({ page }) => {
    await page.goto('pokemon/25');
    const width = await page.getByTestId('hero-image').evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      return img.naturalWidth;
    });
    expect(width).toBeGreaterThan(200);
  });

  test('navega para o próximo e o anterior', async ({ page }) => {
    await page.goto('pokemon/25');
    await page.getByRole('link', { name: 'Próximo Pokémon' }).click();
    await expect(page.getByTestId('pokemon-name')).toHaveText('Raichu');
    await page.getByRole('link', { name: 'Pokémon anterior' }).click();
    await expect(page.getByTestId('pokemon-name')).toHaveText('Pikachu');
  });
});

test.describe('favoritos', () => {
  test('salva e continua salvo ao recarregar', async ({ page }) => {
    await page.goto('favoritos');
    await expect(page.getByText('Nenhum favorito ainda')).toBeVisible();
    await page.goto('pokemon/133');
    await page.getByTestId('favorite-toggle').click();
    await page.reload();
    await expect(page.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.goto('favoritos');
    await expect(cards(page).first()).toContainText('Eevee');
  });
});

test.describe('narração', () => {
  test.beforeEach(async ({ page }) => {
    // Sem vozes no ambiente de teste. A interação com a API é medida; a voz real é validada à parte.
    await page.addInitScript(() => {
      const spoken: { text: string; lang: string }[] = [];
      let timer: ReturnType<typeof setTimeout> | undefined;
      const queue: SpeechSynthesisUtterance[] = [];
      const pump = () => {
        const next = queue.shift();
        if (next) timer = setTimeout(() => { next.onend?.(new Event('end') as SpeechSynthesisEvent); pump(); }, 120);
      };
      const synth = {
        speaking: false,
        paused: false,
        getVoices: () => [{ name: 'Teste', lang: 'pt-BR', voiceURI: 'teste', localService: true, default: true }],
        addEventListener() {},
        cancel() { queue.length = 0; clearTimeout(timer); (window as never as Record<string, number>).__cancels = ((window as never as Record<string, number>).__cancels ?? 0) + 1; },
        pause() {},
        resume() {},
        speak(u: SpeechSynthesisUtterance) { spoken.push({ text: u.text, lang: u.lang }); queue.push(u); if (queue.length === 1) pump(); },
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      (window as never as Record<string, unknown>).SpeechSynthesisUtterance = class {
        rate = 1; lang = ''; voice = null; onend = null; onerror = null;
        constructor(public text: string) {}
      };
      (window as never as Record<string, unknown>).__spoken = spoken;
    });
  });

  const spoken = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as never as { __spoken: { text: string; lang: string }[] }).__spoken);

  test('pronuncia nome, narra características, lê descrição, repete e para', async ({ page }) => {
    await page.goto('pokemon/25');
    await page.getByTestId('narrate-name').click();
    await expect.poll(async () => (await spoken(page)).at(-1)?.text).toBe('Pikachu');
    expect((await spoken(page)).at(-1)?.lang).toBe('pt-BR');

    await page.getByTestId('narrate-traits').click();
    await expect.poll(async () => (await spoken(page)).map((s) => s.text).join(' ')).toContain('tipo Elétrico');

    await page.getByTestId('narrate-description').click();
    await expect(page.getByTestId('narration-status')).toContainText('Descrição');
    const count = (await spoken(page)).length;
    await page.getByTestId('narration-repeat').click();
    await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(count);

    await page.getByTestId('narrate-traits').click();
    await expect(page.getByTestId('narration-status')).toContainText('Características');
    await page.getByTestId('narration-stop').click();
    await expect(page.getByTestId('narration-status')).toHaveText('Ouvir esta ficha');
  });

  test('para de falar ao sair da ficha', async ({ page }) => {
    await page.goto('pokemon/25');
    await page.getByTestId('narrate-traits').click();
    await page.getByRole('link', { name: 'Próximo Pokémon' }).click();
    await expect(page.getByTestId('pokemon-name')).toHaveText('Raichu');
    await expect(page.getByTestId('narration-status')).toHaveText('Ouvir esta ficha');
  });
});

test.describe('layout e acessibilidade', () => {
  for (const route of ['', 'pokemon/6', 'scanner', 'favoritos', 'ajustes']) {
    test(`/${route}: sem rolagem lateral e sem violações graves`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('main')).not.toBeEmpty();
      await page.waitForTimeout(600);
      await expectNoHorizontalScroll(page);
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
    });
  }

  test.describe('tema escuro', () => {
    test.use({ colorScheme: 'dark' });
    for (const route of ['', 'pokemon/6', 'ajustes']) {
      test(`/${route}: contraste adequado`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator('main')).not.toBeEmpty();
        await page.waitForTimeout(600);
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
        expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
      });
    }
  });

  test('tema escuro e claro funcionam e persistem', async ({ page }) => {
    await page.goto('ajustes');
    await page.getByTestId('theme-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('theme-light').click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
