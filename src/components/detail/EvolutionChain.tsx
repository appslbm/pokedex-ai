import { Link } from 'react-router-dom';
import { thumbUrl } from '../../data/api';
import type { EvolutionNode } from '../../data/types';
import { dexNumber } from '../../lib/format';
import { TypeBadge } from '../Badges';
import { ArrowRightIcon } from '../Icons';
import { PokemonImage } from '../PokemonImage';

function StageCard({ node, current }: { node: EvolutionNode; current: boolean }) {
  return (
    <Link
      to={`/pokemon/${node.id}`}
      data-type={node.types[0]}
      aria-current={current ? 'page' : undefined}
      className={`card-glow flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-2.5 transition-transform active:scale-[0.98] ${
        current ? 'border-2' : 'border-line'
      }`}
      style={current ? { borderColor: 'var(--t)' } : undefined}
    >
      <PokemonImage sources={[thumbUrl(node.thumb)]} alt="" width={64} height={64} loading="lazy" className="size-16 shrink-0 object-contain" />
      <span className="min-w-0">
        <span className="tabular block text-xs font-semibold text-muted">{dexNumber(node.id)}</span>
        <span className="block truncate font-display font-semibold">{node.name}</span>
        <span className="mt-0.5 flex gap-1">
          {node.types.map((type) => (
            <TypeBadge key={type} type={type} size="sm" />
          ))}
        </span>
      </span>
    </Link>
  );
}

function Branch({ node, currentId }: { node: EvolutionNode; currentId: number }) {
  return (
    <div>
      <StageCard node={node} current={node.id === currentId} />
      {node.evolvesTo.length > 0 && (
        <ul className="mt-2 space-y-2 border-l-2 border-line pl-3">
          {node.evolvesTo.map((child) => (
            <li key={child.id}>
              <p className="mb-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-muted">
                <ArrowRightIcon size={14} className="mt-0.5 shrink-0" />
                <span>{child.conditions.join(' ou ') || 'Condição especial'}</span>
              </p>
              <Branch node={child} currentId={currentId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EvolutionChain({ root, currentId }: { root: EvolutionNode; currentId: number }) {
  if (root.evolvesTo.length === 0) {
    return <p className="text-muted">Este Pokémon não evolui nem tem pré-evolução conhecida.</p>;
  }
  return <Branch node={root} currentId={currentId} />;
}
