import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { recognizer, type LoadProgress, type RecognitionResult } from '../ai';
import { interpret, smoothProbabilities } from '../ai/decision';
import { grabSquare } from '../ai/preprocess';
import { TypeBadge } from '../components/Badges';
import {
  ArrowRightIcon,
  CameraIcon,
  CloseIcon,
  LiveIcon,
  LockIcon,
  RepeatIcon,
  SearchIcon,
  SpeakerIcon,
  StopIcon,
  SwitchCameraIcon,
  UploadIcon,
} from '../components/Icons';
import { PokemonImage } from '../components/PokemonImage';
import { loadAbilities, loadIndex, loadSpecies, thumbUrl } from '../data/api';
import type { IndexEntry } from '../data/types';
import { CAMERA_ERROR_MESSAGE, useCamera } from '../hooks/useCamera';
import { useNarrator } from '../hooks/useStores';
import { dexNumber, formatConfidence } from '../lib/format';
import { characteristicsScript, descriptionScript } from '../lib/narration';
import { narrator } from '../lib/speech';

/** O visor cobre 84% do menor lado do vídeo; a análise usa exatamente essa área. */
const VIEWFINDER_SCALE = 0.84;
const LIVE_INTERVAL_MS = 450;

type ModelState =
  | { state: 'idle' }
  | { state: 'loading'; progress: LoadProgress | null }
  | { state: 'ready' }
  | { state: 'error'; message: string };

const PHASE_LABEL: Record<LoadProgress['phase'], string> = {
  manifest: 'Preparando…',
  runtime: 'Preparando o motor de análise…',
  model: 'Baixando o modelo de IA…',
  ready: 'Pronto',
};

function useIndexMap() {
  const [map, setMap] = useState<Map<number, IndexEntry> | null>(null);
  useEffect(() => {
    let active = true;
    loadIndex()
      .then(({ entries }) => {
        if (active) setMap(new Map(entries.filter((e) => !e.form).map((e) => [e.sid, e])));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return map;
}

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div
      role="meter"
      aria-label="Nível de confiança"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className="h-2 overflow-hidden rounded-full bg-surface-2"
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${value * 100}%`, background: 'var(--t, var(--color-brand))' }} />
    </div>
  );
}

function ResultSheet({
  result,
  preview,
  index,
  onClose,
}: {
  result: RecognitionResult;
  preview: string | null;
  index: Map<number, IndexEntry> | null;
  onClose: () => void;
}) {
  const best = result.predictions[0];
  const entry = best ? index?.get(best.speciesId) : undefined;
  const alternatives = result.predictions.slice(result.status === 'identified' ? 1 : 0, 5);
  const { status: voice } = useNarrator();
  const identified = result.status === 'identified' && entry;

  const narrate = async () => {
    if (!entry) return;
    const [species, abilities] = await Promise.all([loadSpecies(entry.sid), loadAbilities()]);
    const variety = species.varieties.find((v) => v.isDefault) ?? species.varieties[0];
    const description = descriptionScript(species);
    narrator.speak({
      text: `${characteristicsScript(species, variety, abilities)} ${description?.lang === 'pt-BR' ? description.text : ''}`,
      label: species.name,
    });
  };

  return (
    <section
      aria-live="polite"
      aria-label="Resultado da identificação"
      data-testid="scan-result"
      data-status={result.status}
      data-species={best?.speciesId}
      data-top={result.predictions.map((p) => p.speciesId).join(',')}
      data-elapsed={Math.round(result.elapsedMs)}
      data-backend={result.backend}
      className="animate-sheet safe-bottom fixed inset-x-0 bottom-0 z-40 max-h-[82dvh] overflow-y-auto rounded-t-[28px] bg-surface text-ink shadow-2xl lg:left-24 lg:mx-auto lg:max-w-xl"
    >
      <div className="sticky top-0 flex items-center justify-between bg-surface px-5 pt-4 pb-2">
        <h2 className="text-lg font-bold">
          {identified ? 'Pokémon identificado' : result.status === 'uncertain' ? 'Não tenho certeza' : 'Não reconheci'}
        </h2>
        <button type="button" onClick={onClose} aria-label="Fechar resultado" className="grid size-11 place-items-center rounded-full bg-surface-2">
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="px-5 pb-5">
        {identified && entry && (
          <div data-type={entry.types[0]} className="card-glow flex items-center gap-3 rounded-3xl border border-line p-3">
            <PokemonImage sources={[thumbUrl(entry.id)]} alt="" width={96} height={96} className="size-24 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <p className="tabular text-[13px] font-semibold text-muted">{dexNumber(entry.sid)}</p>
              <p data-testid="result-name" className="truncate font-display text-2xl font-bold">
                {entry.name}
              </p>
              <div className="mt-1 flex gap-1">
                {entry.types.map((type) => (
                  <TypeBadge key={type} type={type} size="sm" />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1"><ConfidenceBar value={best.probability} /></div>
                <span data-testid="result-confidence" className="tabular text-sm font-bold">{formatConfidence(best.probability)}</span>
              </div>
            </div>
          </div>
        )}

        {!identified && (
          <div className="flex gap-3">
            {preview && <img src={preview} alt="Imagem analisada" className="size-20 shrink-0 rounded-2xl object-cover" />}
            <p className="text-muted">
              {result.status === 'uncertain'
                ? 'Encontrei candidatos, mas nenhum com confiança suficiente. Veja se é um destes:'
                : 'A imagem não parece mostrar um Pokémon que eu conheça. Tente aproximar, centralizar e melhorar a luz.'}
            </p>
          </div>
        )}

        {identified && entry && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={voice === 'speaking' ? () => narrator.stop() : narrate} data-testid="result-narrate" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold">
              {voice === 'speaking' ? <StopIcon size={18} /> : <SpeakerIcon size={18} />}
              {voice === 'speaking' ? 'Parar' : 'Narrar'}
            </button>
            <Link to={`/pokemon/${entry.sid}`} data-testid="result-open" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-white">
              Ver ficha <ArrowRightIcon size={18} />
            </Link>
          </div>
        )}

        {alternatives.length > 0 && result.status !== 'unknown' && (
          <div className="mt-4">
            {identified && <h3 className="mb-1.5 text-sm font-semibold text-muted">Outras possibilidades</h3>}
            <ul className="space-y-1">
              {alternatives.map((prediction) => {
                const alt = index?.get(prediction.speciesId);
                if (!alt) return null;
                return (
                  <li key={prediction.speciesId}>
                    <Link to={`/pokemon/${alt.sid}`} className="flex min-h-14 items-center gap-3 rounded-2xl px-2 active:bg-surface-2">
                      <PokemonImage sources={[thumbUrl(alt.id)]} alt="" width={44} height={44} loading="lazy" className="size-11 object-contain" />
                      <span className="min-w-0 flex-1 truncate font-medium">{alt.name}</span>
                      <span className="tabular text-sm text-muted">{formatConfidence(prediction.probability)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!identified && (
          <Link to="/" className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold">
            <SearchIcon size={18} /> Procurar manualmente
          </Link>
        )}
      </div>
    </section>
  );
}

export function ScannerPage() {
  const { videoRef, status: camera, error: cameraError, canSwitch, start, stop, flip } = useCamera();
  const [model, setModel] = useState<ModelState>({ state: recognizer.ready ? 'ready' : 'idle' });
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [liveResult, setLiveResult] = useState<RecognitionResult | null>(null);
  const index = useIndexMap();
  const fileRef = useRef<HTMLInputElement>(null);
  const smoothed = useRef<Float32Array | null>(null);

  const ensureModel = useCallback(async () => {
    if (recognizer.ready) {
      setModel({ state: 'ready' });
      return true;
    }
    setModel({ state: 'loading', progress: null });
    try {
      await recognizer.load((progress) => setModel({ state: 'loading', progress }));
      setModel({ state: 'ready' });
      return true;
    } catch (error) {
      setModel({ state: 'error', message: error instanceof Error ? error.message : 'Falha desconhecida' });
      return false;
    }
  }, []);

  const showResult = useCallback((next: RecognitionResult) => {
    setResult(next);
    setLive(false);
  }, []);

  const analyze = useCallback(
    async (image: () => ImageData) => {
      setFailure(null);
      setAnalyzing(true);
      try {
        if (!(await ensureModel())) return;
        showResult(await recognizer.classify(image()));
      } catch {
        setFailure('Não foi possível analisar a imagem. Tente outra foto.');
      } finally {
        setAnalyzing(false);
      }
    },
    [ensureModel, showResult],
  );

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const grab = () =>
      grabSquare(video, video.videoWidth, video.videoHeight, recognizer.manifest!.inputSize, VIEWFINDER_SCALE);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 160;
    const side = Math.min(video.videoWidth, video.videoHeight);
    canvas.getContext('2d')?.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, 160, 160);
    setPreview(canvas.toDataURL('image/jpeg', 0.8));
    void analyze(grab);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFailure(null);
    setAnalyzing(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 160;
      const side = Math.min(bitmap.width, bitmap.height);
      canvas.getContext('2d')?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 160, 160);
      setPreview(canvas.toDataURL('image/jpeg', 0.8));
      if (!(await ensureModel())) return;
      const image = grabSquare(bitmap, bitmap.width, bitmap.height, recognizer.manifest!.inputSize);
      bitmap.close();
      showResult(await recognizer.classify(image));
    } catch {
      setFailure('Não consegui abrir esse arquivo. Envie uma imagem JPG, PNG ou WebP.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Modo ao vivo: analisa quadros em sequência, um por vez, sem acumular fila.
  useEffect(() => {
    if (!live || camera !== 'live' || !recognizer.ready) return;
    let running = true;
    smoothed.current = null;
    const loop = async () => {
      while (running) {
        const started = performance.now();
        const video = videoRef.current;
        const manifest = recognizer.manifest;
        if (video?.videoWidth && manifest) {
          try {
            const frame = grabSquare(video, video.videoWidth, video.videoHeight, manifest.inputSize, VIEWFINDER_SCALE);
            const { probabilities, elapsedMs } = await recognizer.rawClassify(frame);
            if (!running) return;
            smoothed.current = smoothProbabilities(smoothed.current, probabilities);
            setLiveResult({ ...interpret(smoothed.current, manifest, 3), elapsedMs, backend: recognizer.backend });
          } catch {
            /* quadro perdido: tenta no próximo ciclo */
          }
        }
        const wait = Math.max(60, LIVE_INTERVAL_MS - (performance.now() - started));
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    };
    void loop();
    return () => {
      running = false;
      setLiveResult(null);
    };
  }, [live, camera, videoRef]);

  useEffect(() => () => narrator.stop(), []);

  const openCamera = async () => {
    setFailure(null);
    void ensureModel();
    await start();
  };

  const toggleLive = async () => {
    if (live) {
      setLive(false);
      return;
    }
    if (await ensureModel()) setLive(true);
  };

  const cameraOn = camera === 'live';
  const liveBest = liveResult?.predictions[0];
  const liveEntry = liveResult?.status === 'identified' && liveBest ? index?.get(liveBest.speciesId) : undefined;
  const cameraMessage = cameraError ? CAMERA_ERROR_MESSAGE[cameraError] : null;
  const loadingFraction = model.state === 'loading' ? (model.progress?.fraction ?? null) : null;

  return (
    <div className="relative flex min-h-dvh flex-col bg-[#0a0d18] pb-[calc(var(--nav-height)+env(safe-area-inset-bottom))] text-white lg:pb-0">
      <header className="safe-top flex items-center gap-3 px-4 pb-2 [--safe-extra:12px]">
        <span className="lens size-9 rounded-full" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Scanner</h1>
          <p className="flex items-center gap-1 text-xs text-white/70">
            <LockIcon size={12} /> Analisado no seu aparelho. A imagem não é enviada.
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-2">
        <div className="relative aspect-square w-full max-w-[min(100%,62dvh)] overflow-hidden rounded-[32px] bg-[#141a2c] ring-1 ring-white/10">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Imagem da câmera"
            data-testid="camera-video"
            className={`absolute inset-0 h-full w-full object-cover ${cameraOn ? '' : 'invisible'}`}
          />

          {cameraOn && (
            <>
              <div className="pointer-events-none absolute inset-[8%] rounded-[26px] border-2 border-white/70" aria-hidden="true" />
              {(analyzing || live) && (
                <div className="animate-scan pointer-events-none absolute inset-x-[8%] h-0.5 bg-lens shadow-[0_0_14px_3px_var(--color-lens)]" aria-hidden="true" />
              )}
              {live && (
                <div data-testid="live-chip" className="animate-fade absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-2xl bg-black/70 px-3 py-2 backdrop-blur">
                  {liveEntry ? (
                    <Link to={`/pokemon/${liveEntry.sid}`} className="flex min-w-0 flex-1 items-center gap-2">
                      <PokemonImage sources={[thumbUrl(liveEntry.id)]} alt="" width={36} height={36} className="size-9 object-contain" />
                      <span className="truncate font-semibold">{liveEntry.name}</span>
                      <span className="tabular ml-auto text-sm">{formatConfidence(liveBest!.probability)}</span>
                    </Link>
                  ) : (
                    <p className="text-sm text-white/80">Aponte para um Pokémon…</p>
                  )}
                </div>
              )}
            </>
          )}

          {!cameraOn && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              {camera === 'requesting' ? (
                <p className="animate-fade text-white/80" role="status">Aguardando permissão da câmera…</p>
              ) : cameraMessage ? (
                <div role="alert" data-testid="camera-error">
                  <h2 className="text-lg font-bold">{cameraMessage.title}</h2>
                  <p className="mt-1 text-sm text-white/75">{cameraMessage.message}</p>
                </div>
              ) : (
                <div>
                  <div className="lens mx-auto size-20 rounded-full" aria-hidden="true" />
                  <h2 className="mt-4 text-lg font-bold">Identifique um Pokémon</h2>
                  <p className="mt-1 text-sm text-white/75">
                    Funciona melhor com cartas, ilustrações e telas. Centralize um Pokémon de cada vez.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {model.state === 'loading' && (
          <div className="w-full max-w-sm" role="status" data-testid="model-progress">
            <p className="mb-1 text-center text-sm text-white/80">
              {model.progress ? PHASE_LABEL[model.progress.phase] : 'Preparando…'}
              {loadingFraction !== null && ` ${Math.round(loadingFraction * 100)}%`}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full rounded-full bg-lens transition-[width] ${loadingFraction === null ? 'w-1/3 animate-pulse' : ''}`}
                style={loadingFraction !== null ? { width: `${loadingFraction * 100}%` } : undefined}
              />
            </div>
          </div>
        )}

        {model.state === 'error' && (
          <div role="alert" data-testid="model-error" className="w-full max-w-sm rounded-2xl bg-white/10 p-3 text-center text-sm">
            <p className="font-semibold">O reconhecimento está indisponível agora.</p>
            <p className="mt-0.5 text-white/75">Verifique a conexão. A busca manual segue funcionando.</p>
            <div className="mt-2 flex justify-center gap-2">
              <button type="button" onClick={() => void ensureModel()} className="min-h-11 rounded-xl bg-white/15 px-4 font-semibold">
                Tentar de novo
              </button>
              <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/15 px-4 font-semibold">
                <SearchIcon size={16} /> Procurar
              </Link>
            </div>
          </div>
        )}

        {failure && <p role="alert" className="text-center text-sm text-[#ffb4b4]">{failure}</p>}

        <div className="flex w-full max-w-sm items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            data-testid="upload-button"
            className="flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl bg-white/10 text-xs font-semibold"
          >
            <UploadIcon size={20} /> Enviar foto
          </button>

          {cameraOn ? (
            <button
              type="button"
              onClick={capture}
              disabled={analyzing}
              aria-label="Capturar foto e identificar"
              data-testid="capture-button"
              className="animate-pulse-ring grid size-[72px] shrink-0 place-items-center rounded-full border-4 border-white bg-brand disabled:opacity-60"
            >
              <CameraIcon size={28} />
            </button>
          ) : (
            <button
              type="button"
              onClick={openCamera}
              disabled={camera === 'requesting'}
              data-testid="open-camera"
              className="grid size-[72px] shrink-0 place-items-center rounded-full border-4 border-white bg-brand disabled:opacity-60"
              aria-label={cameraMessage ? 'Tentar abrir a câmera de novo' : 'Abrir câmera'}
            >
              {cameraMessage ? <RepeatIcon size={26} /> : <CameraIcon size={28} />}
            </button>
          )}

          {cameraOn ? (
            <button
              type="button"
              onClick={toggleLive}
              aria-pressed={live}
              data-testid="live-toggle"
              className={`flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl text-xs font-semibold ${live ? 'bg-lens text-[#04233a]' : 'bg-white/10'}`}
            >
              <LiveIcon size={20} /> Ao vivo
            </button>
          ) : (
            <Link to="/" className="flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl bg-white/10 text-xs font-semibold">
              <SearchIcon size={20} /> Procurar
            </Link>
          )}
        </div>

        {cameraOn && (
          <div className="flex gap-3 text-sm">
            {canSwitch && (
              <button type="button" onClick={() => void flip()} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 font-medium">
                <SwitchCameraIcon size={18} /> Trocar câmera
              </button>
            )}
            <button type="button" onClick={stop} data-testid="close-camera" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/10 px-4 font-medium">
              <CloseIcon size={18} /> Fechar câmera
            </button>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} data-testid="file-input" className="sr-only" tabIndex={-1} aria-label="Enviar foto de um Pokémon" />
      </div>

      {analyzing && !cameraOn && <p role="status" className="pb-2 text-center text-sm text-white/80">Analisando imagem…</p>}

      {result && (
        <ResultSheet
          result={result}
          preview={preview}
          index={index}
          onClose={() => {
            narrator.stop();
            setResult(null);
          }}
        />
      )}
    </div>
  );
}
