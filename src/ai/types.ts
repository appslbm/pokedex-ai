/**
 * Contrato da camada de reconhecimento. A interface visual só conhece estes tipos.
 * Para trocar o processamento local por um serviço externo, basta outra implementação
 * de `Recognizer` em src/ai/index.ts; nada mais precisa mudar.
 */

export interface ModelManifest {
  version: string;
  file: string;
  bytes: number;
  inputSize: number;
  mean: [number, number, number];
  std: [number, number, number];
  /** Temperatura calibrada no conjunto de validação: torna a confiança honesta. */
  temperature: number;
  /** Índice de saída do modelo para o número nacional. O valor 0 significa "não é Pokémon". */
  labels: number[];
  thresholds: {
    /** A partir daqui o resultado é apresentado como identificação. */
    identified: number;
    /** Abaixo disso nem chega a sugerir: a imagem é tratada como desconhecida. */
    suggest: number;
    /** Probabilidade de "não é Pokémon" que encerra a análise. */
    notPokemon: number;
  };
}

export interface Prediction {
  speciesId: number;
  probability: number;
}

export type RecognitionStatus =
  /** Confiança suficiente para afirmar qual é o Pokémon. */
  | 'identified'
  /** Há candidatos, mas sem certeza: a interface mostra como sugestões. */
  | 'uncertain'
  /** O modelo acredita que a imagem não mostra um Pokémon, ou nada passou do mínimo. */
  | 'unknown';

export interface RecognitionResult {
  status: RecognitionStatus;
  predictions: Prediction[];
  notPokemonProbability: number;
  elapsedMs: number;
  backend: string;
}

export type LoadPhase = 'manifest' | 'runtime' | 'model' | 'ready';

export interface LoadProgress {
  phase: LoadPhase;
  /** De 0 a 1; nulo quando o tamanho total é desconhecido. */
  fraction: number | null;
}

export interface Recognizer {
  readonly manifest: ModelManifest | null;
  readonly ready: boolean;
  load(onProgress?: (progress: LoadProgress) => void): Promise<void>;
  /** A imagem já deve estar recortada no tamanho de entrada do modelo. */
  classify(image: ImageData, options?: { topK?: number }): Promise<RecognitionResult>;
}
