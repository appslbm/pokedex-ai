import path from 'node:path';
import { expect, test } from './helpers';

const fixture = (name: string) => path.resolve('tests/e2e/fixtures', name);

test.describe('reconhecimento', () => {
  test.setTimeout(120_000);

  test('envio de foto: identifica, mostra confiança, abre a ficha', async ({ page }) => {
    await page.goto('scanner');
    await page.getByTestId('file-input').setInputFiles(fixture('charizard.png'));
    const result = page.getByTestId('scan-result');
    await expect(result).toBeVisible({ timeout: 60_000 });
    await expect(result).toHaveAttribute('data-status', 'identified');
    await expect(page.getByTestId('result-name')).toHaveText('Charizard');
    await expect(page.getByTestId('result-confidence')).toHaveText(/%$/);
    await page.getByTestId('result-open').click();
    await expect(page.getByTestId('pokemon-name')).toHaveText('Charizard');
  });

  test('não inventa Pokémon em imagem sem Pokémon', async ({ page }) => {
    await page.goto('scanner');
    await page.getByTestId('file-input').setInputFiles(fixture('not-pokemon.png'));
    const result = page.getByTestId('scan-result');
    await expect(result).toBeVisible({ timeout: 60_000 });
    await expect(result).not.toHaveAttribute('data-status', 'identified');
    await expect(page.getByRole('link', { name: 'Procurar manualmente' })).toBeVisible();
  });

  test('arquivo inválido mostra erro amigável', async ({ page }) => {
    await page.goto('scanner');
    await page.getByTestId('file-input').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('nada') });
    await expect(page.getByText('Não consegui abrir esse arquivo')).toBeVisible();
  });

  test('sem o modelo, avisa e mantém a busca manual', async ({ page }) => {
    await page.route('**/models/pokedex-vision/**', (route) => route.abort());
    await page.goto('scanner');
    await page.getByTestId('file-input').setInputFiles(fixture('charizard.png'));
    await expect(page.getByTestId('model-error')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('model-error').getByRole('link', { name: 'Procurar' })).toBeVisible();
  });
});

test.describe('câmera', () => {
  test.setTimeout(120_000);

  test('só pede a câmera depois do toque do usuário', async ({ page }) => {
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      (window as never as { __calls: number }).__calls = 0;
      navigator.mediaDevices.getUserMedia = (constraints) => {
        (window as never as { __calls: number }).__calls++;
        return original(constraints);
      };
    });
    await page.goto('scanner');
    await page.waitForTimeout(800);
    const calls = () => page.evaluate(() => (window as never as { __calls: number }).__calls);
    expect(await calls()).toBe(0);
    await page.getByTestId('open-camera').click();
    await expect.poll(calls).toBe(1);
  });

  test('pede permissão, mostra o vídeo, captura e identifica', async ({ page }) => {
    await page.goto('scanner');
    await page.evaluate(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (constraints) => {
        (window as never as { __constraints: unknown }).__constraints = constraints;
        return original(constraints);
      };
    });
    await page.getByTestId('open-camera').click();
    const video = page.getByTestId('camera-video');
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => (window as never as { __constraints: { video: { facingMode: unknown } } }).__constraints.video.facingMode)).toEqual({ ideal: 'environment' });

    await page.getByTestId('capture-button').click({ timeout: 45_000 });
    const result = page.getByTestId('scan-result');
    await expect(result).toBeVisible({ timeout: 60_000 });
    await expect(result).toHaveAttribute('data-status', 'identified');
    await expect(page.getByTestId('result-name')).toHaveText('Pikachu');
  });

  test('modo ao vivo reconhece continuamente', async ({ page }) => {
    await page.goto('scanner');
    await page.getByTestId('open-camera').click();
    await page.getByTestId('live-toggle').click({ timeout: 45_000 });
    await expect(page.getByTestId('live-chip')).toContainText('Pikachu', { timeout: 45_000 });
    await page.getByTestId('live-toggle').click();
    await expect(page.getByTestId('live-chip')).toHaveCount(0);
  });

  test('desliga a câmera ao sair da tela', async ({ page }) => {
    await page.goto('scanner');
    await page.getByTestId('open-camera').click();
    const video = page.getByTestId('camera-video');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
    await page.evaluate(() => {
      const element = document.querySelector('video')!;
      (window as never as { __stream: MediaStream }).__stream = element.srcObject as MediaStream;
    });
    await page.getByRole('link', { name: 'Pokédex', exact: true }).click();
    await expect.poll(() =>
      page.evaluate(() => (window as never as { __stream: MediaStream }).__stream.getTracks().every((t) => t.readyState === 'ended')),
    ).toBe(true);
  });

  const denied = [
    { name: 'NotAllowedError', title: 'Permissão da câmera negada' },
    { name: 'NotFoundError', title: 'Nenhuma câmera encontrada' },
    { name: 'NotReadableError', title: 'A câmera está ocupada' },
  ];
  for (const { name, title } of denied) {
    test(`trata ${name} e mantém o envio de foto`, async ({ page }) => {
      await page.addInitScript((errorName) => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('x', errorName));
      }, name);
      await page.goto('scanner');
      await page.getByTestId('open-camera').click();
      await expect(page.getByTestId('camera-error')).toContainText(title);
      await expect(page.getByTestId('upload-button')).toBeVisible();
    });
  }
});
