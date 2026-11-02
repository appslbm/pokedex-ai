"""Baixa as artes e sprites listadas pela PokéAPI, separadas por estilo.

Usa as URLs já coletadas em .cache/pokeapi-raw.json (rode antes `npm run data:update`).
Formas alternativas herdam o número da espécie, e versões Shiny também: para o modelo,
uma forma Shiny continua sendo o mesmo Pokémon.

Uso:  python ml/scripts/download_sprites.py
"""
from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / ".cache" / "pokeapi-raw.json"
OUT = ROOT / "ml" / ".work" / "datasets" / "sprites"

session = requests.Session()
session.headers["User-Agent"] = "pokedex-ai-dataset/1.0"


def sources(sprites: dict) -> dict[str, str | None]:
    other = sprites.get("other") or {}
    art = other.get("official-artwork") or {}
    home = other.get("home") or {}
    versions = sprites.get("versions") or {}
    version = lambda gen, game: (versions.get(gen) or {}).get(game) or {}  # noqa: E731
    return {
        "art": art.get("front_default"),
        "art-shiny": art.get("front_shiny"),
        "home": home.get("front_default"),
        "home-shiny": home.get("front_shiny"),
        "home-female": home.get("front_female"),
        "pixel": sprites.get("front_default"),
        "pixel-shiny": sprites.get("front_shiny"),
        "gen5": version("generation-v", "black-white").get("front_default"),
        "gen6": version("generation-vi", "x-y").get("front_default"),
        "gen7": version("generation-vii", "ultra-sun-ultra-moon").get("front_default"),
    }


def fetch(item: dict) -> dict | None:
    target = OUT / item["file"]
    if target.exists():
        return item
    target.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            res = session.get(item["url"], timeout=40)
            if res.status_code == 404:
                return None
            res.raise_for_status()
            target.write_bytes(res.content)
            return item
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return None


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    items = []
    for species in raw["species"]:
        for pokemon in species["pokemon"]:
            sprites = pokemon["sprites"][0]["sprites"] if pokemon["sprites"] else {}
            if isinstance(sprites, str):
                sprites = json.loads(sprites)
            for style, url in sources(sprites or {}).items():
                if url and url.endswith(".png"):
                    items.append({"file": f"{style}/{pokemon['id']}.png", "url": url, "label": species["id"],
                                  "style": style, "pokemon": pokemon["id"]})
    print(len(items), "imagens listadas", flush=True)

    done = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(fetch, item) for item in items]
        for future in tqdm(as_completed(futures), total=len(futures), mininterval=20, file=sys.stdout):
            if result := future.result():
                done.append(result)
    (OUT / "manifest.json").write_text(json.dumps(done), encoding="utf-8")
    print("Concluído:", len(done), "em", OUT)


if __name__ == "__main__":
    main()
