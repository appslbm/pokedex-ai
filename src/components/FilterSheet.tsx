import type { ReactNode } from 'react';
import { GENERATIONS, REGIONS, TYPE_LABEL, TYPE_NAMES, generationLabel } from '../lib/i18n';
import { EMPTY_FILTERS, type CatalogFilters, type SortKey } from '../lib/search';
import { RARITIES, RARITY_LABEL } from '../lib/rarity';
import { RarityGem } from './Badges';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  filters: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
  resultCount: number;
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'number', label: 'Número' },
  { value: 'name', label: 'Nome' },
  { value: 'power', label: 'Força total' },
  { value: 'rarity', label: 'Raridade' },
];

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="mt-5 first:mt-1">
      <legend className="font-display text-[15px] font-semibold">{title}</legend>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  children,
  type,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  type?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-type={type}
      style={active && type ? { background: 'var(--t)', color: 'var(--t-ink)', borderColor: 'transparent' } : undefined}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors duration-150 ${
        active ? 'border-transparent bg-ink text-canvas' : 'border-line bg-surface-2 text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export function FilterSheet({ open, onClose, filters, onChange, resultCount }: Props) {
  const clear = () => onChange({ ...EMPTY_FILTERS, query: filters.query, sort: filters.sort });

  return (
    <Sheet
      title="Filtros"
      open={open}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={clear} className="min-h-12 rounded-2xl bg-surface-2 px-5 font-semibold">
            Limpar
          </button>
          <button
            type="button"
            onClick={onClose}
            data-testid="apply-filters"
            className="min-h-12 flex-1 rounded-2xl bg-brand px-5 font-semibold text-white"
          >
            Ver {resultCount.toLocaleString('pt-BR')} {resultCount === 1 ? 'resultado' : 'resultados'}
          </button>
        </div>
      }
    >
      <Section title="Ordenar por">
        {SORTS.map((sort) => (
          <Chip key={sort.value} active={filters.sort === sort.value} onClick={() => onChange({ ...filters, sort: sort.value })}>
            {sort.label}
          </Chip>
        ))}
      </Section>

      <Section title="Tipo" hint="Com dois tipos, mostra quem tem os dois.">
        {TYPE_NAMES.map((type) => (
          <Chip
            key={type}
            type={type}
            active={filters.types.includes(type)}
            onClick={() => onChange({ ...filters, types: toggle(filters.types, type) })}
          >
            {TYPE_LABEL[type]}
          </Chip>
        ))}
      </Section>

      <Section title="Região">
        {REGIONS.map((region) => (
          <Chip
            key={region.id}
            active={filters.regions.includes(region.id)}
            onClick={() => onChange({ ...filters, regions: toggle(filters.regions, region.id) })}
          >
            {region.label}
          </Chip>
        ))}
      </Section>

      <Section title="Geração">
        {GENERATIONS.map((gen) => (
          <Chip
            key={gen}
            active={filters.generations.includes(gen)}
            onClick={() => onChange({ ...filters, generations: toggle(filters.generations, gen) })}
          >
            {generationLabel(gen)}
          </Chip>
        ))}
      </Section>

      <Section title="Raridade" hint="Categoria criada pela Pokédex AI. Não existe nos jogos.">
        {RARITIES.map((rarity) => (
          <Chip
            key={rarity}
            active={filters.rarities.includes(rarity)}
            onClick={() => onChange({ ...filters, rarities: toggle(filters.rarities, rarity) })}
          >
            <RarityGem rarity={rarity} />
            {RARITY_LABEL[rarity]}
          </Chip>
        ))}
      </Section>

      <Section title="Formas">
        <Chip
          active={filters.includeForms}
          onClick={() => onChange({ ...filters, includeForms: !filters.includeForms })}
        >
          Incluir formas alternativas
        </Chip>
      </Section>
    </Sheet>
  );
}
