import { splitForSpeech } from './narration';

export type SpeechStatus = 'idle' | 'speaking' | 'paused';

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

class Narrator {
  private listeners = new Set<() => void>();
  private last: SpeechRequest | null = null;
  private session = 0;
  private voices: SpeechSynthesisVoice[] = [];
  private keepAlive: ReturnType<typeof setInterval> | null = null;
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

  stop() {
    if (!this.state.supported) return;
    this.session++;
    this.clearKeepAlive();
    window.speechSynthesis.cancel();
    this.emit({ status: 'idle', label: null });
  }

  private clearKeepAlive() {
    if (this.keepAlive) clearInterval(this.keepAlive);
    this.keepAlive = null;
  }

  private play({ text, lang = 'pt-BR', label }: SpeechRequest) {
    const synth = window.speechSynthesis;
    const session = ++this.session;
    this.clearKeepAlive();
    synth.cancel();

    const chunks = splitForSpeech(text);
    if (!chunks.length) return;
    const voice = pickVoice(this.voices, lang, lang.startsWith('pt') ? this.preferredVoice : null);
    this.emit({ status: 'speaking', label: label ?? null, hasLast: true, error: null });

    let index = 0;
    const next = () => {
      if (session !== this.session) return;
      if (index >= chunks.length) {
        this.clearKeepAlive();
        this.emit({ status: 'idle', label: null });
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index++]);
      utterance.lang = voice?.lang ?? lang;
      if (voice) utterance.voice = voice;
      utterance.rate = this.rate;
      utterance.onend = next;
      utterance.onerror = (event) => {
        if (session !== this.session) return;
        // "interrupted" e "canceled" são consequência normal de parar ou trocar a fala.
        if (event.error === 'interrupted' || event.error === 'canceled') return;
        this.clearKeepAlive();
        this.emit({ status: 'idle', label: null, error: 'Não foi possível reproduzir a voz neste aparelho.' });
      };
      synth.speak(utterance);
    };
    // Chrome no desktop pausa a síntese sozinho depois de cerca de 15 segundos.
    this.keepAlive = setInterval(() => {
      if (synth.speaking && !synth.paused) {
        synth.pause();
        synth.resume();
      }
    }, 10000);
    next();
  }
}

export const narrator = new Narrator();
