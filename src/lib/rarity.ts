/**
 * Classificação de raridade própria do Pokédex AI.
 *
 * ATENÇÃO — três conceitos independentes que NÃO devem ser confundidos:
 *  1. Raridade: categoria criada por este projeto (este arquivo). Não existe nos jogos.
 *  2. Classificação oficial: Lendário, Mítico, Bebê etc., definida pelos jogos.
 *  3. Shiny: variação de cor de um Pokémon. Não altera raridade nem classificação.
 *
 * Mítico e Lendário vêm direto do dado oficial, porque são os topos naturais da escala.
 * Os demais níveis saem de uma pontuação baseada só em dados públicos da PokéAPI.
 */

export const RARITIES = ['normal', 'incomum', 'raro', 'epico', 'lendario', 'mitico'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABEL: Record<Rarity, string> = {
  normal: 'Normal',
  incomum: 'Incomum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
  mitico: 'Mítico',
};

export interface RarityInput {
  captureRate: number;
  baseStatTotal: number;
  hatchCounter: number | null;
  isLegendary: boolean;
  isMythical: boolean;
}

/** Limites mínimos de pontuação de cada nível abaixo de Lendário. */
export const RARITY_THRESHOLDS = { incomum: 0.22, raro: 0.34, epico: 0.47 } as const;

const WEIGHTS = { capture: 0.55, power: 0.3, breeding: 0.15 } as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Pontuação de 0 a 1. Quanto mais difícil de capturar, mais forte e mais demorado de
 * chocar, maior a pontuação. A taxa de captura usa escala logarítmica porque a diferença
 * entre 3 e 45 importa muito mais do que a diferença entre 200 e 255.
 */
export function rarityScore({ captureRate, baseStatTotal, hatchCounter }: RarityInput): number {
  const capture = 1 - Math.log(Math.max(1, captureRate)) / Math.log(255);
  const power = clamp01((baseStatTotal - 200) / 400);
  const breeding = hatchCounter == null ? 0.5 : clamp01((hatchCounter - 5) / 115);
  const score =
    WEIGHTS.capture * clamp01(capture) + WEIGHTS.power * power + WEIGHTS.breeding * breeding;
  return Math.round(score * 1000) / 1000;
}

export function classifyRarity(input: RarityInput): Rarity {
  if (input.isMythical) return 'mitico';
  if (input.isLegendary) return 'lendario';
  const score = rarityScore(input);
  if (score >= RARITY_THRESHOLDS.epico) return 'epico';
  if (score >= RARITY_THRESHOLDS.raro) return 'raro';
  if (score >= RARITY_THRESHOLDS.incomum) return 'incomum';
  return 'normal';
}

export type OfficialClass = 'padrao' | 'bebe' | 'lendario' | 'mitico' | 'ultra-besta' | 'paradoxo';

export const OFFICIAL_CLASS_LABEL: Record<OfficialClass, string> = {
  padrao: 'Padrão',
  bebe: 'Bebê',
  lendario: 'Lendário',
  mitico: 'Mítico',
  'ultra-besta': 'Ultra Besta',
  paradoxo: 'Paradoxo',
};

const ULTRA_BEASTS = new Set([793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806]);
const PARADOX = new Set([
  984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1007, 1008, 1009, 1010,
  1020, 1021, 1022, 1023,
]);

export function classifyOfficial(
  id: number,
  flags: { isLegendary: boolean; isMythical: boolean; isBaby: boolean },
): OfficialClass {
  if (flags.isMythical) return 'mitico';
  if (flags.isLegendary) return 'lendario';
  if (ULTRA_BEASTS.has(id)) return 'ultra-besta';
  if (PARADOX.has(id)) return 'paradoxo';
  if (flags.isBaby) return 'bebe';
  return 'padrao';
}
