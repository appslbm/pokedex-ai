# Pokédex AI

Enciclopédia Pokémon moderna, feita primeiro para o celular, com busca instantânea, fichas completas,
narração por voz e identificação visual por inteligência artificial que roda **no próprio aparelho**.

É um site totalmente estático: sem servidor, sem chaves de API e sem custo por uso.

## Funcionalidades

- **1351 registros:** as 1025 espécies e todas as formas alternativas da PokéAPI, incluindo Megas de Legends Z-A.
- **Busca e filtros:** por nome, número ou tipo; filtros de tipo, região, geração e raridade; quatro ordenações.
- **Fichas completas:** artes oficiais, Shiny, tipos, região, geração, altura, peso, habilidades, estatísticas, fraquezas, cadeia evolutiva e formas.
- **Raridade própria:** Normal, Incomum, Raro, Épico, Lendário e Mítico, sem se confundir com a classificação oficial ou com Shiny.
- **Narração:** fala nome, características e descrição, com repetir e parar.
- **Scanner:** câmera, foto capturada, envio de imagem e modo ao vivo, com nível de confiança e recusa honesta.
- **PWA:** instalável e funcional sem internet. Favoritos locais, tema claro e escuro.

## Reconhecimento visual

Modelo próprio de 10,4 MB com 1025 espécies e uma classe "não é Pokémon". Quando afirma um Pokémon,
acerta de 91% a 99% das vezes nos cenários testados, e só 0,5% das fotos sem Pokémon viram um falso
resultado. **A câmera foi simulada nesses testes: ainda falta validar com fotos reais de celular.**
Detalhes em [docs/RECONHECIMENTO.md](docs/RECONHECIMENTO.md).

## Como executar

Requisitos: Node.js 24 ou mais recente.

```bash
npm ci
npm run dev        # http://localhost:5173
```

### Pelo celular, na mesma rede Wi-Fi

A câmera só funciona em HTTPS, por isso use o modo seguro:

```bash
# PowerShell
$env:DEV_HTTPS="1"; npm run dev

# Bash
DEV_HTTPS=1 npm run dev
```

Abra no celular o endereço `https://<IP-do-computador>:5173` mostrado no terminal e aceite o aviso de
certificado. Se a página não abrir, libere a porta 5173 no firewall do Windows. O envio de foto funciona
mesmo sem HTTPS.

## Comandos

| Comando | Função |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de produção em `dist/` |
| `npm run preview` | Serve o build com o preview do Vite |
| `npm run typecheck` | Só a checagem de tipos |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes end-to-end (Playwright); rode o build antes |
| `npm run data:update` | Regenera dados e miniaturas; `-- --refresh` força buscar tudo de novo |
| `node scripts/serve-pages.mjs` | Serve `dist/` imitando o GitHub Pages |

Na primeira vez, instale o navegador de teste com `npx playwright install chromium`.

## Publicação no GitHub Pages

1. Crie um repositório e envie o código para a branch `main`.
2. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
3. A cada push na `main`, `.github/workflows/deploy.yml` roda testes, gera o build e publica.

O caminho base é definido sozinho pelo nome do repositório, e rotas profundas funcionam ao recarregar
por meio do `404.html`. Variáveis opcionais estão em [.env.example](.env.example). Nenhuma é secreta.

## Documentação

- [Arquitetura](docs/ARQUITETURA.md)
- [APIs e dados](docs/APIS.md)
- [Reconhecimento visual](docs/RECONHECIMENTO.md)
- [Limitações conhecidas](docs/LIMITACOES.md)
- [Pipeline do modelo](ml/README.md)

## Tecnologias

React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Virtual, ONNX Runtime Web, Workbox
(vite-plugin-pwa), Vitest, Playwright e axe. Modelo treinado com PyTorch e timm.

## Aviso legal

Projeto de fã, sem fins lucrativos e sem vínculo com Nintendo, Creatures Inc., GAME FREAK ou The Pokémon
Company. Pokémon e seus personagens são marcas de seus respectivos donos. Dados e imagens vêm da
[PokéAPI](https://pokeapi.co). Veja os riscos de publicação em [docs/LIMITACOES.md](docs/LIMITACOES.md).
