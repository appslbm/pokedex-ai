import { useNarrator } from '../hooks/useStores';
import { narrator } from '../lib/speech';
import { RepeatIcon, SpeakerIcon, StopIcon } from './Icons';

export interface NarrationAction {
  id: string;
  label: string;
  text: string;
  lang?: string;
}

/** Controles de narração: falar nome, características e descrição; repetir e parar. */
export function NarrationBar({ actions }: { actions: NarrationAction[] }) {
  const { status, supported, label, hasLast, error } = useNarrator();
  const speaking = status === 'speaking';

  if (!supported) {
    return (
      <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
        A narração por voz não está disponível neste navegador.
      </p>
    );
  }

  return (
    <section aria-label="Narração" className="rounded-3xl border border-line bg-surface p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <SpeakerIcon size={18} className={speaking ? 'text-brand dark:text-brand-glow' : 'text-muted'} />
        <p aria-live="polite" data-testid="narration-status" className="min-w-0 flex-1 truncate text-sm font-medium">
          {speaking ? `Narrando: ${label ?? ''}` : 'Ouvir esta ficha'}
        </p>
        <button
          type="button"
          onClick={() => narrator.repeat()}
          disabled={!hasLast}
          aria-label="Repetir narração"
          data-testid="narration-repeat"
          className="grid size-11 place-items-center rounded-full bg-surface-2 disabled:opacity-40"
        >
          <RepeatIcon size={18} />
        </button>
        <button
          type="button"
          onClick={() => narrator.stop()}
          disabled={!speaking}
          aria-label="Parar narração"
          data-testid="narration-stop"
          className="grid size-11 place-items-center rounded-full bg-brand text-white disabled:bg-surface-2 disabled:text-muted disabled:opacity-40"
        >
          <StopIcon size={18} />
        </button>
      </div>
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            data-testid={`narrate-${action.id}`}
            onClick={() => narrator.speak({ text: action.text, lang: action.lang, label: action.label })}
            aria-pressed={speaking && label === action.label}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
              speaking && label === action.label ? 'bg-brand text-white' : 'bg-surface-2'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-brand dark:text-brand-glow">
          {error}
        </p>
      )}
    </section>
  );
}
