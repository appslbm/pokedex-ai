import type { AbilityMap, PokedexIndex, SpeciesDetail } from './types';

const BASE = import.meta.env.BASE_URL;
export const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/';

const memo = new Map<string, Promise<unknown>>();

function loadJson<T>(path: string): Promise<T> {
  const cached = memo.get(path) as Promise<T> | undefined;
  if (cached) return cached;
  const request = fetch(`${BASE}${path}`).then((res) => {
    if (!res.ok) throw new Error(`Falha ao carregar ${path} (${res.status})`);
    return res.json() as Promise<T>;
  });
  memo.set(path, request);
  // Não memoriza falhas: a próxima tentativa precisa ir de novo à rede.
  request.catch(() => memo.delete(path));
  return request;
}

export const loadIndex = () => loadJson<PokedexIndex>('data/index.json');
export const loadSpecies = (id: number) => loadJson<SpeciesDetail>(`data/species/${id}.json`);
export const loadAbilities = () => loadJson<AbilityMap>('data/abilities.json');

export const thumbUrl = (id: number) => `${BASE}img/thumb/${id}.webp`;
export const spriteUrl = (path: string | null | undefined) => (path ? SPRITE_BASE + path : null);
