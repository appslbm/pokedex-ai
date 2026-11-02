# Arquitetura

A Pokédex AI é um site estático. Não há servidor próprio, banco de dados nem chaves de API:
tudo que a aplicação precisa fica em arquivos publicados no GitHub Pages ou é calculado no
aparelho de quem usa.

```
  Build (uma vez, na máquina do desenvolvedor)          Navegador do usuário
 ┌───────────────────────────────────────────┐        ┌──────────────────────────────────┐
 │ PokéAPI GraphQL ──► scripts/build-data    │        │ React + rotas                    │
 │                      ├ data/index.json    │ deploy │  ├ busca e filtros (em memória)  │
 │                      ├ data/species/*.json│ ─────► │  ├ fichas (JSON sob demanda)     │
 │                      └ img/thumb/*.webp   │        │  ├ narração (Web Speech API)     │
 │                                           │        │  └ scanner ─► Web Worker         │
 │ Datasets ──► ml/ ──► models/.../model.onnx│        │               └ ONNX Runtime     │
 └───────────────────────────────────────────┘        └──────────────────────────────────┘
                                                        Service worker: shell e cache offline
                                                        Imagens grandes: raw.githubusercontent
```

## Decisões principais

| Decisão | Motivo |
| --- | --- |
| Dados pré-gerados em vez de chamar a PokéAPI em tempo real | A API é gratuita e mantida por voluntários. Pré-gerar elimina dependência em tempo de execução, deixa a busca instantânea e funciona offline. |
| Reconhecimento no navegador | Compatível com hospedagem estática, sem custo por uso, sem chaves e sem enviar fotos a terceiros. |
| Modelo próprio de 1026 classes | Os modelos públicos ou cobrem só a Geração 1 ou pesam 346 MB, sem classe de rejeição. Ver [RECONHECIMENTO.md](RECONHECIMENTO.md). |
| Miniaturas WebP locais | Uma grade com 1025 PNGs oficiais pesaria dezenas de MB. Cada miniatura tem cerca de 8 KB. |
| Lista virtualizada | Mantém poucas dezenas de cartões no DOM, mesmo com 1351 registros. |
| Filtros na URL | Voltar da ficha preserva a busca, e o link pode ser compartilhado. |
| `BrowserRouter` + `404.html` | URLs limpas. O GitHub Pages serve o `404.html`, que é o próprio app, em rotas profundas. |

## Estrutura

```
src/
  ai/            Camada de IA, isolada da interface
    types.ts       Contrato (Recognizer): é só isto que a interface conhece
    index.ts       Ponto único de escolha do reconhecedor
    onDeviceRecognizer.ts, worker.ts   Inferência local em Web Worker
    decision.ts    Regra que separa "identificou" de "chutou"
    preprocess.ts  Recorte e conversão da imagem para o modelo
  components/    Componentes visuais reutilizáveis
  data/          Tipos e carregamento dos JSON
  hooks/         Câmera, favoritos, tema, narração
  lib/           Lógica pura e testável: busca, raridade, tipos, narração, voz
  pages/         Catálogo, ficha, scanner, favoritos, ajustes
scripts/         Geração de dados, ícones e servidor que imita o GitHub Pages
data/i18n/       Traduções versionadas (a PokéAPI não tem textos em pt-BR)
ml/scripts/      Pipeline de treino, avaliação e exportação
tests/           Vitest (unit) e Playwright (e2e)
```

## Três conceitos que não se misturam

- **Raridade** (`src/lib/rarity.ts`): categoria própria do projeto. Mítico e Lendário vêm do dado
  oficial; os demais níveis saem de uma pontuação com taxa de captura (55%), força base (30%) e
  tempo de eclosão (15%).
- **Classificação oficial**: Lendário, Mítico, Bebê, Ultra Besta e Paradoxo, como nos jogos.
- **Shiny**: variação de cor. Não altera raridade nem classificação, e há teste garantindo isso.

## GitHub Pages

- `VITE_BASE_PATH` define o subcaminho. O workflow usa o nome real do repositório.
- O plugin `github-pages-fallback` (em `vite.config.ts`) copia `index.html` para `404.html`.
- O Pages não permite definir cabeçalhos HTTP. Sem COOP/COEP, não há WASM com várias threads;
  a inferência usa uma thread, com SIMD. Ver [LIMITACOES.md](LIMITACOES.md).
- `scripts/serve-pages.mjs` reproduz esse comportamento localmente, e é sobre ele que os testes
  end-to-end rodam.

## Service worker (PWA)

| Conteúdo | Estratégia |
| --- | --- |
| Aplicativo, índice e habilidades | Pré-carregados na instalação |
| Fichas | Stale-while-revalidate |
| Miniaturas e artes oficiais | Cache-first, com limite de entradas |
| Motor WASM | Cache-first, só para quem usa o scanner |
| Modelo | Cache próprio do worker, com versão na URL |
| Navegação offline | Cai no `index.html` |
