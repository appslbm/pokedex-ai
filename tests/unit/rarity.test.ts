import { readFileSync } from 'node:fs';
import { classifyOfficial, classifyRarity, rarityScore, type RarityInput } from '../../src/lib/rarity';

const base: RarityInput = { captureRate: 45, baseStatTotal: 500, hatchCounter: 20, isLegendary: false, isMythical: false };

describe('raridade', () => {
  it('coloca Mítico e Lendário no topo independentemente da pontuação', () => {
    expect(classifyRarity({ ...base, captureRate: 255, baseStatTotal: 100, isMythical: true })).toBe('mitico');
    expect(classifyRarity({ ...base, captureRate: 255, baseStatTotal: 100, isLegendary: true })).toBe('lendario');
  });

  it('fica mais alta quanto mais difícil de capturar', () => {
    expect(rarityScore({ ...base, captureRate: 3 })).toBeGreaterThan(rarityScore({ ...base, captureRate: 255 }));
  });

  it('classifica Pokémon comuns como Normal', () => {
    expect(classifyRarity({ ...base, captureRate: 255, baseStatTotal: 253, hatchCounter: 15 })).toBe('normal');
  });

  it('não quebra com dados ausentes', () => {
    expect(rarityScore({ ...base, hatchCounter: null })).toBeGreaterThan(0);
    expect(rarityScore({ ...base, captureRate: 0 })).toBeLessThanOrEqual(1);
  });

  it('separa a classificação oficial da raridade', () => {
    const flags = { isLegendary: false, isMythical: false, isBaby: false };
    expect(classifyOfficial(25, flags)).toBe('padrao');
    expect(classifyOfficial(172, { ...flags, isBaby: true })).toBe('bebe');
    expect(classifyOfficial(793, flags)).toBe('ultra-besta');
    expect(classifyOfficial(984, flags)).toBe('paradoxo');
    expect(classifyOfficial(150, { ...flags, isLegendary: true })).toBe('lendario');
  });

  it('dá a mesma raridade a todas as formas da espécie: Mega não muda a categoria', () => {
    const index = JSON.parse(readFileSync('public/data/index.json', 'utf8')) as {
      entries: { sid: number; rarity: string }[];
    };
    const bySpecies = new Map<number, Set<string>>();
    for (const entry of index.entries) {
      bySpecies.set(entry.sid, (bySpecies.get(entry.sid) ?? new Set()).add(entry.rarity));
    }
    expect([...bySpecies.values()].every((set) => set.size === 1)).toBe(true);
  });
});
