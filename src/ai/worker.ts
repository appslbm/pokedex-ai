/// <reference lib="webworker" />
/**
 * Roda o modelo fora da thread principal, para a interface não travar durante a análise.
 *
 * O GitHub Pages não permite configurar os cabeçalhos COOP/COEP, então o WASM com
 * múltiplas threads não está disponível: a inferência usa uma thread, com SIMD. O modelo
 * é quantizado (int8), formato em que o WASM funciona melhor do que WebGPU.
 */
import { imageDataToTensor } from './preprocess';
import { softmax } from './decision';
import type { LoadProgress, ModelManifest } from './types';

type Ort = typeof import('onnxruntime-web');

export type WorkerRequest =
  | { kind: 'load'; manifestUrl: string }
  | { kind: 'classify'; requestId: number; image: ImageData };

export type WorkerResponse =
  | { kind: 'progress'; progress: LoadProgress }
  | { kind: 'loaded'; manifest: ModelManifest; backend: string }
  | { kind: 'failed'; message: string }
  | { kind: 'result'; requestId: number; probabilities: Float32Array; elapsedMs: number }
  | { kind: 'classify-failed'; requestId: number; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
const MODEL_CACHE = 'pokedex-vision';

let ort: Ort | null = null;
let session: import('onnxruntime-web').InferenceSession | null = null;
let manifest: ModelManifest | null = null;

const post = (message: WorkerResponse, transfer: Transferable[] = []) =>
  scope.postMessage(message, transfer);

const openCache = async () =>
  'caches' in scope ? scope.caches.open(MODEL_CACHE).catch(() => null) : null;

/** Prefere a rede, para receber versões novas. Sem conexão, usa a última cópia guardada. */
async function fetchManifest(url: string): Promise<ModelManifest> {
  const cache = await openCache();
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Modelo indisponível (${response.status})`);
    await cache?.put(url, response.clone()).catch(() => undefined);
    return (await response.json()) as ModelManifest;
  } catch (error) {
    const cached = await cache?.match(url);
    if (!cached) throw error;
    return (await cached.json()) as ModelManifest;
  }
}

/**
 * Baixa o modelo com progresso. O Cache Storage evita baixar de novo nas próximas visitas e
 * permite identificar sem internet. A versão na URL impede o uso de pesos antigos.
 */
async function fetchModel(url: string, expected: number): Promise<Uint8Array> {
  const cache = await openCache();
  const cached = await cache?.match(url);
  if (cached) {
    post({ kind: 'progress', progress: { phase: 'model', fraction: 1 } });
    return new Uint8Array(await cached.arrayBuffer());
  }

  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Falha ao baixar o modelo (${response.status})`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    post({
      kind: 'progress',
      progress: { phase: 'model', fraction: expected ? Math.min(1, received / expected) : null },
    });
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  if (expected && received !== expected) {
    throw new Error('O download do modelo veio incompleto. Tente novamente.');
  }
  await cache
    ?.put(url, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }))
    .catch(() => undefined);
  // Remove versões anteriores para não ocupar espaço à toa.
  const { pathname } = new URL(url);
  for (const key of (await cache?.keys()) ?? []) {
    const old = new URL(key.url);
    if (old.pathname === pathname && key.url !== url) await cache?.delete(key);
  }
  return bytes;
}

async function load(manifestUrl: string) {
  post({ kind: 'progress', progress: { phase: 'manifest', fraction: null } });
  manifest = await fetchManifest(manifestUrl);

  post({ kind: 'progress', progress: { phase: 'runtime', fraction: null } });
  ort = (await import('onnxruntime-web/wasm')) as unknown as Ort;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.logLevel = 'error';

  const modelUrl = new URL(manifest.file, manifestUrl);
  modelUrl.searchParams.set('v', manifest.version);
  const bytes = await fetchModel(modelUrl.href, manifest.bytes);

  session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });

  post({ kind: 'progress', progress: { phase: 'ready', fraction: 1 } });
  post({ kind: 'loaded', manifest, backend: 'wasm' });
}

async function classify(requestId: number, image: ImageData) {
  if (!session || !manifest || !ort) throw new Error('Modelo não carregado');
  const start = performance.now();
  const tensor = new ort.Tensor('float32', imageDataToTensor(image, manifest.mean, manifest.std), [
    1,
    3,
    image.height,
    image.width,
  ]);
  const outputs = await session.run({ [session.inputNames[0]]: tensor });
  const logits = outputs[session.outputNames[0]].data as Float32Array;
  const probabilities = softmax(logits, manifest.temperature);
  post(
    { kind: 'result', requestId, probabilities, elapsedMs: performance.now() - start },
    [probabilities.buffer],
  );
}

scope.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.kind === 'load') {
    try {
      await load(data.manifestUrl);
    } catch (error) {
      post({ kind: 'failed', message: error instanceof Error ? error.message : String(error) });
    }
  } else {
    try {
      await classify(data.requestId, data.image);
    } catch (error) {
      post({
        kind: 'classify-failed',
        requestId: data.requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
