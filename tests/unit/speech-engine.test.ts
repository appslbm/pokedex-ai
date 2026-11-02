import { readFileSync } from 'node:fs';
import type { SpeciesDetail } from '../../src/data/types';
import { characteristicsScript, descriptionScript, splitForSpeech } from '../../src/lib/narration';

/** Velocidade típica de fala: cerca de 14 caracteres por segundo. */
const durationMs = (text: string, rate = 1) => (text.length / 14 / rate) * 1000;

interface FakeUtterance {
  text: string;
  rate: number;
  lang: string;
  voice: unknown;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

/**
 * Reproduz o comportamento do Chrome para Android, conforme o código-fonte do Chromium:
 *  - tts_android.cc: `Pause()` chama `StopSpeaking()`, que zera `utterance_id_`, e `Resume()` é vazio;
 *  - `SendFinalTtsEvent` descarta eventos de id diferente: a página não recebe `end` nem `error`;
 *  - speech_synthesis.cc: `speaking` é a fila ter item, então continua verdadeiro para sempre.
 */
class AndroidEngine {
  queue: FakeUtterance[] = [];
  paused = false;
  /** Trechos falados até o fim, na ordem. É o que a pessoa realmente ouviu. */
  completed: string[] = [];
  started: string[] = [];
  pauseCalls = 0;
  cancelCalls = 0;
  /** Simula eventos perdidos: o `end` do próximo trecho nunca chega. */
  dropNextEnd = false;
  /** Instante do último cancel, para simular a corrida entre cancel e speak. */
  cancelRaceMs = 0;
  private lastCancel = -Infinity;
  private audio: ReturnType<typeof setTimeout> | null = null;

  get speaking() {
    return this.queue.length > 0;
  }
  get pending() {
    return this.queue.length > 1;
  }

  getVoices() {
    return [{ name: 'Portuguese Brazil', lang: 'pt-BR', voiceURI: 'pt', localService: true, default: true }];
  }
  addEventListener() {}

  speak(utterance: FakeUtterance) {
    if (this.cancelRaceMs && Date.now() - this.lastCancel < this.cancelRaceMs) {
      setTimeout(() => utterance.onerror?.({ error: 'canceled' }), 5);
      return;
    }
    this.queue.push(utterance);
    if (this.queue.length === 1) this.begin();
  }

  private begin() {
    const utterance = this.queue[0];
    if (!utterance) return;
    this.started.push(utterance.text);
    setTimeout(() => utterance.onstart?.(), 30);
    const drop = this.dropNextEnd;
    this.dropNextEnd = false;
    this.audio = setTimeout(() => {
      this.completed.push(utterance.text);
      this.queue.shift();
      this.audio = null;
      if (!drop) utterance.onend?.();
    }, durationMs(utterance.text, utterance.rate));
  }

  /** Android: para o áudio e não avisa ninguém. */
  pause() {
    this.pauseCalls++;
    this.paused = true;
    if (this.audio) clearTimeout(this.audio);
    this.audio = null;
  }

  resume() {
    this.paused = false;
  }

  cancel() {
    this.cancelCalls++;
    this.lastCancel = Date.now();
    const current = this.queue[0];
    this.queue = [];
    if (this.audio) clearTimeout(this.audio);
    this.audio = null;
    if (current) setTimeout(() => current.onerror?.({ error: 'interrupted' }), 5);
  }

  /** Algo externo corta a fala: ligação, outro app de áudio, aba escondida. */
  externalInterruption(error = 'interrupted') {
    const current = this.queue[0];
    this.queue = [];
    if (this.audio) clearTimeout(this.audio);
    this.audio = null;
    current?.onerror?.({ error });
  }
}

class Utterance implements FakeUtterance {
  rate = 1;
  lang = '';
  voice: unknown = null;
  onstart = null;
  onend = null;
  onerror = null;
  constructor(public text: string) {}
}

const pikachu = JSON.parse(readFileSync('public/data/species/25.json', 'utf8')) as SpeciesDetail;
const traits = characteristicsScript(pikachu, pikachu.varieties[0]);
const description = descriptionScript(pikachu)!.text;
const heard = (engine: AndroidEngine) => engine.completed.join(' ');
const allChunks = (text: string) => splitForSpeech(text).join(' ');

describe('narração no comportamento do Chrome para Android', () => {
  let engine: AndroidEngine;
  let narrator: typeof import('../../src/lib/speech').narrator;
  const finish = (ms = 240_000) => vi.advanceTimersByTimeAsync(ms);

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    engine = new AndroidEngine();
    vi.stubGlobal('speechSynthesis', engine);
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    ({ narrator } = await import('../../src/lib/speech'));
  });

  afterEach(() => {
    narrator.stop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('o texto de características dura mais que o limite que causava o corte', () => {
    expect(durationMs(traits)).toBeGreaterThan(10_000);
  });

  it('reproduz as características por inteiro, na ordem', async () => {
    narrator.speak({ text: traits, label: 'Características' });
    await finish();
    expect(heard(engine)).toBe(allChunks(traits));
    expect(narrator.getState().status).toBe('idle');
    expect(narrator.getState().error).toBeNull();
  });

  it('reproduz a descrição por inteiro', async () => {
    narrator.speak({ text: description, label: 'Descrição' });
    await finish();
    expect(heard(engine)).toBe(allChunks(description));
  });

  it('nunca chama pause(), que no Android mata a fala', async () => {
    narrator.speak({ text: traits.repeat(4), label: 'Longo' });
    await finish();
    expect(engine.pauseCalls).toBe(0);
  });

  it('reproduz um texto muito longo sem perder trechos', async () => {
    const long = traits.repeat(6);
    narrator.speak({ text: long, label: 'Longo' });
    await finish(600_000);
    expect(heard(engine)).toBe(allChunks(long));
  });

  it('nova narração substitui a anterior, sem misturar', async () => {
    narrator.speak({ text: traits, label: 'Características' });
    await finish(4_000);
    narrator.speak({ text: description, label: 'Descrição' });
    await finish();
    expect(narrator.getState().status).toBe('idle');
    const firstNew = engine.started.indexOf(splitForSpeech(description)[0]);
    expect(firstNew).toBeGreaterThan(0);
    expect(engine.started.slice(firstNew)).toEqual(splitForSpeech(description));
  });

  it('sobrevive à corrida entre cancel e speak ao trocar de narração', async () => {
    engine.cancelRaceMs = 80;
    narrator.speak({ text: traits, label: 'Características' });
    await finish(4_000);
    narrator.speak({ text: description, label: 'Descrição' });
    await finish();
    expect(engine.completed.join(' ')).toContain(allChunks(description));
    expect(narrator.getState().error).toBeNull();
  });

  it('cliques repetidos não acumulam narrações', async () => {
    for (let i = 0; i < 5; i++) {
      narrator.speak({ text: description, label: 'Descrição' });
      await vi.advanceTimersByTimeAsync(40);
    }
    await finish();
    expect(heard(engine)).toBe(allChunks(description));
  });

  it('parar manualmente interrompe de vez e não recomeça', async () => {
    narrator.speak({ text: traits, label: 'Características' });
    await finish(4_000);
    const started = engine.started.length;
    narrator.stop();
    expect(narrator.getState().status).toBe('idle');
    expect(engine.speaking).toBe(false);
    await finish();
    expect(engine.started.length).toBe(started);
    expect(narrator.getState().error).toBeNull();
  });

  it('repetir recomeça do início depois de parar', async () => {
    narrator.speak({ text: description, label: 'Descrição' });
    await finish(1_000);
    narrator.stop();
    await finish(1_000);
    engine.completed = [];
    narrator.repeat();
    await finish();
    expect(heard(engine)).toBe(allChunks(description));
  });

  it('continua se o aparelho perder o evento de fim de um trecho', async () => {
    engine.dropNextEnd = true;
    narrator.speak({ text: traits, label: 'Características' });
    await finish();
    expect(heard(engine)).toBe(allChunks(traits));
    expect(narrator.getState().status).toBe('idle');
  });

  it('recupera a fala quando o motor trava sem avisar', async () => {
    narrator.speak({ text: traits, label: 'Características' });
    await finish(4_000);
    engine.pause(); // o mesmo travamento silencioso, vindo de fora do app
    await finish();
    for (const chunk of splitForSpeech(traits)) expect(engine.completed).toContain(chunk);
    expect(narrator.getState().status).toBe('idle');
  });

  it('retoma o trecho após uma interrupção externa', async () => {
    narrator.speak({ text: traits, label: 'Características' });
    await finish(3_000);
    engine.externalInterruption();
    await finish();
    expect(heard(engine)).toBe(allChunks(traits));
  });

  it('com o app em segundo plano, espera e retoma ao voltar', async () => {
    narrator.speak({ text: traits, label: 'Características' });
    await finish(3_000);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    engine.externalInterruption('canceled');
    const before = engine.started.length;
    await finish(60_000);
    expect(engine.started.length).toBe(before);
    expect(narrator.getState().status).toBe('speaking');

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    await finish();
    expect(heard(engine)).toBe(allChunks(traits));
    expect(narrator.getState().status).toBe('idle');
  });

  it('avisa a pessoa quando o motor falha de verdade, sem ficar em silêncio', async () => {
    narrator.speak({ text: traits, label: 'Características' });
    await finish(1_000);
    engine.externalInterruption('synthesis-unavailable');
    await finish(2_000);
    engine.queue.length && engine.externalInterruption('synthesis-unavailable');
    await finish(2_000);
    engine.queue.length && engine.externalInterruption('synthesis-unavailable');
    await finish(2_000);
    engine.queue.length && engine.externalInterruption('synthesis-unavailable');
    await finish(20_000);
    expect(narrator.getState().status).toBe('idle');
    expect(narrator.getState().error).toBeTruthy();
  });

  it('nenhum trecho ultrapassa o limite de 15 segundos do Chrome no desktop', () => {
    for (const chunk of splitForSpeech(traits.repeat(3))) {
      expect(durationMs(chunk)).toBeLessThan(15_000);
    }
  });
});

describe('divisão do texto', () => {
  it('não quebra números com ponto', () => {
    const chunks = splitForSpeech('Pode alcançar 4.600 pés de altitude. Pesa 1.200 quilos.');
    expect(chunks.join(' ')).toContain('4.600 pés');
    expect(chunks.join(' ')).toContain('1.200 quilos');
  });

  it('divide trechos longos sem pontuação, sem cortar palavras', () => {
    const text = 'palavra '.repeat(80).trim();
    const chunks = splitForSpeech(text, 100);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(' ')).toBe(text);
  });

  it('todas as descrições e características cabem no limite e não perdem conteúdo', () => {
    for (let id = 1; id <= 1025; id += 13) {
      const species = JSON.parse(readFileSync(`public/data/species/${id}.json`, 'utf8')) as SpeciesDetail;
      for (const text of [characteristicsScript(species, species.varieties[0]), species.description ?? '']) {
        const chunks = splitForSpeech(text);
        expect(chunks.every((c) => c.length <= 150)).toBe(true);
        expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text.trim().replace(/\s+/g, ' '));
      }
    }
  });
});
