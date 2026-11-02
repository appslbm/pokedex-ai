import { useEffect, useState, type ImgHTMLAttributes } from 'react';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Fontes em ordem de preferência: se uma falhar, tenta a próxima. */
  sources: Array<string | null | undefined>;
  alt: string;
}

export function PokemonImage({ sources, alt, className, ...props }: Props) {
  const list = sources.filter((s): s is string => Boolean(s));
  const key = list.join('|');
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [key]);

  if (index >= list.length) {
    return (
      <span role="img" aria-label={`${alt} (imagem indisponível)`} className={`grid place-items-center text-muted ${className ?? ''}`}>
        <svg viewBox="0 0 48 48" className="h-1/2 w-1/2 opacity-40" aria-hidden="true">
          <circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="24" cy="24" r="6" fill="currentColor" />
        </svg>
      </span>
    );
  }

  return (
    <img
      {...props}
      key={list[index]}
      src={list[index]}
      alt={alt}
      className={className}
      onError={() => setIndex((i) => i + 1)}
      draggable={false}
    />
  );
}
