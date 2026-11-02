import { TYPE_LABEL, type TypeName } from '../lib/i18n';
import { OFFICIAL_CLASS_LABEL, RARITY_LABEL, type OfficialClass, type Rarity } from '../lib/rarity';

export function TypeBadge({ type, size = 'md' }: { type: TypeName; size?: 'sm' | 'md' }) {
  return (
    <span
      data-type={type}
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-[13px]'
      }`}
      style={{ background: 'var(--t)', color: 'var(--t-ink)' }}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}

/** Losango usado só para raridade, para nunca ser lido como tipo ou forma Shiny. */
export function RarityGem({ rarity, size = 12 }: { rarity: Rarity; size?: number }) {
  return (
    <span data-rarity={rarity} className="inline-flex" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 12 12">
        <path d="M6 .6 11.4 6 6 11.4.6 6Z" fill="var(--r)" />
        <path d="M6 .6 8.7 3.3 6 6 3.3 3.3Z" fill="#fff" opacity=".35" />
      </svg>
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span
      data-rarity={rarity}
      data-testid="rarity-badge"
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold"
      style={{ color: 'var(--r)', background: 'var(--r-soft)', borderColor: 'var(--r)' }}
    >
      <RarityGem rarity={rarity} />
      {RARITY_LABEL[rarity]}
    </span>
  );
}

export function OfficialBadge({ value }: { value: OfficialClass }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface-2 px-3 py-1 text-[13px] font-semibold">
      {OFFICIAL_CLASS_LABEL[value]}
    </span>
  );
}
