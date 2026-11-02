import type { RegionId, TypeName } from '../lib/i18n';
import type { OfficialClass, Rarity } from '../lib/rarity';

/** Registro enxuto do catálogo: um por Pokémon, incluindo formas. */
export interface IndexEntry {
  /** ID do Pokémon na PokéAPI. Formas têm IDs a partir de 10001. */
  id: number;
  /** Número nacional da espécie. */
  sid: number;
  slug: string;
  name: string;
  types: TypeName[];
  gen: number;
  region: RegionId;
  rarity: Rarity;
  bst: number;
  form: boolean;
}

export interface PokedexIndex {
  generatedAt: string;
  entries: IndexEntry[];
}

export interface VarietyImages {
  art: string | null;
  artShiny: string | null;
  home: string | null;
  homeShiny: string | null;
  sprite: string | null;
  spriteShiny: string | null;
}

export interface CosmeticForm {
  id: number;
  name: string;
  sprite: string | null;
  spriteShiny: string | null;
}

export interface Variety {
  id: number;
  slug: string;
  isDefault: boolean;
  label: string | null;
  region: RegionId;
  isMega: boolean;
  isBattleOnly: boolean;
  /** Decímetros, como na PokéAPI. */
  height: number;
  /** Hectogramas, como na PokéAPI. */
  weight: number;
  baseExperience: number | null;
  types: TypeName[];
  abilities: { slug: string; hidden: boolean }[];
  stats: Record<string, number>;
  images: VarietyImages;
  cosmetic: CosmeticForm[];
}

export interface EvolutionNode {
  id: number;
  name: string;
  types: TypeName[];
  thumb: number;
  conditions: string[];
  evolvesTo: EvolutionNode[];
}

export interface SpeciesDetail {
  id: number;
  slug: string;
  name: string;
  japaneseName: string | null;
  genus: string | null;
  genusEn: string | null;
  /** Descrição em português (tradução automática); nula quando ainda não traduzida. */
  description: string | null;
  descriptionEn: string | null;
  generation: number;
  region: RegionId;
  habitat: string | null;
  color: string | null;
  growthRate: string | null;
  captureRate: number | null;
  baseHappiness: number | null;
  /** Oitavos de chance de ser fêmea; -1 indica sem gênero. */
  genderRate: number;
  hatchCounter: number | null;
  isLegendary: boolean;
  isMythical: boolean;
  isBaby: boolean;
  rarity: Rarity;
  rarityScore: number;
  officialClass: OfficialClass;
  evolution: EvolutionNode | null;
  varieties: Variety[];
}

export interface AbilityInfo {
  name: string;
  effect: string | null;
  effectEn: string | null;
}

export type AbilityMap = Record<string, AbilityInfo>;
