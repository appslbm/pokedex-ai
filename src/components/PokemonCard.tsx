import { memo } from 'react';
import { Link } from 'react-router-dom';
import { thumbUrl } from '../data/api';
import type { IndexEntry } from '../data/types';
import { dexNumber } from '../lib/format';
import { RARITY_LABEL } from '../lib/rarity';
import { RarityGem, TypeBadge } from './Badges';
import { PokemonImage } from './PokemonImage';

export const pokemonPath = (entry: Pick<IndexEntry, 'sid' | 'slug' | 'form'>) =>
  entry.form ? `/pokemon/${entry.sid}?forma=${entry.slug}` : `/pokemon/${entry.sid}`;

export const PokemonCard = memo(function PokemonCard({ entry }: { entry: IndexEntry }) {
  return (
    <Link
      to={pokemonPath(entry)}
      data-type={entry.types[0]}
      data-testid="pokemon-card"
      aria-label={`${entry.name}, número ${entry.sid}`}
      className="card-glow group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line p-3 shadow-sm transition-transform duration-200 ease-out-soft hover:-translate-y-0.5 active:scale-[0.97]"
    >
      <div className="flex items-center justify-between">
        <span className="tabular font-display text-[13px] font-semibold text-muted">{dexNumber(entry.sid)}</span>
        <span title={`Raridade: ${RARITY_LABEL[entry.rarity]}`}>
          <RarityGem rarity={entry.rarity} size={13} />
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <PokemonImage
          sources={[thumbUrl(entry.id)]}
          alt=""
          width={192}
          height={192}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 m-auto h-full w-full object-contain transition-transform duration-300 ease-spring group-hover:scale-105"
        />
      </div>
      <h3 className="mt-1 truncate text-[17px] font-semibold">{entry.name}</h3>
      <div className="mt-1 flex gap-1">
        {entry.types.map((type) => (
          <TypeBadge key={type} type={type} size="sm" />
        ))}
      </div>
    </Link>
  );
});
