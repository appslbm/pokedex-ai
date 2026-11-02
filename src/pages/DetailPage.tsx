import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { OfficialBadge, RarityBadge, TypeBadge } from '../components/Badges';
import { EvolutionChain } from '../components/detail/EvolutionChain';
import { StatBars } from '../components/detail/StatBars';
import { BackIcon, HeartIcon, NextIcon, SparkleIcon } from '../components/Icons';
import { NarrationBar, type NarrationAction } from '../components/NarrationBar';
import { PokemonImage } from '../components/PokemonImage';
import { ErrorState } from '../components/States';
import { loadAbilities, loadSpecies, spriteUrl, thumbUrl } from '../data/api';
import type { AbilityMap, SpeciesDetail, Variety } from '../data/types';
import { useAsync, useFavorites } from '../hooks/useStores';
import { dexNumber, formatGender, formatHeight, formatWeight } from '../lib/format';
import {
  COLOR_LABEL,
  generationLabel,
  GROWTH_LABEL,
  HABITAT_LABEL,
  REGION_LABEL,
} from '../lib/i18n';
import { characteristicsScript, descriptionScript, nameScript } from '../lib/narration';
import { narrator } from '../lib/speech';
import { defensiveMatchups } from '../lib/typeChart';

const TABS = [
  { id: 'sobre', label: 'Sobre' },
  { id: 'status', label: 'Status' },
  { id: 'evolucao', label: 'Evolução' },
  { id: 'formas', label: 'Formas' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const MAX_SPECIES = 1025;

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value ?? '—'}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function AboutTab({ species, variety, abilities }: { species: SpeciesDetail; variety: Variety; abilities: AbilityMap | null }) {
  const matchups = useMemo(() => defensiveMatchups(variety.types), [variety.types]);
  const [showOriginal, setShowOriginal] = useState(false);
  const description = showOriginal ? species.descriptionEn : (species.description ?? species.descriptionEn);

  return (
    <div className="space-y-4">
      {description && (
        <Panel title="Descrição">
          <p data-testid="description">{description}</p>
          {species.description && (
            <button
              type="button"
              onClick={() => setShowOriginal((v) => !v)}
              className="mt-2 min-h-9 text-[13px] text-muted underline underline-offset-2"
            >
              {showOriginal ? 'Ver tradução automática' : 'Tradução automática. Ver original em inglês'}
            </button>
          )}
        </Panel>
      )}

      <Panel title="Características">
        <dl className="grid grid-cols-2 gap-2">
          <Fact label="Altura" value={formatHeight(variety.height)} />
          <Fact label="Peso" value={formatWeight(variety.weight)} />
          <Fact label="Região" value={REGION_LABEL[variety.region]} />
          <Fact label="Geração" value={generationLabel(species.generation).replace('Geração ', '')} />
          <Fact label="Habitat" value={species.habitat ? HABITAT_LABEL[species.habitat] : null} />
          <Fact label="Cor" value={species.color ? COLOR_LABEL[species.color] : null} />
          <Fact label="Gênero" value={<span className="text-sm whitespace-nowrap">{formatGender(species.genderRate)}</span>} />
          <Fact label="Taxa de captura" value={species.captureRate} />
          <Fact label="Amizade base" value={species.baseHappiness} />
          <Fact label="Crescimento" value={species.growthRate ? GROWTH_LABEL[species.growthRate] : null} />
        </dl>
      </Panel>

      <Panel title="Classificação">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[13px] text-muted">Raridade Pokédex AI</p>
            <RarityBadge rarity={species.rarity} />
            <p className="mt-1.5 text-[13px] leading-snug text-muted">
              Categoria nossa, calculada por captura, força e tempo de eclosão.
            </p>
          </div>
          <div>
            <p className="mb-1 text-[13px] text-muted">Classificação oficial</p>
            <OfficialBadge value={species.officialClass} />
            <p className="mt-1.5 text-[13px] leading-snug text-muted">Definida pelos jogos.</p>
          </div>
        </div>
      </Panel>

      <Panel title="Habilidades">
        <ul className="space-y-3">
          {variety.abilities.map((ability) => {
            const info = abilities?.[ability.slug];
            return (
              <li key={ability.slug}>
                <p className="font-semibold">
                  {info?.name ?? ability.slug}
                  {ability.hidden && (
                    <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">Oculta</span>
                  )}
                </p>
                {(info?.effect ?? info?.effectEn) && <p className="text-sm text-muted">{info?.effect ?? info?.effectEn}</p>}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Fraquezas e resistências">
        <div className="space-y-3">
          <MatchupRow title="Fraco contra" items={matchups.weak.map((m) => ({ type: m.type, tag: `${m.multiplier}×` }))} />
          <MatchupRow title="Resistente a" items={matchups.resist.map((m) => ({ type: m.type, tag: `${String(m.multiplier).replace('.', ',')}×` }))} />
          {matchups.immune.length > 0 && <MatchupRow title="Imune a" items={matchups.immune.map((type) => ({ type, tag: '0×' }))} />}
        </div>
      </Panel>
    </div>
  );
}

function MatchupRow({ title, items }: { title: string; items: { type: Variety['types'][number]; tag: string }[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-muted">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(({ type, tag }) => (
          <span key={type} className="inline-flex items-center gap-1">
            <TypeBadge type={type} size="sm" />
            <span className="tabular text-xs font-semibold text-muted">{tag}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FormsTab({
  species,
  variety,
  shiny,
  onSelect,
}: {
  species: SpeciesDetail;
  variety: Variety;
  shiny: boolean;
  onSelect: (slug: string) => void;
}) {
  const cosmetic = species.varieties.flatMap((v) => v.cosmetic);
  return (
    <div className="space-y-4">
      <Panel title="Normal e Shiny">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Normal', src: spriteUrl(variety.images.art) },
            { label: 'Shiny', src: spriteUrl(variety.images.artShiny) },
          ].map((item) => (
            <figure key={item.label} className="rounded-2xl bg-surface-2 p-2 text-center">
              <PokemonImage sources={[item.src, thumbUrl(variety.id)]} alt={`${variety.label ?? species.name} ${item.label}`} loading="lazy" className="aspect-square w-full object-contain" />
              <figcaption className="mt-1 text-sm font-semibold">{item.label}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">Shiny é só uma variação de cor. Não muda a raridade nem a classificação oficial.</p>
      </Panel>

      {species.varieties.length > 1 && (
        <Panel title={`Formas alternativas (${species.varieties.length - 1})`}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {species.varieties.map((form) => (
              <li key={form.id}>
                <button
                  type="button"
                  onClick={() => onSelect(form.slug)}
                  aria-pressed={form.id === variety.id}
                  data-type={form.types[0]}
                  className={`card-glow flex h-full w-full flex-col items-center rounded-2xl border p-2 text-center ${
                    form.id === variety.id ? 'border-2' : 'border-line'
                  }`}
                  style={form.id === variety.id ? { borderColor: 'var(--t)' } : undefined}
                >
                  <PokemonImage
                    sources={[thumbUrl(form.id), spriteUrl(shiny ? form.images.artShiny : form.images.art)]}
                    alt=""
                    width={96}
                    height={96}
                    loading="lazy"
                    className="size-24 object-contain"
                  />
                  <span className="mt-1 text-sm leading-tight font-semibold">{form.label ?? species.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {cosmetic.length > 0 && (
        <Panel title={`Variações visuais (${cosmetic.length})`}>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {cosmetic.map((form) => (
              <li key={form.id} className="rounded-2xl bg-surface-2 p-1 text-center">
                <PokemonImage
                  sources={[spriteUrl(shiny ? form.spriteShiny : form.sprite), spriteUrl(form.sprite)]}
                  alt=""
                  width={72}
                  height={72}
                  loading="lazy"
                  style={{ imageRendering: 'pixelated' }}
                  className="mx-auto size-[72px] object-contain"
                />
                <p className="text-xs leading-tight">{form.name}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {species.varieties.length === 1 && cosmetic.length === 0 && (
        <p className="px-1 text-muted">Este Pokémon não tem formas alternativas.</p>
      )}
    </div>
  );
}

export function DetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const valid = Number.isInteger(id) && id >= 1 && id <= MAX_SPECIES;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const species = useAsync(() => (valid ? loadSpecies(id) : Promise.reject(new Error('invalid'))), [id, valid]);
  const abilities = useAsync(loadAbilities, []);
  const { isFavorite, toggle } = useFavorites();
  const [tab, setTab] = useState<TabId>('sobre');
  const [shiny, setShiny] = useState(false);

  // Sai da ficha, para a voz.
  useEffect(() => () => narrator.stop(), [id]);
  useEffect(() => {
    setTab('sobre');
    window.scrollTo({ top: 0 });
  }, [id]);

  const detail = species.data;

  useEffect(() => {
    if (detail) document.title = `${detail.name} | Pokédex AI`;
    return () => {
      document.title = 'Pokédex AI';
    };
  }, [detail]);

  if (!valid) {
    return (
      <ErrorState
        title="Pokémon não encontrado"
        message={`Não existe nenhum Pokémon com o número “${rawId}”.`}
        onRetry={() => navigate('/')}
      />
    );
  }

  if (species.error) {
    return <ErrorState title="Não foi possível abrir esta ficha" message="Verifique a conexão e tente de novo." onRetry={species.retry} />;
  }

  if (!detail || detail.id !== id) {
    return (
      <div aria-busy="true" className="p-4">
        <div className="skeleton mx-auto aspect-square w-full max-w-sm rounded-[40px]" />
        <div className="skeleton mt-4 h-8 w-2/3 rounded-xl" />
        <div className="skeleton mt-3 h-40 rounded-3xl" />
      </div>
    );
  }

  const variety =
    detail.varieties.find((v) => v.slug === params.get('forma')) ??
    detail.varieties.find((v) => v.isDefault) ??
    detail.varieties[0];

  const selectVariety = (slug: string) => {
    const next = new URLSearchParams(params);
    const chosen = detail.varieties.find((v) => v.slug === slug);
    if (chosen?.isDefault) next.delete('forma');
    else next.set('forma', slug);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const title = variety.label ?? detail.name;
  const favorite = isFavorite(detail.id);
  const heroSources = shiny
    ? [spriteUrl(variety.images.artShiny), spriteUrl(variety.images.homeShiny), spriteUrl(variety.images.spriteShiny)]
    : [spriteUrl(variety.images.art), spriteUrl(variety.images.home), thumbUrl(variety.id)];

  const descriptionText = descriptionScript(detail);
  const narration: NarrationAction[] = [
    { id: 'name', label: 'Nome', text: nameScript(detail, variety) },
    { id: 'traits', label: 'Características', text: characteristicsScript(detail, variety, abilities.data) },
    ...(descriptionText ? [{ id: 'description', label: 'Descrição', ...descriptionText }] : []),
  ];

  const navButton = 'grid size-11 place-items-center rounded-full bg-surface/80 backdrop-blur';

  return (
    <article data-type={variety.types[0]} className="lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8 lg:px-8 lg:pt-6">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <header className="hero-glow safe-top relative overflow-hidden rounded-b-[36px] pb-5 lg:rounded-[36px]">
          <div className="flex items-center justify-between p-3">
            <button
              type="button"
              aria-label="Voltar"
              className={navButton}
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            >
              <BackIcon />
            </button>
            <span className="tabular font-display text-lg font-bold">{dexNumber(detail.id)}</span>
            <button
              type="button"
              aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              aria-pressed={favorite}
              data-testid="favorite-toggle"
              onClick={() => toggle(detail.id)}
              className={`${navButton} ${favorite ? 'text-brand dark:text-brand-glow' : ''}`}
            >
              <HeartIcon filled={favorite} />
            </button>
          </div>

          <div className="relative mx-auto max-w-[min(78vw,360px)]">
            <PokemonImage
              key={`${variety.id}-${shiny}`}
              sources={heroSources}
              alt={`${title}${shiny ? ' Shiny' : ''}`}
              width={475}
              height={475}
              fetchPriority="high"
              data-testid="hero-image"
              className="animate-float aspect-square w-full object-contain drop-shadow-[0_16px_18px_rgb(0_0_0/0.3)]"
            />
          </div>

          <div className="absolute top-1/2 inset-x-2 flex justify-between">
            {detail.id > 1 ? (
              <Link to={`/pokemon/${detail.id - 1}`} replace aria-label="Pokémon anterior" className={navButton}>
                <BackIcon size={20} />
              </Link>
            ) : <span />}
            {detail.id < MAX_SPECIES ? (
              <Link to={`/pokemon/${detail.id + 1}`} replace aria-label="Próximo Pokémon" className={navButton}>
                <NextIcon size={20} />
              </Link>
            ) : <span />}
          </div>

          <div className="mt-2 px-5 text-center">
            <h1 data-testid="pokemon-name" className="text-[clamp(1.8rem,8vw,2.4rem)] font-bold tracking-tight">
              {title}
            </h1>
            <p className="text-[15px] text-muted">
              {detail.genus}
              {detail.japaneseName ? ` · ${detail.japaneseName}` : ''}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
              {variety.types.map((type) => (
                <TypeBadge key={type} type={type} />
              ))}
              <RarityBadge rarity={detail.rarity} />
            </div>
            <button
              type="button"
              aria-pressed={shiny}
              data-testid="shiny-toggle"
              onClick={() => setShiny((v) => !v)}
              disabled={!variety.images.artShiny}
              className={`mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-40 ${
                shiny ? 'border-transparent bg-ink text-canvas' : 'border-line bg-surface/70'
              }`}
            >
              <SparkleIcon size={17} filled={shiny} />
              {shiny ? 'Mostrando Shiny' : 'Ver Shiny'}
            </button>
          </div>
        </header>
      </div>

      <div className="min-w-0 space-y-4 px-4 pt-4 lg:px-0 lg:pt-0">
        <NarrationBar actions={narration} />

        <div role="tablist" aria-label="Seções da ficha" className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-2 p-1">
          {TABS.map(({ id: tabId, label }) => (
            <button
              key={tabId}
              type="button"
              role="tab"
              id={`tab-${tabId}`}
              aria-selected={tab === tabId}
              aria-controls={`painel-${tabId}`}
              onClick={() => setTab(tabId)}
              className={`min-h-11 rounded-xl text-[13px] font-semibold transition-colors sm:text-sm ${
                tab === tabId ? 'bg-surface shadow-sm' : 'text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`painel-${tab}`} aria-labelledby={`tab-${tab}`} key={tab} className="animate-rise">
          {tab === 'sobre' && <AboutTab species={detail} variety={variety} abilities={abilities.data} />}
          {tab === 'status' && (
            <Panel title="Estatísticas base">
              <StatBars stats={variety.stats} />
            </Panel>
          )}
          {tab === 'evolucao' && (
            <Panel title="Cadeia evolutiva">
              {detail.evolution ? <EvolutionChain root={detail.evolution} currentId={detail.id} /> : <p className="text-muted">Sem dados de evolução.</p>}
            </Panel>
          )}
          {tab === 'formas' && <FormsTab species={detail} variety={variety} shiny={shiny} onSelect={selectVariety} />}
        </div>
      </div>
    </article>
  );
}
