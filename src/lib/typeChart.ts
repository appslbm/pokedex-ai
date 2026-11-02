import type { TypeName } from './i18n';
import { TYPE_NAMES } from './i18n';

/** Multiplicadores de ataque diferentes de 1. Tabela oficial desde a Geração VI. */
const CHART: Record<TypeName, Partial<Record<TypeName, number>>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

export function damageMultiplier(attacker: TypeName, defenders: TypeName[]): number {
  return defenders.reduce((total, defender) => total * (CHART[attacker][defender] ?? 1), 1);
}

export interface Matchups {
  weak: { type: TypeName; multiplier: number }[];
  resist: { type: TypeName; multiplier: number }[];
  immune: TypeName[];
}

/** Como cada tipo de ataque afeta um Pokémon com os tipos informados. */
export function defensiveMatchups(types: TypeName[]): Matchups {
  const result: Matchups = { weak: [], resist: [], immune: [] };
  for (const attacker of TYPE_NAMES) {
    const multiplier = damageMultiplier(attacker, types);
    if (multiplier === 0) result.immune.push(attacker);
    else if (multiplier > 1) result.weak.push({ type: attacker, multiplier });
    else if (multiplier < 1) result.resist.push({ type: attacker, multiplier });
  }
  result.weak.sort((a, b) => b.multiplier - a.multiplier);
  result.resist.sort((a, b) => a.multiplier - b.multiplier);
  return result;
}
