import { useEffect, useState, type ReactNode } from 'react';
import { RarityBadge } from '../components/Badges';
import { CheckIcon } from '../components/Icons';
import { useNarrator, useTheme, type ThemeChoice } from '../hooks/useStores';
import { RARITIES, RARITY_THRESHOLDS } from '../lib/rarity';
import { narrator } from '../lib/speech';
import { DexBrand } from './CatalogPage';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

const RARITY_RULES: Record<(typeof RARITIES)[number], string> = {
  normal: `Pontuação abaixo de ${RARITY_THRESHOLDS.incomum.toString().replace('.', ',')}`,
  incomum: `Pontuação a partir de ${RARITY_THRESHOLDS.incomum.toString().replace('.', ',')}`,
  raro: `Pontuação a partir de ${RARITY_THRESHOLDS.raro.toString().replace('.', ',')}`,
  epico: `Pontuação a partir de ${RARITY_THRESHOLDS.epico.toString().replace('.', ',')}`,
  lendario: 'Espécies oficialmente lendárias',
  mitico: 'Espécies oficialmente míticas',
};

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  useNarrator();
  const voices = narrator.getVoices('pt');
  const [rate, setRate] = useState(narrator.rate);
  const [voice, setVoice] = useState(narrator.preferredVoice ?? '');
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);

  return (
    <>
      <header className="dex-header safe-top rounded-b-[26px] px-4 [--safe-extra:12px] pb-4 lg:px-8">
        <DexBrand />
        <h1 className="mt-3 text-2xl font-bold text-white">Ajustes</h1>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        <Block title="Aparência">
          <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
            {THEMES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={theme === option.value}
                onClick={() => setTheme(option.value)}
                data-testid={`theme-${option.value}`}
                className={`min-h-11 rounded-xl text-sm font-semibold ${theme === option.value ? 'bg-surface shadow-sm' : 'text-muted'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Block>

        <Block title="Narração">
          {voices.length > 0 ? (
            <label className="block">
              <span className="text-sm text-muted">Voz em português</span>
              <select
                value={voice}
                onChange={(event) => {
                  setVoice(event.target.value);
                  narrator.setPreferredVoice(event.target.value);
                }}
                className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-3"
              >
                <option value="">Escolher automaticamente</option>
                {voices.map((item) => (
                  <option key={item.voiceURI} value={item.voiceURI}>{item.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-muted">Nenhuma voz em português foi encontrada neste aparelho. Instale uma nas configurações de voz do sistema.</p>
          )}
          <label className="mt-3 block">
            <span className="text-sm text-muted">Velocidade: {rate.toString().replace('.', ',')}×</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.1}
              value={rate}
              onChange={(event) => {
                const value = Number(event.target.value);
                setRate(value);
                narrator.setRate(value);
              }}
              className="mt-1 h-11 w-full accent-brand"
            />
          </label>
          <button
            type="button"
            onClick={() => narrator.speak({ text: 'Olá! Esta é a voz da sua Pokédex.', label: 'Teste' })}
            className="mt-1 min-h-11 rounded-xl bg-surface-2 px-4 text-sm font-semibold"
          >
            Testar voz
          </button>
        </Block>

        {install && (
          <Block title="Instalar aplicativo">
            <p className="mb-3 text-sm text-muted">Adicione a Pokédex AI à tela inicial para abrir como um app.</p>
            <button
              type="button"
              onClick={async () => {
                await install.prompt();
                setInstall(null);
              }}
              className="min-h-12 rounded-2xl bg-brand px-5 font-semibold text-white"
            >
              Instalar
            </button>
          </Block>
        )}

        <Block title="Como funciona a raridade">
          <p className="text-sm text-muted">
            A raridade é uma categoria criada pela Pokédex AI e não existe nos jogos. A pontuação combina taxa de captura (55%),
            força base (30%) e tempo de eclosão (15%). Ela é independente da classificação oficial e da forma Shiny, que é só uma variação de cor.
          </p>
          <ul className="mt-3 space-y-2">
            {RARITIES.map((rarity) => (
              <li key={rarity} className="flex items-center justify-between gap-3">
                <RarityBadge rarity={rarity} />
                <span className="text-right text-[13px] text-muted">{RARITY_RULES[rarity]}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Privacidade">
          <ul className="space-y-2 text-sm text-muted">
            {[
              'As fotos são analisadas no seu aparelho e nunca são enviadas a um servidor.',
              'Favoritos e preferências ficam guardados apenas neste navegador.',
              'Não há cadastro, anúncios nem rastreamento.',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <CheckIcon size={18} className="shrink-0 text-brand dark:text-brand-glow" />
                {item}
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Sobre">
          <p className="text-sm text-muted">
            Projeto de fã, sem fins lucrativos e sem vínculo com a Nintendo, Creatures Inc., GAME FREAK ou The Pokémon Company.
            Pokémon e seus personagens são marcas de seus respectivos donos. Dados e imagens:{' '}
            <a href="https://pokeapi.co" target="_blank" rel="noreferrer" className="underline">PokéAPI</a>.
            As descrições são traduções automáticas.
          </p>
        </Block>
      </div>
    </>
  );
}
