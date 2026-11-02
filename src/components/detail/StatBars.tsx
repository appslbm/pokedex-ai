import { STAT_LABEL } from '../../lib/i18n';

/** 255 é o maior valor base possível nos jogos. */
const MAX_STAT = 255;

export function StatBars({ stats }: { stats: Record<string, number> }) {
  const entries = Object.entries(stats);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[6.5rem_2.25rem_1fr] items-center gap-2">
          <span className="text-sm text-muted">{STAT_LABEL[key] ?? key}</span>
          <span className="tabular text-right text-sm font-semibold">{value}</span>
          <div
            role="meter"
            aria-label={STAT_LABEL[key] ?? key}
            aria-valuemin={0}
            aria-valuemax={MAX_STAT}
            aria-valuenow={value}
            className="h-2.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              key={value}
              className="animate-grow-x h-full rounded-full"
              style={{ width: `${Math.min(100, (value / MAX_STAT) * 100)}%`, background: 'var(--t)' }}
            />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[6.5rem_2.25rem_1fr] items-center gap-2 border-t border-line pt-3">
        <span className="text-sm font-semibold">Total</span>
        <span className="tabular text-right text-sm font-bold" data-testid="stat-total">
          {total}
        </span>
      </div>
    </div>
  );
}
