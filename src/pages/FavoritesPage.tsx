import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PokemonCard } from '../components/PokemonCard';
import { EmptyState, ErrorState, GridSkeleton } from '../components/States';
import { loadIndex } from '../data/api';
import { useAsync, useFavorites } from '../hooks/useStores';
import { DexBrand } from './CatalogPage';

export function FavoritesPage() {
  const { data, error, loading, retry } = useAsync(loadIndex, []);
  const { favorites } = useFavorites();

  const entries = useMemo(() => {
    if (!data) return [];
    const wanted = new Set(favorites);
    return data.entries.filter((entry) => !entry.form && wanted.has(entry.sid));
  }, [data, favorites]);

  return (
    <>
      <header className="dex-header safe-top rounded-b-[26px] px-4 [--safe-extra:12px] pb-4 lg:px-8">
        <DexBrand subtitle={`${favorites.length} ${favorites.length === 1 ? 'favorito' : 'favoritos'}`} />
        <h1 className="mt-3 text-2xl font-bold text-white">Favoritos</h1>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-4 lg:px-8">
        {error && <ErrorState message="Não foi possível carregar seus favoritos." onRetry={retry} />}
        {loading && !data && <GridSkeleton />}
        {data && entries.length === 0 && (
          <EmptyState title="Nenhum favorito ainda">
            <p>Toque no coração da ficha de um Pokémon para guardá-lo aqui.</p>
            <Link to="/" className="mt-4 inline-flex min-h-12 items-center rounded-2xl bg-brand px-6 font-semibold text-white">
              Explorar a Pokédex
            </Link>
          </EmptyState>
        )}
        {entries.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {entries.map((entry) => (
              <div key={entry.id} className="h-64">
                <PokemonCard entry={entry} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
