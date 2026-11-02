import { interpret } from './decision';
import type { LoadProgress, ModelManifest, RecognitionResult, Recognizer } from './types';
import type { WorkerRequest, WorkerResponse } from './worker';

interface Pending {
  resolve: (value: { probabilities: Float32Array; elapsedMs: number }) => void;
  reject: (reason: Error) => void;
}

/** Reconhecimento 100% local: a imagem nunca sai do aparelho. */
export class OnDeviceRecognizer implements Recognizer {
  manifest: ModelManifest | null = null;
  backend = '';
  private worker: Worker | null = null;
  private loading: Promise<void> | null = null;
  private nextRequest = 1;
  private pending = new Map<number, Pending>();
  private progressListeners = new Set<(p: LoadProgress) => void>();

  constructor(private readonly manifestUrl: string) {}

  get ready() {
    return this.manifest !== null;
  }

  load(onProgress?: (progress: LoadProgress) => void): Promise<void> {
    if (onProgress) this.progressListeners.add(onProgress);
    if (this.ready) {
      onProgress?.({ phase: 'ready', fraction: 1 });
      return Promise.resolve();
    }
    this.loading ??= this.start().catch((error) => {
      // Permite tentar de novo depois de uma falha de rede.
      this.worker?.terminate();
      this.worker = null;
      this.loading = null;
      throw error;
    });
    return this.loading.finally(() => {
      if (onProgress) this.progressListeners.delete(onProgress);
    });
  }

  private start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      worker.onerror = (event) => reject(new Error(event.message || 'Falha ao iniciar a análise de imagens'));
      worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
        switch (data.kind) {
          case 'progress':
            this.progressListeners.forEach((listener) => listener(data.progress));
            break;
          case 'loaded':
            this.manifest = data.manifest;
            this.backend = data.backend;
            resolve();
            break;
          case 'failed':
            reject(new Error(data.message));
            break;
          case 'result': {
            const pending = this.pending.get(data.requestId);
            this.pending.delete(data.requestId);
            pending?.resolve({ probabilities: data.probabilities, elapsedMs: data.elapsedMs });
            break;
          }
          case 'classify-failed': {
            const pending = this.pending.get(data.requestId);
            this.pending.delete(data.requestId);
            pending?.reject(new Error(data.message));
            break;
          }
        }
      };
      const request: WorkerRequest = {
        kind: 'load',
        manifestUrl: new URL(this.manifestUrl, location.href).href,
      };
      worker.postMessage(request);
    });
  }

  /** Devolve as probabilidades brutas. Usado no modo ao vivo, que precisa suavizá-las. */
  rawClassify(image: ImageData) {
    const worker = this.worker;
    if (!worker || !this.manifest) return Promise.reject(new Error('Modelo não carregado'));
    return new Promise<{ probabilities: Float32Array; elapsedMs: number }>((resolve, reject) => {
      const requestId = this.nextRequest++;
      this.pending.set(requestId, { resolve, reject });
      const request: WorkerRequest = { kind: 'classify', requestId, image };
      worker.postMessage(request, [image.data.buffer]);
    });
  }

  async classify(image: ImageData, options?: { topK?: number }): Promise<RecognitionResult> {
    const { probabilities, elapsedMs } = await this.rawClassify(image);
    return {
      ...interpret(probabilities, this.manifest!, options?.topK),
      elapsedMs,
      backend: this.backend,
    };
  }
}
