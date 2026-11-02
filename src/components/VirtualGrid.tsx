import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useRef, useState } from 'react';
import type { IndexEntry } from '../data/types';
import { PokemonCard } from './PokemonCard';

const GAP = 12;
const MIN_CARD = 156;
/** Altura fixa do texto do cartão; o resto é a imagem, quase quadrada. */
const TEXT_HEIGHT = 96;

/**
 * Renderiza apenas as linhas visíveis. Mesmo com 1351 registros, o DOM fica com
 * poucas dezenas de cartões, o que mantém a rolagem fluida em celulares simples.
 */
export function VirtualGrid({ items }: { items: IndexEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [marginTop, setMarginTop] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      setWidth(element.clientWidth);
      setMarginTop(element.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const columns = Math.max(2, Math.floor((width + GAP) / (MIN_CARD + GAP)));
  const cardWidth = width ? (width - GAP * (columns - 1)) / columns : MIN_CARD;
  const rowHeight = Math.round(cardWidth * 0.82 + TEXT_HEIGHT);
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight + GAP,
    overscan: 5,
    scrollMargin: marginTop,
  });

  useLayoutEffect(() => virtualizer.measure(), [virtualizer, rowHeight, columns]);

  return (
    <div ref={ref} data-testid="catalog-grid">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {width > 0 &&
          virtualizer.getVirtualItems().map((row) => {
            const start = row.index * columns;
            return (
              <div
                key={row.key}
                className="absolute inset-x-0 top-0 grid"
                style={{
                  transform: `translateY(${row.start - marginTop}px)`,
                  height: rowHeight,
                  gap: GAP,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {items.slice(start, start + columns).map((entry) => (
                  <PokemonCard key={entry.id} entry={entry} />
                ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}
