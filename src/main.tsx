import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, useRouteError } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { Layout } from './components/Layout';
import { ErrorState } from './components/States';
import './index.css';
import { CatalogPage } from './pages/CatalogPage';

const DetailPage = lazy(() => import('./pages/DetailPage').then((m) => ({ default: m.DetailPage })));
const ScannerPage = lazy(() => import('./pages/ScannerPage').then((m) => ({ default: m.ScannerPage })));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage').then((m) => ({ default: m.FavoritesPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const page = (element: ReactNode) => (
  <Suspense fallback={<div className="grid min-h-[60dvh] place-items-center text-muted" role="status">Carregando…</div>}>{element}</Suspense>
);

function RouteError() {
  const error = useRouteError() as { status?: number } | undefined;
  return error?.status === 404 ? <NotFound /> : (
    <ErrorState message="Ocorreu um erro inesperado. Recarregue a página." onRetry={() => location.reload()} />
  );
}

function NotFound() {
  return (
    <ErrorState
      title="Página não encontrada"
      message="O endereço aberto não existe nesta Pokédex."
      onRetry={() => location.assign(import.meta.env.BASE_URL)}
    />
  );
}

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      errorElement: <RouteError />,
      children: [
        { path: '/', element: <CatalogPage /> },
        { path: '/pokemon/:id', element: page(<DetailPage />) },
        { path: '/scanner', element: page(<ScannerPage />) },
        { path: '/favoritos', element: page(<FavoritesPage />) },
        { path: '/ajustes', element: page(<SettingsPage />) },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

registerSW({ immediate: true });
