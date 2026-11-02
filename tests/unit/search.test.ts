import { readFileSync } from 'node:fs';
import type { IndexEntry } from '../../src/data/types';
import {
  countActiveFilters,
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToParams,
  normalize,
  parseDexNumber,
  searchCatalog,
} from '../../src/lib/search';

const { entries } = JSON.parse(readFileSync('public/data/index.json', 'utf8')) as { entries: IndexEntry[] };
const run = (patch = {}) => searchCatalog(entries, { ...EMPTY_FILTERS, ...patch });

describe('dados', () => {
  it('traz todos os registros e as 1025 espécies', () => {
    expect(entries).toHaveLength(1351);
    expect(new Set(entries.map((e) => e.sid)).size).toBe(1025);
  });
});

describe('busca', () => {
  it('normaliza acentos', () => {
    expect(normalize('Flabébé')).toBe('flabebe');
  });

  it('interpreta números de várias formas', () => {
    expect(parseDexNumber('25')).toBe(25);
    expect(parseDexNumber('#0025')).toBe(25);
    expect(parseDexNumber('pikachu')).toBeNull();
  });

  it('lista só as espécies por padrão', () => {
    expect(run()).toHaveLength(1025);
    expect(run({ includeForms: true })).toHaveLength(1351);
  });

  it('encontra por nome e prioriza quem começa com o termo', () => {
    expect(run({ query: 'pika' })[0].slug).toBe('pikachu');
    expect(run({ query: 'flabebe' })[0].sid).toBe(669);
  });

  it('encontra por número, incluindo as formas da espécie', () => {
    const results = run({ query: '6' });
    expect(results[0].slug).toBe('charizard');
    expect(results.some((e) => e.slug === 'charizard-mega-x')).toBe(true);
  });

  it('acha formas pelo nome mesmo com a chave desligada', () => {
    expect(run({ query: 'mega charizard' }).map((e) => e.slug)).toContain('charizard-mega-y');
  });

  it('encontra pelo tipo em português', () => {
    expect(run({ query: 'fogo' }).some((e) => e.slug === 'charmander')).toBe(true);
  });

  it('filtra por tipo, exigindo os dois quando há dois', () => {
    const results = run({ types: ['fire', 'flying'] });
    expect(results.map((e) => e.slug)).toContain('charizard');
    expect(results.every((e) => e.types.includes('fire') && e.types.includes('flying'))).toBe(true);
  });

  it('filtra por geração e região', () => {
    expect(run({ generations: [1] })).toHaveLength(151);
    expect(run({ regions: ['kanto'] })).toHaveLength(151);
    expect(run({ regions: ['hisui'] }).map((e) => e.sid)).toContain(899);
    expect(run({ regions: ['hisui'], includeForms: true }).some((e) => e.slug === 'growlithe-hisui')).toBe(true);
  });

  it('filtra por raridade', () => {
    const results = run({ rarities: ['mitico'] });
    expect(results.map((e) => e.slug)).toContain('mew');
    expect(results.every((e) => e.rarity === 'mitico')).toBe(true);
  });

  it('ordena por força', () => {
    const results = run({ sort: 'power' });
    expect(results[0].bst).toBeGreaterThanOrEqual(results[1].bst);
  });

  it('não encontra o que não existe', () => {
    expect(run({ query: 'digimon' })).toHaveLength(0);
    expect(run({ query: '9999' })).toHaveLength(0);
  });

  it('responde rápido com o acervo inteiro', () => {
    const started = performance.now();
    for (let i = 0; i < 100; i++) run({ query: 'char', includeForms: true });
    expect((performance.now() - started) / 100).toBeLessThan(16);
  });

  it('preserva os filtros na URL', () => {
    const filters = { ...EMPTY_FILTERS, query: 'char', types: ['fire' as const], generations: [1, 3], sort: 'power' as const };
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters);
    expect(countActiveFilters(filters)).toBe(3);
  });

  it('ignora valores inválidos na URL', () => {
    const filters = filtersFromParams(new URLSearchParams('tipo=banana,fire&geracao=99,2&raridade=x'));
    expect(filters.types).toEqual(['fire']);
    expect(filters.generations).toEqual([2]);
    expect(filters.rarities).toEqual([]);
  });
});
