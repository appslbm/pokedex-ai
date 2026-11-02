import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { narrator } from '../lib/speech';

export const useNarrator = () => useSyncExternalStore(narrator.subscribe, narrator.getState);

const FAVORITES_KEY = 'pokedex:favorites';
const favoriteListeners = new Set<() => void>();

function readFavorites(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

let favoritesSnapshot = readFavorites();

function setFavorites(next: number[]) {
  favoritesSnapshot = next;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {
    /* sem armazenamento disponível: mantém só em memória */
  }
  favoriteListeners.forEach((l) => l());
}

export function useFavorites() {
  const favorites = useSyncExternalStore(
    (listener) => {
      favoriteListeners.add(listener);
      return () => favoriteListeners.delete(listener);
    },
    () => favoritesSnapshot,
  );
  const toggle = useCallback((id: number) => {
    setFavorites(
      favoritesSnapshot.includes(id)
        ? favoritesSnapshot.filter((value) => value !== id)
        : [...favoritesSnapshot, id],
    );
  }, []);
  return { favorites, toggle, isFavorite: (id: number) => favorites.includes(id) };
}

export type ThemeChoice = 'auto' | 'light' | 'dark';
const THEME_KEY = 'pokedex:theme';

function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === 'dark' || (choice === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as ThemeChoice) || 'auto';
    } catch {
      return 'auto';
    }
  });
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'auto') return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('auto');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);
  const setTheme = useCallback((choice: ThemeChoice) => {
    setThemeState(choice);
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch {
      /* ignorado */
    }
  }, []);
  return { theme, setTheme };
}

export function useAsync<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => active && setState({ data, error: null, loading: false }),
      (error: Error) => active && setState({ data: null, error, loading: false }),
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
