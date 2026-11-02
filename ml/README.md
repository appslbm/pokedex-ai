# Pipeline do modelo de visão

Reproduz o modelo publicado em `public/models/pokedex-vision/`. Só é necessário para retreinar,
por exemplo quando surgirem novos Pokémon. Quem apenas roda ou publica o site não precisa disto.

Requisitos: GPU NVIDIA com 8 GB ou mais, Python 3.12 e cerca de 15 GB de disco. Tudo que é baixado
ou gerado fica em `ml/.work/`, que não entra no Git. Apagar essa pasta libera o espaço sem afetar o site.

```bash
# 1. Ambiente isolado
python -m venv ml/.work/venv
ml/.work/venv/Scripts/pip install -r ml/requirements.txt \
  --extra-index-url https://download.pytorch.org/whl/cu128

# 2. Dados (rode `npm run data:update` antes, pois os sprites usam a lista gerada por ele)
git clone --depth 1 --sparse https://github.com/PokemonTCG/pokemon-tcg-data.git ml/.work/src/tcg-data
git -C ml/.work/src/tcg-data sparse-checkout set cards/en sets
python ml/scripts/download_tcg.py
python ml/scripts/download_sprites.py
python ml/scripts/download_extra.py
python ml/scripts/prepare_splits.py

# 3. Treino (cerca de 1 hora em uma RTX 5070 Laptop)
python ml/scripts/train.py --name mnv4m_256 --epochs 40
python ml/scripts/train.py --name mnv4m_256_ft --resume mnv4m_256 --scene 0.6 --lr 3e-4 --epochs 18

# 4. Avaliação, calibração e limites de decisão
python ml/scripts/evaluate.py --run mnv4m_256_ft

# 5. Exportação para o navegador
python ml/scripts/export_model.py --run mnv4m_256_ft
python ml/scripts/evaluate.py --run mnv4m_256_ft --published   # mede o arquivo final e define temperatura e limites
```

| Script | Função |
| --- | --- |
| `download_tcg.py` | Cartas do TCG. Coleções inteiras ficam reservadas para teste |
| `download_sprites.py` | Artes e sprites da PokéAPI, por estilo |
| `download_extra.py` | Conjuntos complementares e fotos negativas (COCO) |
| `prepare_splits.py` | Divide treino, validação e teste, removendo vazamentos |
| `augment.py` | Simula câmera: fundo, perspectiva, reflexo, tremor, dedos, compressão |
| `train.py` | Transfer learning com amostragem balanceada por classe |
| `evaluate.py` | Mede, calibra a confiança e escolhe os limites |
| `export_model.py` | Gera ONNX, quantiza e confere se a acurácia se manteve |
| `translate.py` | Traduz as descrições localmente (independente do modelo de visão) |
