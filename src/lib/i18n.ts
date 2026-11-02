/** Dicionários fixos em pt-BR. A PokéAPI não traz nenhum texto em português. */

export const TYPE_LABEL = {
  normal: 'Normal',
  fighting: 'Lutador',
  flying: 'Voador',
  poison: 'Venenoso',
  ground: 'Terrestre',
  rock: 'Pedra',
  bug: 'Inseto',
  ghost: 'Fantasma',
  steel: 'Aço',
  fire: 'Fogo',
  water: 'Água',
  grass: 'Planta',
  electric: 'Elétrico',
  psychic: 'Psíquico',
  ice: 'Gelo',
  dragon: 'Dragão',
  dark: 'Sombrio',
  fairy: 'Fada',
} as const;

export type TypeName = keyof typeof TYPE_LABEL;
export const TYPE_NAMES = Object.keys(TYPE_LABEL) as TypeName[];

export const REGIONS = [
  { id: 'kanto', label: 'Kanto' },
  { id: 'johto', label: 'Johto' },
  { id: 'hoenn', label: 'Hoenn' },
  { id: 'sinnoh', label: 'Sinnoh' },
  { id: 'unova', label: 'Unova' },
  { id: 'kalos', label: 'Kalos' },
  { id: 'alola', label: 'Alola' },
  { id: 'galar', label: 'Galar' },
  { id: 'hisui', label: 'Hisui' },
  { id: 'paldea', label: 'Paldea' },
] as const;

export type RegionId = (typeof REGIONS)[number]['id'];

export const REGION_LABEL = Object.fromEntries(REGIONS.map((r) => [r.id, r.label])) as Record<
  RegionId,
  string
>;

export const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
export const generationLabel = (gen: number) => `Geração ${ROMAN[gen - 1] ?? gen}`;

export const STAT_LABEL: Record<string, string> = {
  hp: 'PS',
  attack: 'Ataque',
  defense: 'Defesa',
  'special-attack': 'Ataque Esp.',
  'special-defense': 'Defesa Esp.',
  speed: 'Velocidade',
};

/** Rótulo por extenso, usado na narração (leitores de tela e voz não lidam bem com abreviações). */
export const STAT_SPOKEN: Record<string, string> = {
  hp: 'pontos de saúde',
  attack: 'ataque',
  defense: 'defesa',
  'special-attack': 'ataque especial',
  'special-defense': 'defesa especial',
  speed: 'velocidade',
};

export const HABITAT_LABEL: Record<string, string> = {
  cave: 'Cavernas',
  forest: 'Florestas',
  grassland: 'Campos',
  mountain: 'Montanhas',
  rare: 'Raro',
  'rough-terrain': 'Terreno acidentado',
  sea: 'Mar',
  urban: 'Áreas urbanas',
  'waters-edge': 'Beira d’água',
};

export const COLOR_LABEL: Record<string, string> = {
  black: 'Preto',
  blue: 'Azul',
  brown: 'Marrom',
  gray: 'Cinza',
  green: 'Verde',
  pink: 'Rosa',
  purple: 'Roxo',
  red: 'Vermelho',
  white: 'Branco',
  yellow: 'Amarelo',
};

export const GROWTH_LABEL: Record<string, string> = {
  slow: 'Lento',
  medium: 'Médio',
  fast: 'Rápido',
  'medium-slow': 'Médio-lento',
  'slow-then-very-fast': 'Errático',
  'fast-then-very-slow': 'Flutuante',
};
