# Reconhecimento visual

O reconhecimento é real e roda inteiro no aparelho: a imagem passa por uma rede neural treinada
para este projeto, dentro de um Web Worker, sem servidor, sem chaves e sem enviar a foto a ninguém.

## Como funciona

```
Câmera ou arquivo ─► recorte quadrado central ─► 256×256 px ─► MobileNetV4 ─► 1026 probabilidades
                     (a área do visor)                         (ONNX int8)            │
                                                                                      ▼
                                 Decisão (src/ai/decision.ts) ◄── calibração de temperatura
                                 ├ "não é Pokémon" ≥ 50%          → não reconheci
                                 ├ melhor espécie < 8%            → não reconheci
                                 ├ melhor espécie ≥ 52%           → identificado, com confiança
                                 └ entre esses limites            → não tenho certeza + candidatos
```

No modo ao vivo, os quadros são analisados um por vez e as probabilidades são suavizadas, para o
nome não ficar trocando enquanto a câmera se move.

## Por que treinar um modelo próprio

Foram avaliados modelos públicos antes da decisão:

| Modelo | Cobertura | Tamanho | Problema |
| --- | --- | --- | --- |
| `skshmjn/Pokemon-classifier-gen9-1025` (ViT) | 1025 | 346 MB | Pesado demais para celular e sem classe de rejeição |
| `imzynoxprince/pokemons-image-classifier-gen1-gen9` (ViT) | 1027 | 346 MB | Mesmo problema |
| `BiernyVR/pokemon-classifier-mobilenetv3` (DenseNet) | 151 | 29 MB | Só a Geração 1 |
| **Modelo deste projeto** | **1025 + rejeição** | **10,4 MB** | Treinado com licenças mais limpas e calibrado |

## Resultados

Medidos no **arquivo publicado**, em imagens nunca vistas no treino, com ONNX Runtime na CPU.
Coleções inteiras de cartas ficaram de fora, reimpressões com a mesma arte foram removidas por
hash perceptual, e limites e temperatura foram definidos só na validação.

| Cenário | Imagens | Top-1 | Top-5 | Afirma em | Acerta ao afirmar |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ilustração de carta, limpa | 2.037 | 89,9% | 95,8% | 89,0% | 96,4% |
| Ilustração com simulação de câmera | 2.037 | 86,8% | 94,1% | 87,0% | 95,0% |
| Carta inteira em cena, simulada | 2.037 | 81,2% | 92,1% | 81,3% | 91,1% |
| Imagens variadas da Geração 1 | 965 | 96,2% | 99,7% | 96,6% | 98,6% |
| Variadas com simulação de câmera | 965 | 95,3% | 99,4% | 95,2% | 98,4% |
| Sprites e renders (referência) | 2.530 | 93,2% | 97,2% | 91,5% | 98,7% |

"Afirma em" é a parcela em que o resultado aparece como identificação. Nos demais casos, a
interface diz que não tem certeza e mostra candidatos.

| Imagens sem Pokémon | Imagens | Afirmou um Pokémon por engano |
| --- | ---: | ---: |
| Fotos do dia a dia (COCO) | 600 | 0,5% |
| Fotos com simulação de câmera | 600 | 0,5% |
| Cartas de Treinador (pessoas e objetos) | 299 | 0,7% |

**Calibração:** o erro entre a confiança exibida e o acerto real caiu de 17% para 0,75% na validação.

**Por geração** (ilustração limpa, top-1): I 91%, II 88%, III 90%, IV 92%, V 94%, VI 94%, VII 85%,
VIII 83%, IX 88%. As mais novas têm menos arte disponível.

**No navegador:** com o caminho real (arquivo, Canvas, Worker, WASM), 90,0% de top-1 em uma amostra
de 300 cartas do teste, coerente com a medição em Python, e 97,4% de acerto quando afirma. A análise
levou cerca de 60 ms em um notebook recente; o tempo em celulares ainda precisa ser medido.

### Comparação com o melhor modelo público

Mesmas imagens, mesmas degradações, sem ajuste no modelo público:

| Cenário | Este projeto (10,4 MB) | ViT público (346 MB) |
| --- | ---: | ---: |
| Ilustração limpa | **89,9%** | 85,5% |
| Ilustração com câmera simulada | **86,8%** | 79,0% |
| Carta inteira em cena | **81,2%** | 57,3% |
| Variadas da Geração 1 | **96,2%** | 95,0% |
| Variadas com câmera simulada | **95,3%** | 91,2% |
| Sprites e renders | **93,2%** | 92,8% |

## O que estes números não dizem

Nenhum teste usou fotos reais de um celular apontado para um objeto. A "câmera" é simulada, e cartas
digitalizadas são mais limpas que o mundo real. Espere resultados inferiores com pouca luz, reflexos
fortes e principalmente com brinquedos e figuras 3D, pouco representados no treino. Veja
[LIMITACOES.md](LIMITACOES.md).

## Treino

| Item | Valor |
| --- | --- |
| Arquitetura | MobileNetV4 Conv Medium (`timm`), pesos ImageNet |
| Entrada | 256×256, normalização ImageNet |
| Classes | 1025 espécies + "não é Pokémon" |
| Dados | 35.435 imagens: sprites e artes da PokéAPI, cartas do TCG, imagens variadas da Geração 1, fotos e cartas de Treinador como negativos |
| Balanceamento | Sorteio por classe a cada época: espécies raras não ficam de fora |
| Aumento de dados | Fundos reais, perspectiva, rotação, reflexo, oclusão por dedos, tremor, ruído, moiré, JPEG |
| Treino | 40 épocas, mais 18 de ajuste fino para carta em cena, com AdamW e EMA |
| Exportação | ONNX opset 17 e quantização estática QDQ int8 (de 38,9 MB para 10,4 MB) |

Fontes: [PokeAPI/sprites](https://github.com/PokeAPI/sprites),
[pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data) com imagens de pokemontcg.io,
`keremberke/pokemon-classification` e [COCO 2017](https://cocodataset.org) (CC BY 4.0).
O conjunto `JJMack/pokemon-classification-gen1-9` (CC BY-NC-SA) não entrou no treino.

Passo a passo para reproduzir: [`ml/README.md`](../ml/README.md).

## Disponibilidade e alternativas

Se o modelo não carregar, a interface explica o que houve, permite tentar de novo e mantém a busca
manual. Câmera negada ou inexistente não impede o envio de fotos. Identificação não reconhecida leva
à busca manual. Para usar um backend externo no futuro, veja [APIS.md](APIS.md).
