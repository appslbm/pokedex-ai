"""Baixa os demais conjuntos usados no treino e na avaliação.

- JJMack/pokemon-classification-gen1-9 (CC BY-NC-SA 4.0): renders e arte das Gerações 1–9.
- keremberke/pokemon-classification (domínio público, segundo o autor): 150 Pokémon da
  Geração 1 em imagens variadas (arte, jogos, desenhos). Sua divisão "test" fica reservada.
- COCO val2017 (CC BY 4.0): fotos do dia a dia, usadas como exemplos de "não é Pokémon".

Uso:  python ml/scripts/download_extra.py
"""
from __future__ import annotations

import io
import json
import sys
import zipfile
from pathlib import Path

import pyarrow.parquet as pq
import requests
from huggingface_hub import hf_hub_download, list_repo_files
from PIL import Image
from tqdm import tqdm

WORK = Path(__file__).resolve().parents[1] / ".work"
OUT = WORK / "datasets"


def save_image(data: bytes, target: Path, max_side: int = 384) -> None:
    img = Image.open(io.BytesIO(data))
    if img.mode in ("RGBA", "LA", "P"):
        rgba = img.convert("RGBA")
        canvas = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        canvas.alpha_composite(rgba)
        img = canvas
    img = img.convert("RGB")
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    img.save(target, "JPEG", quality=90)


def jjmack() -> None:
    dest = OUT / "jjmack"
    rows = []
    for split, name in (("train", "train"), ("validation", "train"), ("test", "test")):
        path = hf_hub_download("JJMack/pokemon-classification-gen1-9", f"{split}.parquet", repo_type="dataset")
        table = pq.read_table(path, columns=["image_data", "label", "name", "shiny"])
        labels = table.schema.field("label")
        print(split, table.num_rows, labels.type, flush=True)
        records = table.to_pylist()
        for i, rec in enumerate(tqdm(records, desc=split, mininterval=15, file=sys.stdout)):
            image = rec["image_data"]
            data = image["bytes"] if isinstance(image, dict) else image
            species = int(rec["label"])
            target = dest / name / f"{split}_{i:06d}.jpg"
            if not target.exists():
                try:
                    save_image(data, target)
                except Exception as exc:  # imagem corrompida no conjunto de origem
                    print("ignorada", i, exc)
                    continue
            rows.append({"file": str(target.relative_to(dest)).replace("\\", "/"), "label": species,
                         "name": rec["name"], "split": name, "shiny": rec["shiny"]})
    (dest / "manifest.json").write_text(json.dumps(rows), encoding="utf-8")
    print("jjmack:", len(rows))


def keremberke() -> None:
    dest = OUT / "keremberke"
    repo = "keremberke/pokemon-classification"
    files = list_repo_files(repo, repo_type="dataset")
    print([f for f in files if not f.endswith(".gitattributes")][:12])
    rows = []
    for split, zip_name in (("train", "data/train.zip"), ("validation", "data/valid.zip"), ("test", "data/test.zip")):
        path = hf_hub_download(repo, zip_name, repo_type="dataset")
        with zipfile.ZipFile(path) as zf:
            members = [m for m in zf.namelist() if m.lower().endswith((".jpg", ".jpeg", ".png"))]
            print(split, len(members), members[:2], flush=True)
            for i, member in enumerate(tqdm(members, desc=split, mininterval=15, file=sys.stdout)):
                # O conjunto usa o nome do Pokémon como pasta ou como prefixo do arquivo.
                parts = member.split("/")
                label = parts[-2] if len(parts) >= 2 and parts[-2] not in (split, "train", "valid", "test") else parts[-1].split("_")[0]
                target = dest / split / f"{i:05d}.jpg"
                if not target.exists():
                    try:
                        save_image(zf.read(member), target)
                    except Exception:
                        continue
                rows.append({"file": f"{split}/{i:05d}.jpg", "name": label, "split": "test" if split == "test" else "train"})
    (dest / "manifest.json").write_text(json.dumps(rows), encoding="utf-8")
    print("keremberke:", len(rows))


def coco() -> None:
    dest = OUT / "coco"
    archive = OUT / "val2017.zip"
    if not archive.exists():
        with requests.get("http://images.cocodataset.org/zips/val2017.zip", stream=True, timeout=60) as res:
            res.raise_for_status()
            with archive.open("wb") as fh:
                for chunk in res.iter_content(1 << 20):
                    fh.write(chunk)
    with zipfile.ZipFile(archive) as zf:
        members = [m for m in zf.namelist() if m.endswith(".jpg")]
        for i, member in enumerate(tqdm(members, desc="coco", mininterval=15, file=sys.stdout)):
            target = dest / f"{i:05d}.jpg"
            if not target.exists():
                save_image(zf.read(member), target)
    archive.unlink()
    print("coco:", len(members))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    wanted = sys.argv[1:] or ["jjmack", "keremberke", "coco"]
    if "jjmack" in wanted:
        jjmack()
    if "keremberke" in wanted:
        keremberke()
    if "coco" in wanted:
        coco()
