import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterSheet } from '../components/FilterSheet';
import { CloseIcon, FilterIcon, SearchIcon } from '../components/Icons';
import { EmptyState, ErrorState, GridSkeleton } from '../components/States';
import { VirtualGrid } from '../components/VirtualGrid';
import { loadIndex } from '../data/api';
import { useAsync } from '../hooks/useStores';
import { generationLabel, REGION_LABEL, TYPE_LABEL } from '../lib/i18n';
import { RARITY_LABEL } from '../lib/rarity';
import {
  countActiveFilters,
  filtersFromParams,
  filtersToParams,
  searchCatalog,
  type CatalogFilters,
} from '../lib/search';

export function DexBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 text-white">
      <span className="lens size-11 shrink-0 rounded-full" aria-hidden="true" />
      <span className="flex gap-1.5 self-start pt-1" aria-hidden="true">
        <span className="led size-2.5 bg-[#ff6b6b]" />
        <span className="led size-2.5 bg-[#ffd93d]" />
        <span className="led size-2.5 bg-[#6bcb77]" />
      </span>
      <div className="ml-auto text-right">
        <p className="font-display text-xl leading-none font-bold tracking-tight">Pokédex AI</p>
        {subtitle && <p className="mt-1 text-xs text-white/85">{subtitle}</p>}
      </div>
    </div>
  );
}

export function CatalogPage() {
  const { data, error, loading, retry } = useAsync(loadIndex, []);
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState(filters.query);
  const deferredQuery = useDeferredValue(query);

  const update = (next: CatalogFilters) => setParams(filtersToParams(next), { replace: true, preventScrollReset: true });

  useEffect(() => {
    if (deferredQuery !== filters.query) update({ ...filters, query: deferredQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQuery]);

  const effective = useMemo(() => ({ ...filters, query: deferredQuery }), [filters, deferredQuery]);
  const results = useMemo(() => (data ? searchCatalog(data.entries, effective) : []), [data, effective]);

  const pills = [
    ...filters.types.map((t) => ({ key: `t-${t}`, label: TYPE_LABEL[t], clear: { types: filters.types.filter((v) => v !== t) } })),
    ...filters.regions.map((r) => ({ key: `r-${r}`, label: REGION_LABEL[r], clear: { regions: filters.regions.filter((v) => v !== r) } })),
    ...filters.generations.map((g) => ({ key: `g-${g}`, label: generationLabel(g), clear: { generations: filters.generations.filter((v) => v !== g) } })),
    ...filters.rarities.map((r) => ({ key: `x-${r}`, label: RARITY_LABEL[r], clear: { rarities: filters.rarities.filter((v) => v !== r) } })),
    ...(filters.includeForms ? [{ key: 'forms', label: 'Formas', clear: { includeForms: false } }] : []),
  ];

  const activeCount = countActiveFilters(filters);

  return (
    <>
      <header className="dex-header safe-top px-4 [--safe-extra:12px] pb-2 lg:px-8">
        <DexBrand subtitle={data ? `${data.entries.filter((e) => !e.form).length.toLocaleString('pt-BR')} espécies` : undefined} />
        <h1 className="sr-only">Pokédex: lista de Pokémon</h1>
      </header>

      <div className="dex-header sticky top-0 z-20 rounded-b-[26px] px-4 pb-3 lg:px-8" style={{ boxShadow: undefined }}>
        <div className="flex gap-2">
          <label className="relative flex min-w-0 flex-1 items-center">
            <span className="sr-only">Buscar por nome ou número</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 text-muted" size={20} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, número ou tipo"
              enterKeyHint="search"
              autoComplete="off"
              data-testid="search-input"
              className="h-12 w-full rounded-2xl bg-surface pr-11 pl-11 text-base text-ink outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                className="absolute right-1 grid size-10 place-items-center rounded-full text-muted"
              >
                <CloseIcon size={18} />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={activeCount ? `Filtros, ${activeCount} ativos` : 'Filtros'}
            data-testid="open-filters"
            className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-surface text-ink"
          >
            <FilterIcon size={22} />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-[#ffd93d] text-[11px] font-bold text-black">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <section aria-label="Resultados" className="mx-auto max-w-7xl px-4 pt-4 lg:px-8">
        <div className="mb-3 flex min-h-8 items-center gap-2">
          <p aria-live="polite" data-testid="result-count" className="shrink-0 text-sm font-medium text-muted">
            {data ? `${results.length.toLocaleString('pt-BR')} ${results.length === 1 ? 'resultado' : 'resultados'}` : 'Carregando…'}
          </p>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {pills.map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => update({ ...filters, ...pill.clear })}
                aria-label={`Remover filtro ${pill.label}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-[13px] font-medium"
              >
                {pill.label}
                <CloseIcon size={13} />
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorState title="Não foi possível carregar a Pokédex" message="Verifique a conexão e tente de novo." onRetry={retry} />}
        {loading && !data && <GridSkeleton />}
        {data && results.length > 0 && <VirtualGrid items={results} />}
        {data && results.length === 0 && (
          <EmptyState title="Nada por aqui">
            <p>Nenhum Pokémon combina com essa busca. Tente outro nome ou remova alguns filtros.</p>
          </EmptyState>
        )}
      </section>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={update}
        resultCount={results.length}
      />
    </>
  );
}
