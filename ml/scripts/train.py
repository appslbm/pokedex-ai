"""Treina o classificador de 1025 espécies + 1 classe "não é Pokémon".

Parte de pesos ImageNet (transfer learning) e sorteia as amostras por classe, pois há
espécies com centenas de cartas e outras com poucas.

Uso:  python ml/scripts/train.py --model mobilenetv4_conv_medium.e500_r256_in1k --epochs 40
"""
from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import timm
import torch
from timm.utils import ModelEmaV3
from torch import nn
from torch.utils.data import DataLoader, Dataset

sys.path.insert(0, str(Path(__file__).parent))
import augment as A  # noqa: E402

WORK = Path(__file__).resolve().parents[1] / ".work"
DATA = WORK / "datasets"
MANIFESTS = WORK / "manifests"
MEAN = torch.tensor([0.485, 0.456, 0.406])[None, :, None, None]
STD = torch.tensor([0.229, 0.224, 0.225])[None, :, None, None]
NUM_CLASSES = 1026  # 0 = não é Pokémon; 1..1025 = número nacional


class TrainSet(Dataset):
    def __init__(self, rows: list[dict], size: int, per_class: int, negatives: int, scene: float = 0.3):
        self.size = size
        self.scene = scene  # fração das cartas mostradas inteiras em uma cena
        self.per_class = per_class
        self.negatives = negatives
        self.by_label: dict[int, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
        for row in rows:
            self.by_label[row["label"]][row["kind"]].append(row)
        self.photos = [Path(row["path"]) for row in rows if row["kind"] == "neg"]
        self.by_label = {k: dict(v) for k, v in self.by_label.items()}
        self.labels = sorted(k for k in self.by_label if k)

    def __len__(self) -> int:
        return len(self.labels) * self.per_class + self.negatives

    def pick(self, label: int) -> dict:
        kinds = self.by_label[label]
        if label == 0:
            kind = "negcard" if random.random() < 0.4 else "neg"
            return random.choice(kinds[kind])
        weights = {"card": 0.48, "sprite": 0.34, "photo": 0.18}
        available = [k for k in weights if k in kinds]
        return random.choice(kinds[random.choices(available, [weights[k] for k in available])[0]])

    def render(self, row: dict) -> np.ndarray:
        path = DATA / row["path"]
        size = self.size
        match row["kind"]:
            case "sprite":
                image = A.render_sprite(path, size, self.photos, DATA)
            case "card":
                card = A.read_rgb(path)
                image = A.card_in_scene(card, size, self.photos, DATA) if random.random() < self.scene else A.card_art(card, size)
            case "negcard":
                card = A.read_rgb(path)
                image = A.card_art(card, size) if random.random() < 0.6 else A.card_in_scene(card, size, self.photos, DATA)
            case "neg":
                image = A.random_crop(A.read_rgb(path), size, (0.25, 1.0))
            case _:
                image = A.random_crop(A.read_rgb(path), size, (0.7, 1.0))
        return A.camera(image)

    def __getitem__(self, index: int):
        label = 0 if index >= len(self.labels) * self.per_class else self.labels[index // self.per_class]
        for _ in range(5):
            try:
                image = self.render(self.pick(label))
                return torch.from_numpy(image.copy()).permute(2, 0, 1), label
            except (OSError, ValueError):
                continue
        return torch.zeros(3, self.size, self.size, dtype=torch.uint8), label


class EvalSet(Dataset):
    def __init__(self, rows: list[dict], size: int):
        self.rows = rows
        self.size = size

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        image = A.read_rgb(DATA / row["path"])
        if row["kind"] in ("card", "negcard"):
            height, width = image.shape[:2]
            # Só a ilustração: fora a faixa "NO. 0284 ...", que entregaria a resposta por texto.
            image = image[int(height * .13):int(height * .46), int(width * .09):int(width * .91)]
        return torch.from_numpy(A.center_square(image, self.size).copy()).permute(2, 0, 1), row["label"]


def seed_worker(worker_id: int) -> None:
    seed = (torch.initial_seed() + worker_id) % 2**32
    random.seed(seed)
    np.random.seed(seed)


def normalize(images: torch.Tensor) -> torch.Tensor:
    return (images.float().div_(255) - MEAN.to(images.device)) / STD.to(images.device)


@torch.no_grad()
def evaluate(model: nn.Module, loader: DataLoader) -> dict:
    model.eval()
    top1 = top5 = total = 0
    negative_correct = negative_total = 0
    for images, labels in loader:
        images, labels = images.cuda(non_blocking=True), labels.cuda(non_blocking=True)
        with torch.autocast("cuda"):
            logits = model(normalize(images))
        ranked = logits.topk(5, dim=1).indices
        positive = labels > 0
        top1 += (ranked[positive, 0] == labels[positive]).sum().item()
        top5 += (ranked[positive] == labels[positive, None]).any(1).sum().item()
        total += positive.sum().item()
        negative_correct += (ranked[~positive, 0] == 0).sum().item()
        negative_total += (~positive).sum().item()
    return {"top1": top1 / max(total, 1), "top5": top5 / max(total, 1),
            "negative_recall": negative_correct / max(negative_total, 1)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="mobilenetv4_conv_medium.e500_r256_in1k")
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch", type=int, default=128)
    parser.add_argument("--lr", type=float, default=1.5e-3)
    parser.add_argument("--per-class", type=int, default=30)
    parser.add_argument("--workers", type=int, default=18)
    parser.add_argument("--name", default="run")
    parser.add_argument("--scene", type=float, default=0.3, help="fração de cartas inteiras em cena")
    parser.add_argument("--resume", default=None, help="run de origem, para ajuste fino")
    args = parser.parse_args()

    out = WORK / "runs" / args.name
    out.mkdir(parents=True, exist_ok=True)
    rows = json.loads((MANIFESTS / "train.json").read_text(encoding="utf-8"))
    val_rows = json.loads((MANIFESTS / "val.json").read_text(encoding="utf-8"))
    train_set = TrainSet(rows, args.size, args.per_class, negatives=len(rows) // 20 + 2500, scene=args.scene)
    print(f"treino: {len(rows)} imagens, {len(train_set)} amostras por época; validação: {len(val_rows)}", flush=True)

    train_loader = DataLoader(train_set, batch_size=args.batch, shuffle=True, num_workers=args.workers, pin_memory=True,
                              persistent_workers=True, drop_last=True, worker_init_fn=seed_worker, prefetch_factor=3)
    val_loader = DataLoader(EvalSet(val_rows, args.size), batch_size=args.batch * 2, num_workers=6, pin_memory=True, persistent_workers=True)

    model = timm.create_model(args.model, pretrained=not args.resume, num_classes=NUM_CLASSES, drop_rate=0.2, drop_path_rate=0.1)
    scene_loader = None
    if args.resume:
        model.load_state_dict(torch.load(WORK / "runs" / args.resume / "best.pt", map_location="cpu", weights_only=False)["model"])
        # No ajuste fino, a escolha do melhor ponto considera também a carta inteira em cena.
        from evaluate import TestSet
        cards = [row for row in val_rows if row["kind"] == "card"]
        photos = [Path(row["path"]) for row in val_rows if row["kind"] == "neg"]
        scene_loader = DataLoader(TestSet(cards, args.size, "scene", photos), batch_size=args.batch * 2, num_workers=6, pin_memory=True, persistent_workers=True)
    model = model.cuda()
    ema = ModelEmaV3(model, decay=0.9995, device="cuda")
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.05)
    steps = len(train_loader) * args.epochs
    warmup = len(train_loader) * 2
    scheduler = torch.optim.lr_scheduler.LambdaLR(
        optimizer, lambda s: min(1, (s + 1) / warmup) * (0.5 * (1 + math.cos(math.pi * min(1, s / steps))) * 0.99 + 0.01))
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    scaler = torch.amp.GradScaler("cuda")

    best = 0.0
    history = []
    step = 0
    for epoch in range(1, args.epochs + 1):
        model.train()
        started = time.time()
        running = 0.0
        for images, labels in train_loader:
            images, labels = images.cuda(non_blocking=True), labels.cuda(non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast("cuda"):
                loss = criterion(model(normalize(images)), labels)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            ema.update(model, step=step)
            step += 1
            running += loss.item()
        metrics = evaluate(ema.module, val_loader)
        if scene_loader:
            metrics["scene_top1"] = evaluate(ema.module, scene_loader)["top1"]
        metrics |= {"epoch": epoch, "loss": running / len(train_loader), "seconds": round(time.time() - started)}
        history.append(metrics)
        print(json.dumps({k: round(v, 4) if isinstance(v, float) else v for k, v in metrics.items()}), flush=True)
        (out / "history.json").write_text(json.dumps(history), encoding="utf-8")
        score = (metrics["top1"] + metrics.get("scene_top1", metrics["top1"])) / 2
        if score > best:
            best = score
            torch.save({"model": ema.module.state_dict(), "args": vars(args), "metrics": metrics}, out / "best.pt")
    print("melhor top-1 na validação:", best, flush=True)


if __name__ == "__main__":
    main()
