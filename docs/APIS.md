# APIs e dados

## Em tempo de execução

| Recurso | Uso | Custo | Se falhar |
| --- | --- | --- | --- |
| `raw.githubusercontent.com/PokeAPI/sprites` | Artes oficiais grandes da ficha, Shiny e variações | Gratuito | Usa a miniatura local; se não houver, mostra um marcador |
| Web Speech API | Narração | Gratuito, do navegador | Mostra aviso; o restante segue normal |
| `getUserMedia` | Câmera | Gratuito, do navegador | Mostra o motivo e oferece envio de foto |

O restante é servido pelo próprio site: nenhuma outra chamada externa é feita.

## Em tempo de build

| Fonte | Uso | Licença ou observação |
| --- | --- | --- |
| [PokéAPI GraphQL](https://graphql.pokeapi.co/v1beta2) | Dados de todas as espécies e formas | Uso gratuito; a resposta fica em `.cache/` para evitar repetição. O endpoint antigo `beta.pokeapi.co` está defasado: faltam as Megas de Legends Z-A |
| [PokeAPI/sprites](https://github.com/PokeAPI/sprites) | Artes usadas nas miniaturas e no treino | Imagens de propriedade da Nintendo e parceiros |
| `Helsinki-NLP/opus-mt-tc-big-en-pt` | Tradução automática das descrições, rodando localmente | CC-BY 4.0 |

Os dados oficiais têm atualização simples:

```bash
npm run data:update -- --refresh
```

`--refresh` busca tudo de novo na PokéAPI. Textos novos em inglês aparecem em
`data/i18n/strings-en.json` e são traduzidos por `ml/scripts/translate.py`.

## Formato dos dados gerados

**`public/data/index.json`**: uma entrada por Pokémon, com formas, em 200 KB (28 KB comprimido).

```jsonc
{
  "generatedAt": "2026-11-01T22:00:00.000Z",
  "entries": [
    { "id": 6, "sid": 6, "slug": "charizard", "name": "Charizard", "types": ["fire", "flying"],
      "gen": 1, "region": "kanto", "rarity": "raro", "bst": 534, "form": false }
  ]
}
```

**`public/data/species/<id>.json`**: ficha completa. Veja o tipo `SpeciesDetail` em `src/data/types.ts`.

**`public/data/abilities.json`**: nome e efeito de cada habilidade.

**`public/models/pokedex-vision/manifest.json`**: descreve o modelo. O contrato está em `ModelManifest`,
em `src/ai/types.ts`.

## Trocar o reconhecimento por um serviço externo

Hoje não há necessidade: tudo roda no aparelho. Se algum dia for preciso, a interface depende
apenas do contrato `Recognizer` (`src/ai/types.ts`):

1. Crie uma classe que implemente `load()` e `classify()`, chamando seu backend.
2. Troque a instância exportada em `src/ai/index.ts`.
3. Guarde a chave **no backend**. Nunca use `VITE_*` para segredos: tudo com esse prefixo vai
   para o JavaScript público.
