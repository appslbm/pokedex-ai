import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useStores';
import { CameraIcon, GridIcon, HeartIcon, SettingsIcon } from './Icons';

const LINKS = [
  { to: '/', label: 'Pokédex', icon: GridIcon, end: true },
  { to: '/scanner', label: 'Scanner', icon: CameraIcon, primary: true },
  { to: '/favoritos', label: 'Favoritos', icon: HeartIcon },
  { to: '/ajustes', label: 'Ajustes', icon: SettingsIcon },
];

export function Layout() {
  useTheme();
  const { pathname } = useLocation();
  const immersive = pathname.startsWith('/scanner');

  return (
    <div className="lg:pl-24">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2"
      >
        Pular para o conteúdo
      </a>

      <main id="conteudo" className={immersive ? '' : 'pb-[calc(var(--nav-height)+env(safe-area-inset-bottom)+16px)] lg:pb-8'}>
        <Outlet />
      </main>

      <nav
        aria-label="Navegação principal"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl lg:inset-x-auto lg:top-0 lg:left-0 lg:w-24 lg:border-t-0 lg:border-r"
      >
        <ul className="mx-auto flex h-[var(--nav-height)] max-w-md items-stretch lg:h-full lg:max-w-none lg:flex-col lg:justify-center lg:gap-4">
          {LINKS.map(({ to, label, icon: Icon, end, primary }) => (
            <li key={to} className="flex-1 lg:flex-none">
              <NavLink
                to={to}
                end={end}
                viewTransition
                className={({ isActive }) =>
                  `flex h-full flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${
                    isActive ? 'text-brand dark:text-brand-glow' : 'text-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`grid place-items-center transition-transform duration-200 ease-spring ${
                        primary ? 'size-9 rounded-2xl bg-brand text-white' : 'size-7'
                      } ${isActive ? 'scale-110' : ''}`}
                    >
                      <Icon size={primary ? 21 : 23} filled={isActive || undefined} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <ScrollRestoration getKey={(location) => (location.pathname === '/' ? location.pathname + location.search : location.key)} />
    </div>
  );
}
