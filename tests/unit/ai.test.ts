import { interpret, smoothProbabilities, softmax } from '../../src/ai/decision';
import { centerSquare, imageDataToTensor } from '../../src/ai/preprocess';

const manifest = {
  labels: [0, 1, 4, 7, 25],
  thresholds: { identified: 0.6, suggest: 0.2, notPokemon: 0.5 },
};

describe('softmax', () => {
  it('soma 1 e mantém a ordem', () => {
    const output = softmax([1, 3, 2]);
    expect(output.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(output[1]).toBeGreaterThan(output[2]);
  });

  it('não estoura com logits enormes', () => {
    expect(Number.isNaN(softmax([9000, 8999])[0])).toBe(false);
  });

  it('temperatura maior reduz a confiança', () => {
    expect(softmax([4, 0], 3)[0]).toBeLessThan(softmax([4, 0], 1)[0]);
  });
});

describe('decisão', () => {
  it('afirma quando a confiança é alta', () => {
    const result = interpret([0.05, 0.02, 0.03, 0.05, 0.85], manifest);
    expect(result.status).toBe('identified');
    expect(result.predictions[0].speciesId).toBe(25);
  });

  it('só sugere quando há dúvida', () => {
    expect(interpret([0.1, 0.3, 0.3, 0.2, 0.1], manifest).status).toBe('uncertain');
  });

  it('recusa quando o modelo vê que não é Pokémon, mesmo com outra classe razoável', () => {
    const result = interpret([0.55, 0.05, 0.05, 0.05, 0.3], manifest);
    expect(result.status).toBe('unknown');
    expect(result.notPokemonProbability).toBeCloseTo(0.55);
  });

  it('recusa quando nada se destaca', () => {
    const strict = { ...manifest, thresholds: { ...manifest.thresholds, suggest: 0.25 } };
    expect(interpret([0.2, 0.2, 0.2, 0.2, 0.2], strict).status).toBe('unknown');
  });

  it('nunca lista "não é Pokémon" como candidato', () => {
    expect(interpret([0.9, 0.1, 0, 0, 0], manifest).predictions.every((p) => p.speciesId !== 0)).toBe(true);
  });

  it('suaviza quadros isolados do modo ao vivo', () => {
    const steady = new Float32Array([1, 0]);
    const glitch = new Float32Array([0, 1]);
    expect(smoothProbabilities(steady, glitch)[0]).toBeGreaterThan(0.5);
    expect(smoothProbabilities(null, glitch)).toBe(glitch);
  });
});

describe('pré-processamento', () => {
  it('recorta o quadrado central', () => {
    expect(centerSquare(1000, 500)).toEqual({ x: 250, y: 0, size: 500 });
    expect(centerSquare(500, 1000, 0.8)).toEqual({ x: 50, y: 300, size: 400 });
  });

  it('gera tensor CHW normalizado', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const tensor = imageDataToTensor({ data, width: 2, height: 1 }, [0, 0, 0], [1, 1, 1]);
    expect(Array.from(tensor)).toEqual([1, 0, 0, 1, 0, 0]);
  });
});
