import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Garante barras no início e no fim: "pokedex-ai" vira "/pokedex-ai/". */
function normalizeBase(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

/**
 * O GitHub Pages não sabe nada sobre as rotas do React: ao recarregar
 * /pokedex-ai/pokemon/25 ele procura esse arquivo, não acha e serve o 404.html.
 * Servir o próprio app nesse caso faz qualquer rota funcionar ao recarregar.
 */
function githubPagesFallback(): Plugin {
  return {
    name: 'github-pages-fallback',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist');
      if (existsSync(path.join(dist, 'index.html'))) {
        copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBase(env.VITE_BASE_PATH ?? (command === 'build' ? '/pokedex-ai/' : '/'));
  // A câmera exige HTTPS fora de localhost. Use DEV_HTTPS=1 para testar pelo celular na rede local.
  const https = env.DEV_HTTPS === '1';

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      githubPagesFallback(),
      ...(https ? [basicSsl()] : []),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['icons/*.png', 'icons/*.svg'],
        manifest: {
          id: base,
          name: 'Pokédex AI',
          short_name: 'Pokédex AI',
          description: 'Enciclopédia Pokémon com narração e identificação visual no próprio aparelho.',
          lang: 'pt-BR',
          dir: 'ltr',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0e1220',
          theme_color: '#c8102e',
          categories: ['education', 'entertainment', 'games'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'Abrir scanner', short_name: 'Scanner', url: `${base}scanner`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          // Sem isto, o app só funciona offline a partir da segunda visita.
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: `${base}index.html`,
          // Pré-carrega só o aplicativo. Fichas, imagens, modelo e motor entram no cache sob demanda.
          globPatterns: ['**/*.{js,css,html,woff2}', 'icons/*', 'data/index.json', 'data/abilities.json'],
          globIgnores: ['models/**', '404.html'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.includes('/data/species/'),
              handler: 'StaleWhileRevalidate',
              options: { cacheName: 'species-data', expiration: { maxEntries: 1100 } },
            },
            {
              urlPattern: ({ url }) => url.pathname.includes('/img/thumb/'),
              handler: 'CacheFirst',
              options: { cacheName: 'thumbnails', expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 90 } },
            },
            {
              // O motor de inferência tem vários MB: só entra no cache de quem usa o scanner.
              urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
              handler: 'CacheFirst',
              options: { cacheName: 'inference-runtime', expiration: { maxEntries: 4 } },
            },
            {
              urlPattern: ({ url }) => url.hostname === 'raw.githubusercontent.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'pokemon-art',
                expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60, purgeOnQuotaError: true },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    worker: { format: 'es' },
    build: { target: 'es2022', chunkSizeWarningLimit: 900 },
    server: { host: true },
    optimizeDeps: { exclude: ['onnxruntime-web'] },
  };
});
