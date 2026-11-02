import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

interface Props {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Painel inferior no celular, centralizado no desktop. `<dialog>` já cuida do foco e do Esc. */
export function Sheet({ title, open, onClose, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 text-ink backdrop:bg-black/55 md:m-auto md:max-w-xl"
    >
      {open && (
        <div className="animate-sheet safe-bottom flex max-h-[86dvh] flex-col rounded-t-[28px] bg-surface shadow-2xl md:rounded-[28px]">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-xl font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="grid size-11 place-items-center rounded-full bg-surface-2"
            >
              <CloseIcon size={20} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && <div className="border-t border-line p-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
