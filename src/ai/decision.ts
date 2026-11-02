import type { ModelManifest, Prediction, RecognitionStatus } from './types';

/** Softmax com temperatura. Trabalha em log para não estourar com logits grandes. */
export function softmax(logits: ArrayLike<number>, temperature = 1): Float32Array {
  const output = new Float32Array(logits.length);
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i];
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    output[i] = Math.exp((logits[i] - max) / temperature);
    sum += output[i];
  }
  for (let i = 0; i < logits.length; i++) output[i] /= sum;
  return output;
}

export interface Interpretation {
  status: RecognitionStatus;
  predictions: Prediction[];
  notPokemonProbability: number;
}

/**
 * Transforma as probabilidades do modelo em uma decisão.
 *
 * Esta função é o que separa "identificou" de "chutou": uma foto de um objeto qualquer
 * sempre produz alguma classe mais provável, então a decisão precisa considerar a classe
 * "não é Pokémon" e os limites calibrados. Sem isso, tudo pareceria um Pokémon.
 */
export function interpret(
  probabilities: ArrayLike<number>,
  manifest: Pick<ModelManifest, 'labels' | 'thresholds'>,
  topK = 5,
): Interpretation {
  const { labels, thresholds } = manifest;
  let notPokemonProbability = 0;
  const predictions: Prediction[] = [];
  for (let i = 0; i < probabilities.length; i++) {
    if (labels[i] === 0) notPokemonProbability = probabilities[i];
    else predictions.push({ speciesId: labels[i], probability: probabilities[i] });
  }
  predictions.sort((a, b) => b.probability - a.probability);
  const top = predictions.slice(0, topK);
  const best = top[0]?.probability ?? 0;

  let status: RecognitionStatus;
  if (notPokemonProbability >= thresholds.notPokemon || best < thresholds.suggest) status = 'unknown';
  else if (best >= thresholds.identified) status = 'identified';
  else status = 'uncertain';

  return { status, predictions: top, notPokemonProbability };
}

/**
 * Suaviza as previsões do modo ao vivo. Quadros isolados oscilam muito, e sem isso
 * o nome na tela ficaria trocando a cada instante enquanto a câmera se move.
 */
export function smoothProbabilities(
  previous: Float32Array | null,
  current: Float32Array,
  weight = 0.4,
): Float32Array {
  if (!previous || previous.length !== current.length) return current;
  const output = new Float32Array(current.length);
  for (let i = 0; i < current.length; i++) {
    output[i] = previous[i] * (1 - weight) + current[i] * weight;
  }
  return output;
}
