import { expect, test, type Page } from '@playwright/test';

/**
 * Reproduz em tempo real o que o Chrome para Android faz, conforme o código do Chromium:
 * pause() para o áudio sem enviar evento nenhum, resume() não faz nada e `speaking` segue
 * verdadeiro. Roda o app completo, com a pessoa mexendo na tela enquanto ouve.
 */
async function installAndroidEngine(page: Page) {
  await page.addInitScript(() => {
    type U = { text: string; rate: number; onstart?: () => void; onend?: () => void; onerror?: (e: { error: string }) => void };
    const log = { speakCalls: [] as string[], completed: [] as string[], pauses: 0, cancels: 0 };
    let queue: U[] = [];
    let audio: ReturnType<typeof setTimeout> | undefined;
    let paused = false;

    let playing: U | null = null;
    const begin = () => {
      const current = queue[0];
      if (!current || current === playing) return;
      playing = current;
      setTimeout(() => current.onstart?.(), 30);
      audio = setTimeout(() => {
        log.completed.push(current.text);
        queue.shift();
        current.onend?.();
        begin();
      }, (current.text.length / 14 / (current.rate || 1)) * 1000);
    };

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        get speaking() { return queue.length > 0; },
        get pending() { return queue.length > 1; },
        get paused() { return paused; },
        getVoices: () => [{ name: 'Portuguese Brazil', lang: 'pt-BR', voiceURI: 'pt', localService: true, default: true }],
        addEventListener() {},
        speak(u: U) {
          log.speakCalls.push(u.text);
          queue.push(u);
          if (queue.length === 1) begin();
        },
        pause() { log.pauses++; paused = true; clearTimeout(audio); },
        resume() { paused = false; },
        cancel() {
          log.cancels++;
          const current = queue[0];
          queue = [];
          clearTimeout(audio);
          if (current) setTimeout(() => current.onerror?.({ error: 'interrupted' }), 5);
        },
      },
    });
    (window as never as Record<string, unknown>).SpeechSynthesisUtterance = class {
      rate = 1; lang = ''; voice = null; onstart = null; onend = null; onerror = null;
      constructor(public text: string) {}
    };
    (window as never as Record<string, unknown>).__log = log;
  });
}

type Log = { speakCalls: string[]; completed: string[]; pauses: number; cancels: number };
const log = (page: Page) => page.evaluate(() => (window as never as { __log: Log }).__log);

test.describe('narração em comportamento de Android', () => {
  test.skip(({ browserName }) => browserName !== 'chromium');
  test.beforeEach(async ({ page }) => installAndroidEngine(page));

  test('características tocam até o fim, mesmo usando a tela durante a fala', async ({ page }) => {
    test.setTimeout(100_000);
    await page.goto('pokemon/25');
    await page.getByTestId('narrate-traits').click();
    await expect(page.getByTestId('narration-status')).toContainText('Características');
    const cancelsAtStart = (await log(page)).cancels;

    // Ações comuns que causam re-renderização enquanto a pessoa ouve.
    await page.getByRole('tab', { name: 'Status' }).click();
    await page.getByTestId('shiny-toggle').click();
    await page.getByRole('tab', { name: 'Evolução' }).click();
    await page.getByTestId('favorite-toggle').click();
    await page.getByRole('tab', { name: 'Formas' }).click();
    await page.mouse.wheel(0, 500);
    await page.getByRole('tab', { name: 'Sobre' }).click();

    await expect(page.getByTestId('narration-status')).toHaveText('Ouvir esta ficha', { timeout: 80_000 });
    const final = await log(page);
    const heard = final.completed.join(' ');
    expect(final.pauses, 'pause() mata a fala no Android').toBe(0);
    expect(final.cancels, 'nada pode cancelar a fala em andamento').toBe(cancelsAtStart);
    expect(heard).toContain('Pikachu, número 25');
    expect(heard).toContain('Estatísticas base');
    expect(heard).toContain('velocidade 90');
    expect(heard).toContain('escala de raridade');
    expect(final.completed).toEqual(final.speakCalls);
  });

  test('a descrição mais longa do acervo toca até o fim', async ({ page }) => {
    test.setTimeout(100_000);
    await page.goto('pokemon/219'); // Magcargo: passa dos 10 segundos em que a fala era cortada
    const description = await page.getByTestId('description').textContent();
    await page.getByTestId('narrate-description').click();
    await expect(page.getByTestId('narration-status')).toHaveText('Ouvir esta ficha', { timeout: 80_000 });
    expect((await log(page)).completed.join(' ').replace(/\s+/g, ' ')).toBe(description?.trim());
  });

  test('parar funciona na hora e trocar de narração não mistura', async ({ page }) => {
    test.setTimeout(100_000);
    await page.goto('pokemon/25');
    await page.getByTestId('narrate-traits').click();
    await page.waitForTimeout(1500);
    await page.getByTestId('narrate-description').click();
    await expect(page.getByTestId('narration-status')).toContainText('Descrição');
    await page.waitForTimeout(600);
    await page.getByTestId('narration-stop').click();
    await expect(page.getByTestId('narration-status')).toHaveText('Ouvir esta ficha');
    const count = (await log(page)).speakCalls.length;
    await page.waitForTimeout(1500);
    expect((await log(page)).speakCalls.length).toBe(count);
  });
});
