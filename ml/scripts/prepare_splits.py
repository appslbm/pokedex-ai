"""Monta as divisões de treino, validação e teste, evitando vazamento de dados.

Cuidados que tornam a avaliação honesta:
- Coleções inteiras de cartas ficam fora do treino (validação e teste não se misturam).
- Reimpressões com a MESMA arte são removidas da validação e do teste (hash perceptual).
- No keremberke, o mesmo arquivo de origem aparece em divisões diferentes com sufixos
  distintos. A divisão original vaza, então separamos de novo pelo hash de origem.
- JJMack (CC BY-NC-SA) não entra no treino: é redundante com os sprites da PokéAPI
  e evita herdar uma licença restritiva num projeto público.

Uso:  python ml/scripts/prepare_splits.py
"""
from __future__ import annotations

import csv
import json
import random
import sys
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from huggingface_hub import hf_hub_download
from PIL import Image

WORK = Path(__file__).resolve().parents[1] / ".work"
DATA = WORK / "datasets"
OUT = WORK / "manifests"
SEED = 1234

# Reservadas para calibrar confiança e limites. Nunca usadas no treino nem no teste.
VAL_SETS = {"base3", "neo2", "ex5", "dp3", "pl3", "hgss2", "bw3", "xy5", "sm5", "swsh4", "sv4", "sv7"}


def art_hash(path: Path) -> int:
    """dHash de 64 bits da região da arte, ignorando moldura, texto e número da carta."""
    with Image.open(path) as image:
        width, height = image.size
        art = image.convert("L").crop((int(width * .1), int(height * .12), int(width * .9), int(height * .46)))
        pixels = np.asarray(art.resize((9, 8), Image.BILINEAR), dtype=np.int16)
    bits = (pixels[:, 1:] > pixels[:, :-1]).flatten()
    return int(np.packbits(bits).tobytes().hex(), 16)


def hamming_min(value: int, others: np.ndarray) -> int:
    return int(np.unpackbits(np.frombuffer(np.bitwise_xor(others, np.uint64(value)).astype(">u8").tobytes(), dtype=np.uint8)).reshape(-1, 64).sum(1).min())


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    random.seed(SEED)
    OUT.mkdir(parents=True, exist_ok=True)
    train: list[dict] = []

    # Sprites: arte e renders usados apenas no treino.
    for item in json.loads((DATA / "sprites" / "manifest.json").read_text(encoding="utf-8")):
        train.append({"path": f"sprites/{item['file']}", "label": item["label"], "kind": "sprite", "style": item["style"]})

    # Cartas do TCG.
    cards = list(csv.DictReader((DATA / "tcg" / "manifest.csv").open(encoding="utf-8")))
    for card in cards:
        card["path"] = f"tcg/images/{card['set']}/{card['id']}.jpg"
        card["label"] = int(card["label"])
        card["group"] = "val" if card["set"] in VAL_SETS else ("test" if card["split"] == "test" else "train")

    print("calculando hashes das cartas…", flush=True)
    with ThreadPoolExecutor(16) as pool:
        hashes = list(pool.map(lambda c: art_hash(DATA / c["path"]), cards))
    train_hashes = np.array([h for h, c in zip(hashes, cards) if c["group"] == "train"], dtype=np.uint64)

    val: list[dict] = []
    test_cards: list[dict] = []
    removed = 0
    for card, value in zip(cards, hashes):
        entry = {"path": card["path"], "label": card["label"], "kind": "card" if card["label"] else "negcard", "set": card["set"]}
        if card["group"] == "train":
            train.append(entry)
        elif hamming_min(value, train_hashes) <= 8:
            removed += 1  # reimpressão: arte já vista no treino
        elif card["group"] == "val":
            val.append(entry)
        else:
            test_cards.append(entry)
    print(f"reimpressões removidas da validação/teste: {removed}", flush=True)

    # keremberke: reconstrói o nome original para agrupar pelo hash de origem.
    species_by_name = {}
    raw = json.loads((WORK.parents[1] / ".cache" / "pokeapi-raw.json").read_text(encoding="utf-8"))
    for species in raw["species"]:
        name = species["names"][0]["name"]
        species_by_name[name.lower()] = species["id"]
    aliases = {"mrmime": 122, "mr. mime": 122, "mr mime": 122, "farfetchd": 83, "farfetch'd": 83, "nidoran-m": 32, "nidoran-f": 29,
               "nidoran♂": 32, "nidoran♀": 29, "drowzee": 96, "alolan sandslash": 28}
    groups: dict[str, list[dict]] = defaultdict(list)
    for split, zip_name in (("train", "data/train.zip"), ("validation", "data/valid.zip"), ("test", "data/test.zip")):
        path = hf_hub_download("keremberke/pokemon-classification", zip_name, repo_type="dataset")
        with zipfile.ZipFile(path) as archive:
            members = [m for m in archive.namelist() if m.lower().endswith((".jpg", ".jpeg", ".png"))]
        for index, member in enumerate(members):
            folder, filename = member.split("/")[-2:]
            label = species_by_name.get(folder.lower()) or aliases.get(folder.lower())
            if label is None:
                print("sem correspondência:", folder)
                continue
            groups[filename.split("_jpg")[0].split("_png")[0].split(".rf.")[0]].append(
                {"path": f"keremberke/{split}/{index:05d}.jpg", "label": label, "kind": "photo"})
    keys = sorted(groups)
    random.shuffle(keys)
    held = len(keys) // 7
    photo_test = [item for key in keys[:held] for item in groups[key][:1]]
    photo_val = [item for key in keys[held:held * 2] for item in groups[key][:1]]
    train += [item for key in keys[held * 2:] for item in groups[key]]
    print(f"keremberke: {len(keys)} originais; teste {len(photo_test)}, validação {len(photo_val)}", flush=True)

    # Negativos: fotos do dia a dia.
    coco = sorted(p.name for p in (DATA / "coco").glob("*.jpg"))
    random.shuffle(coco)
    negative = lambda name: {"path": f"coco/{name}", "label": 0, "kind": "neg"}  # noqa: E731
    val += [negative(n) for n in coco[:400]]
    test_negative = [negative(n) for n in coco[400:1000]]
    train += [negative(n) for n in coco[1000:]]
    val += photo_val

    # JJMack só como referência: mesmo sprites, não entra no treino.
    jj = json.loads((DATA / "jjmack" / "manifest.json").read_text(encoding="utf-8"))
    test_jj = [{"path": f"jjmack/{r['file']}", "label": r["label"], "kind": "sprite-ref"} for r in jj if r["split"] == "test"]

    outputs = {
        "train": train, "val": val, "test_cards": test_cards, "test_photos": photo_test,
        "test_negative": test_negative, "test_jjmack": test_jj,
    }
    for name, rows in outputs.items():
        (OUT / f"{name}.json").write_text(json.dumps(rows), encoding="utf-8")
        labels = {r["label"] for r in rows if r["label"]}
        print(f"{name:14} {len(rows):6d} imagens, {len(labels):4d} espécies", flush=True)


if __name__ == "__main__":
    main()
