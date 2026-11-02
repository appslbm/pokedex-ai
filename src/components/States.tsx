import type { ReactNode } from 'react';
import { AlertIcon } from './Icons';

export function ErrorState({
  title = 'Algo deu errado',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="mx-auto max-w-sm px-6 py-14 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-surface-2 text-brand">
        <AlertIcon />
      </div>
      <h2 className="mt-4 text-xl font-bold">{title}</h2>
      <p className="mt-1 text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-5 min-h-12 rounded-2xl bg-brand px-6 font-semibold text-white">
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm px-6 py-14 text-center animate-rise">
      <div className="lens mx-auto size-16 rounded-full opacity-80" aria-hidden="true" />
      <h2 className="mt-5 text-xl font-bold">{title}</h2>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="skeleton h-56 rounded-3xl" />
      ))}
    </div>
  );
}
