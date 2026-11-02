import { MAX_CHUNK_LENGTH, splitForSpeech } from './narration';

export type SpeechStatus = 'idle' | 'speaking';

export interface SpeechRequest {
  text: string;
  lang?: string;
  label?: string;
}

export interface SpeechState {
  status: SpeechStatus;
  supported: boolean;
  label: string | null;
  hasLast: boolean;
  error: string | null;
}

const VOICE_KEY = 'pokedex:voice';
const RATE_KEY = 'pokedex:rate';

const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* modo privado: mantém só nesta sessão */
  }
};

/** Prefere vozes do idioma pedido, e dentro delas as de melhor qualidade. */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  preferredUri?: string | null,
): SpeechSynthesisVoice | null {
  const base = lang.split('-')[0].toLowerCase();
  const normalized = lang.toLowerCase().replace('_', '-');
  const sameLanguage = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(base));
  if (preferredUri) {
    const chosen = sameLanguage.find((v) => v.voiceURI === preferredUri);
    if (chosen) return chosen;
  }
  const score = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    let total = 0;
    if (voice.lang.toLowerCase().replace('_', '-') === normalized) total += 8;
    if (/google|natural|neural|online/.test(name)) total += 4;
    if (voice.localService) total += 1;
    return total;
  };
  return [...sameLanguage].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Espera depois de cancel(): falar em seguida pode descartar a fala nova no Android. */
const CANCEL_GAP_MS = 150;
/** Tentativas de refazer o mesmo trecho antes de desistir e avisar a pessoa. */
const MAX_RETRIES = 3;
/** Tempo para o motor começar a falar. Vozes pela rede demoram mais. */
const START_TIMEOUT_MS = 12_000;
/** Cerca de 14 caracteres por segundo, a velocidade normal de fala. */
const MS_PER_CHAR = 72;
const WATCH_INTERVAL_MS = 1_000;
/** Checagens seguidas sem fala antes de concluir que o motor parou. */
const SILENT_TICKS = 2;

const INTERRUPTIONS = new Set(['interrupted', 'canceled']);

/** Uma narração em andamento. Trocar ou parar a narração descarta este objeto. */
interface Playback {
  chunks: string[];
  index: number;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  retries: number;
  /**
   * Referência forte ao trecho atual. Sem ela, o Chrome pode descartar o objeto
   * no meio da fala e o evento de fim nunca chega.
   */
  utterance: SpeechSynthesisUtterance | null;
  startedAt: number | null;
  /** Interrompida com o app em segundo plano: retoma ao voltar. */
  waitingVisible: boolean;
}

class Narrator {
  private listeners = new Set<() => void>();
  private last: SpeechRequest | null = null;
  private playback: Playback | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private state: SpeechState = {
    status: 'idle',
    supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    label: null,
    hasLast: false,
    error: null,
  };

  constructor() {
    if (!this.state.supported) return;
    const refresh = () => {
      this.voices = window.speechSynthesis.getVoices();
      this.emit();
    };
    refresh();
    window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
    window.addEventListener('pagehide', () => this.stop());
    document.addEventListener('visibilitychange', () => {
      const playback = this.playback;
      if (document.hidden || !playback?.waitingVisible) return;
      playback.waitingVisible = false;
      this.schedule(playback, CANCEL_GAP_MS);
    });
  }

  getState = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(patch?: Partial<SpeechState>) {
    if (patch) this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  getVoices = (lang = 'pt') =>
    this.voices.filter((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));

  get preferredVoice() {
    return readStorage(VOICE_KEY);
  }
  setPreferredVoice(uri: string) {
    writeStorage(VOICE_KEY, uri);
    this.emit();
  }
  get rate() {
    const value = Number(readStorage(RATE_KEY));
    return value >= 0.5 && value <= 1.5 ? value : 1;
  }
  setRate(rate: number) {
    writeStorage(RATE_KEY, String(rate));
    this.emit();
  }

  speak(request: SpeechRequest) {
    if (!this.state.supported) return;
    this.last = request;
    this.play(request);
  }

  repeat() {
    if (this.last) this.play(this.last);
  }

  /** Parada manual: vale na hora, inclusive nos intervalos entre um trecho e outro. */
  stop() {
    if (!this.state.supported) return;
    this.release();
    this.silence();
    this.emit({ status: 'idle', label: null });
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Abandona a narração atual. Eventos atrasados dela deixam de ter efeito. */
  private release() {
    this.clearTimer();
    this.playback = null;
  }

  private get busy() {
    const synth = window.speechSynthesis;
    return synth.speaking || synth.pending || synth.paused;
  }

  private silence() {
    const synth = window.speechSynthesis;
    synth.cancel();
    if (synth.paused) synth.resume();
  }

  private play({ text, lang = 'pt-BR', label }: SpeechRequest) {
    const hadSpeech = this.busy;
    this.release();
    if (hadSpeech) this.silence();

    const rate = this.rate;
    // Abaixo da velocidade normal, cada trecho dura mais: encurta para caber no limite de tempo.
    const chunks = splitForSpeech(text, Math.round(MAX_CHUNK_LENGTH * Math.min(1, rate)));
    if (!chunks.length) {
      this.emit({ status: 'idle', label: null });
      return;
    }
    if (!this.voices.length) this.voices = window.speechSynthesis.getVoices();

    const playback: Playback = {
      chunks,
      index: 0,
      lang,
      voice: pickVoice(this.voices, lang, lang.startsWith('pt') ? this.preferredVoice : null),
      retries: 0,
      utterance: null,
      startedAt: null,
      waitingVisible: false,
    };
    this.playback = playback;
    this.emit({ status: 'speaking', label: label ?? null, hasLast: true, error: null });

    // Sem fala anterior, começa no mesmo toque: o Safari no iOS exige isso na primeira vez.
    if (hadSpeech) this.schedule(playback, CANCEL_GAP_MS);
    else this.speakChunk(playback);
  }

  private schedule(playback: Playback, delay: number) {
    this.clearTimer();
    this.timer = setTimeout(() => this.speakChunk(playback), delay);
  }

  private speakChunk(playback: Playback) {
    if (playback !== this.playback) return;
    if (playback.index >= playback.chunks.length) {
      this.release();
      this.emit({ status: 'idle', label: null });
      return;
    }

    const synth = window.speechSynthesis;
    const text = playback.chunks[playback.index];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = (playback.voice?.lang ?? playback.lang).replace('_', '-');
    if (playback.voice) utterance.voice = playback.voice;
    utterance.rate = this.rate;
    playback.utterance = utterance;
    playback.startedAt = null;

    // Cada trecho termina uma única vez, seja por evento, seja pelo vigia.
    const isCurrent = () => playback === this.playback && playback.utterance === utterance;
    utterance.onstart = () => {
      if (!isCurrent()) return;
      playback.startedAt = performance.now();
    };
    utterance.onend = () => {
      if (isCurrent()) this.advance(playback);
    };
    utterance.onerror = (event) => {
      if (isCurrent()) this.recover(playback, event.error);
    };

    if (synth.paused) synth.resume();
    synth.speak(utterance);
    this.watch(playback, utterance);
  }

  private expectedDuration(text: string) {
    return (text.length * MS_PER_CHAR) / this.rate;
  }

  private advance(playback: Playback) {
    this.clearTimer();
    playback.utterance = null;
    playback.index++;
    playback.retries = 0;
    this.speakChunk(playback);
  }

  private recover(playback: Playback, reason: string) {
    this.clearTimer();
    playback.utterance = null;

    // Fala interrompida com o app escondido (Android faz isso): retoma quando a pessoa voltar.
    if (document.hidden && INTERRUPTIONS.has(reason)) return this.waitForReturn(playback);
    if (reason === 'not-allowed') return this.fail('Toque de novo para ouvir: o navegador bloqueou a voz.');

    playback.retries++;
    if (playback.retries > MAX_RETRIES) {
      return this.fail('Não foi possível reproduzir a voz neste aparelho.');
    }
    this.schedule(playback, CANCEL_GAP_MS);
  }

  private fail(message: string) {
    this.release();
    this.silence();
    this.emit({ status: 'idle', label: null, error: message });
  }

  /**
   * Vigia de um trecho, para os casos em que os eventos nunca chegam. O prazo é folgado de
   * propósito: uma voz lenta jamais pode ser confundida com travamento, ou o vigia
   * cortaria a fala que deveria proteger.
   */
  private watch(playback: Playback, utterance: SpeechSynthesisUtterance) {
    const begin = performance.now();
    const expected = this.expectedDuration(utterance.text);
    const deadline = START_TIMEOUT_MS + expected * 2;
    let silentTicks = 0;

    const tick = () => {
      if (playback !== this.playback || playback.utterance !== utterance) return;
      const synth = window.speechSynthesis;
      const now = performance.now();

      if (synth.speaking) {
        silentTicks = 0;
        // Há motores que nunca enviam o evento de início; se está falando, começou.
        playback.startedAt ??= now;
        if (now - begin >= deadline) {
          // `speaking` preso em verdadeiro é o sinal de que o Android parou sem avisar.
          // Cancelar limpa a fila interna, que bloquearia todas as falas seguintes.
          synth.cancel();
          return document.hidden ? this.waitForReturn(playback) : this.recover(playback, 'timeout');
        }
      } else if (document.hidden) {
        return this.waitForReturn(playback);
      } else if (playback.startedAt === null) {
        if (now - begin >= START_TIMEOUT_MS) return this.recover(playback, 'timeout');
      } else if (++silentTicks >= SILENT_TICKS) {
        // O motor parou sem avisar. Se já deu tempo de falar, foi só o evento de fim que se perdeu.
        const finished = now - playback.startedAt >= expected * 0.6;
        return finished ? this.advance(playback) : this.recover(playback, 'interrupted');
      }
      this.timer = setTimeout(tick, WATCH_INTERVAL_MS);
    };

    this.clearTimer();
    this.timer = setTimeout(tick, WATCH_INTERVAL_MS);
  }

  private waitForReturn(playback: Playback) {
    this.clearTimer();
    playback.utterance = null;
    playback.waitingVisible = true;
  }
}

export const narrator = new Narrator();
