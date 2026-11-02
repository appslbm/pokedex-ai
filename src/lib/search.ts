import type { IndexEntry } from '../data/types';
import type { RegionId, TypeName } from './i18n';
import { TYPE_LABEL } from './i18n';
import type { Rarity } from './rarity';
import { RARITIES } from './rarity';

export type SortKey = 'number' | 'name' | 'power' | 'rarity';

export interface CatalogFilters {
  query: string;
  types: TypeName[];
  regions: RegionId[];
  generations: number[];
  rarities: Rarity[];
  includeForms: boolean;
  sort: SortKey;
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: '',
  types: [],
  regions: [],
  generations: [],
  rarities: [],
  includeForms: false,
  sort: 'number',
};

/** "Flabébé" e "flabebe" precisam dar o mesmo resultado. */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9♀♂ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Aceita "25", "025", "#25" e "n 25". Retorna null quando o texto não é um número. */
export function parseDexNumber(query: string): number | null {
  const match = query.trim().match(/^(?:#|n[ºo°.]?\s*)?0*(\d{1,4})$/i);
  return match ? Number(match[1]) : null;
}

interface Searchable {
  entry: IndexEntry;
  haystack: string;
  slug: string;
}

const prepared = new WeakMap<IndexEntry[], Searchable[]>();

function prepare(entries: IndexEntry[]): Searchable[] {
  const cached = prepared.get(entries);
  if (cached) return cached;
  const items = entries.map((entry) => {
    const typeWords = entry.types.map((t) => normalize(TYPE_LABEL[t])).join(' ');
    return {
      entry,
      slug: normalize(entry.slug),
      haystack: `${normalize(entry.name)} ${normalize(entry.slug)} ${typeWords}`,
    };
  });
  prepared.set(entries, items);
  return items;
}

const rarityOrder = (rarity: Rarity) => RARITIES.indexOf(rarity);

function compare(sort: SortKey) {
  return (a: IndexEntry, b: IndexEntry) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name, 'pt-BR');
      case 'power':
        return b.bst - a.bst || a.sid - b.sid;
      case 'rarity':
        return rarityOrder(b.rarity) - rarityOrder(a.rarity) || a.sid - b.sid;
      default:
        return a.sid - b.sid || a.id - b.id;
    }
  };
}

export function searchCatalog(entries: IndexEntry[], filters: CatalogFilters): IndexEntry[] {
  const query = normalize(filters.query);
  const dexNumber = parseDexNumber(filters.query);
  const terms = query.split(' ').filter(Boolean);
  const results: { entry: IndexEntry; rank: number }[] = [];

  for (const { entry, haystack, slug } of prepare(entries)) {
    if (filters.types.length && !filters.types.every((t) => entry.types.includes(t))) continue;
    if (filters.regions.length && !filters.regions.includes(entry.region)) continue;
    if (filters.generations.length && !filters.generations.includes(entry.gen)) continue;
    if (filters.rarities.length && !filters.rarities.includes(entry.rarity)) continue;

    if (dexNumber !== null) {
      // Número de espécie encontra também suas formas, mesmo com a chave de formas desligada.
      if (entry.sid !== dexNumber) continue;
      results.push({ entry, rank: entry.form ? 1 : 0 });
      continue;
    }

    if (entry.form && !filters.includeForms && !terms.length) continue;

    if (terms.length) {
      if (!terms.every((term) => haystack.includes(term))) continue;
      const startsWith = haystack.startsWith(query) || slug.startsWith(query);
      if (entry.form && !filters.includeForms && !startsWith && !query.includes(' ')) continue;
      results.push({ entry, rank: (startsWith ? 0 : 2) + (entry.form ? 1 : 0) });
    } else {
      results.push({ entry, rank: 0 });
    }
  }

  const byField = compare(filters.sort);
  return results
    .sort((a, b) => a.rank - b.rank || byField(a.entry, b.entry))
    .map((r) => r.entry);
}

export function countActiveFilters(filters: CatalogFilters): number {
  return (
    filters.types.length +
    filters.regions.length +
    filters.generations.length +
    filters.rarities.length +
    (filters.includeForms ? 1 : 0)
  );
}

const list = <T extends string>(params: URLSearchParams, key: string, allowed?: readonly T[]) => {
  const values = (params.get(key) ?? '').split(',').filter(Boolean) as T[];
  return allowed ? values.filter((v) => allowed.includes(v)) : values;
};

/** Os filtros vivem na URL: voltar da ficha mantém a busca e o link pode ser compartilhado. */
export function filtersFromParams(params: URLSearchParams): CatalogFilters {
  const sort = params.get('ordem') as SortKey | null;
  return {
    query: params.get('q') ?? '',
    types: list<TypeName>(params, 'tipo', Object.keys(TYPE_LABEL) as TypeName[]),
    regions: list<RegionId>(params, 'regiao'),
    generations: list(params, 'geracao').map(Number).filter((n) => n >= 1 && n <= 9),
    rarities: list<Rarity>(params, 'raridade', RARITIES),
    includeForms: params.get('formas') === '1',
    sort: sort && ['number', 'name', 'power', 'rarity'].includes(sort) ? sort : 'number',
  };
}

export function filtersToParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.types.length) params.set('tipo', filters.types.join(','));
  if (filters.regions.length) params.set('regiao', filters.regions.join(','));
  if (filters.generations.length) params.set('geracao', filters.generations.join(','));
  if (filters.rarities.length) params.set('raridade', filters.rarities.join(','));
  if (filters.includeForms) params.set('formas', '1');
  if (filters.sort !== 'number') params.set('ordem', filters.sort);
  return params;
}
