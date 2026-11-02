"""Baixa as imagens das cartas do TCG (metadados do repositório público pokemon-tcg-data).

- Cartas de Pokémon com UM único número nacional viram exemplos daquela espécie.
- Cartas de Treinador/Energia viram exemplos negativos ("não é Pokémon").
- Coleções inteiras ficam reservadas para teste (ver HOLDOUT_SETS): assim o teste mede
  arte que o modelo nunca viu, e não apenas imagens parecidas com as de treino.

As imagens são redimensionadas para 512 px de largura para economizar disco.

Uso:  python ml/scripts/download_tcg.py
"""
from __future__ import annotations

import csv
import io
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from PIL import Image
from tqdm import tqdm

WORK = Path(__file__).resolve().parents[1] / ".work"
SRC = WORK / "src" / "tcg-data" / "cards" / "en"
OUT = WORK / "datasets" / "tcg"
MANIFEST = OUT / "manifest.csv"

# Coleções reservadas para teste, espalhadas por todas as épocas do TCG.
HOLDOUT_SETS = {
    "base2", "neo3", "ecard2", "ex7", "ex14", "dp4", "pl2", "hgss3",
    "bw5", "xy3", "xy9", "sm3", "sm8", "swsh2", "swsh8", "sv3", "sv6",
}

session = requests.Session()
session.headers["User-Agent"] = "pokedex-ai-dataset/1.0"


def fetch(card: dict) -> dict | None:
    target = OUT / "images" / card["set"] / f"{card['id']}.jpg"
    if target.exists():
        return card
    target.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            res = session.get(card["url"], timeout=40)
            if res.status_code == 404:
                return None
            res.raise_for_status()
            img = Image.open(io.BytesIO(res.content)).convert("RGB")
            if img.width > 512:
                img = img.resize((512, round(img.height * 512 / img.width)), Image.LANCZOS)
            img.save(target, "JPEG", quality=88)
            return card
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return None


def main() -> None:
    cards: list[dict] = []
    for path in sorted(SRC.glob("*.json")):
        set_id = path.stem
        for card in json.loads(path.read_text(encoding="utf-8")):
            images = card.get("images") or {}
            url = images.get("large") or images.get("small")
            if not url:
                continue
            numbers = card.get("nationalPokedexNumbers") or []
            if card.get("supertype") == "Pokémon":
                # Cartas com mais de um Pokémon (TAG TEAM etc.) têm rótulo ambíguo.
                if len(numbers) != 1 or not 1 <= numbers[0] <= 1025:
                    continue
                label = numbers[0]
            else:
                label = 0
            cards.append({
                "id": card["id"], "set": set_id, "url": url, "label": label,
                "split": "test" if set_id in HOLDOUT_SETS else "train",
                "supertype": card.get("supertype", ""),
            })

    print(f"{len(cards)} cartas; {sum(c['label'] > 0 for c in cards)} de Pokémon; "
          f"{len({c['label'] for c in cards}) - 1} espécies; "
          f"{sum(c['split'] == 'test' for c in cards)} em coleções de teste")

    OUT.mkdir(parents=True, exist_ok=True)
    done: list[dict] = []
    # Concorrência moderada: é um CDN público e gratuito.
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = [pool.submit(fetch, c) for c in cards]
        for fut in tqdm(as_completed(futures), total=len(futures), mininterval=20, file=sys.stdout):
            result = fut.result()
            if result:
                done.append(result)

    with MANIFEST.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["id", "set", "label", "split", "supertype"])
        writer.writeheader()
        for c in sorted(done, key=lambda c: c["id"]):
            writer.writerow({k: c[k] for k in writer.fieldnames})
    print(f"Concluído: {len(done)}/{len(cards)} em {OUT}")


if __name__ == "__main__":
    main()
