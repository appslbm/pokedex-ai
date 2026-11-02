"""Avalia o modelo em dados que ele nunca viu, calibra a confiança e define os limites.

- Temperatura e limites são ajustados SÓ na validação; o teste não influencia nenhuma escolha.
- Testes em imagem limpa e com simulação de câmera (carta inteira em cena, ângulo, reflexo…).
- Negativos medem o principal risco de um Pokédex: dizer que qualquer coisa é um Pokémon.

Uso:  python ml/scripts/evaluate.py --run mnv4m_256
      python ml/scripts/evaluate.py --baseline skshmjn     (modelos públicos, para comparação)
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np
import timm
import torch
from torch.utils.data import DataLoader, Dataset

sys.path.insert(0, str(Path(__file__).parent))
import augment as A  # noqa: E402
from train import DATA, MANIFESTS, NUM_CLASSES, WORK, normalize  # noqa: E402


DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


class TestSet(Dataset):
    """`mode`: clean (recorte limpo), camera (mesma imagem degradada) ou scene (carta em cena)."""

    def __init__(self, rows: list[dict], size: int, mode: str, photos: list[Path] | None = None):
        self.rows, self.size, self.mode, self.photos = rows, size, mode, photos or []

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        # Semente fixa por imagem: toda execução (e todo modelo) vê exatamente as mesmas degradações.
        random.seed(index * 7 + 11)
        np.random.seed(index * 7 + 11)
        image = A.read_rgb(DATA / row["path"])
        is_card = row["kind"] in ("card", "negcard")
        if self.mode == "scene" and is_card:
            output = A.card_in_scene(image, self.size, self.photos, DATA, extent=(0.8, 1.05))
            output = A.camera(output, severity=0.8)
        else:
            if is_card:
                height, width = image.shape[:2]
                image = image[int(height * .13):int(height * .46), int(width * .09):int(width * .91)]
            output = A.center_square(image, self.size)
            if self.mode == "camera":
                output = A.camera(output, severity=0.8)
        return torch.from_numpy(output.copy()).permute(2, 0, 1), row["label"]


def collect(rows, size, mode, predict, photos=None, batch=128) -> tuple[torch.Tensor, torch.Tensor]:
    loader = DataLoader(TestSet(rows, size, mode, photos), batch_size=batch, num_workers=8, pin_memory=True)
    logits, labels = [], []
    with torch.no_grad():
        for images, targets in loader:
            logits.append(predict(images.to(DEVICE, non_blocking=True)).float().cpu())
            labels.append(targets)
    return torch.cat(logits), torch.cat(labels)


def fit_temperature(logits: torch.Tensor, labels: torch.Tensor) -> float:
    log_t = torch.zeros(1, requires_grad=True)
    optimizer = torch.optim.LBFGS([log_t], lr=0.1, max_iter=200)

    def closure():
        optimizer.zero_grad()
        loss = torch.nn.functional.cross_entropy(logits / log_t.exp(), labels)
        loss.backward()
        return loss

    optimizer.step(closure)
    return float(log_t.exp())


def calibration_error(probabilities: torch.Tensor, labels: torch.Tensor, bins=15) -> float:
    confidence, predicted = probabilities.max(1)
    correct = predicted == labels
    error = 0.0
    for low, high in zip(torch.linspace(0, 1, bins + 1)[:-1], torch.linspace(0, 1, bins + 1)[1:]):
        mask = (confidence > low) & (confidence <= high)
        if mask.any():
            error += mask.float().mean().item() * abs(correct[mask].float().mean().item() - confidence[mask].mean().item())
    return error


def decide(probabilities: torch.Tensor, thresholds: dict) -> tuple[torch.Tensor, torch.Tensor]:
    """Mesma regra de src/ai/decision.ts. Retorna (identificado?, espécie prevista)."""
    species = probabilities[:, 1:]
    best, index = species.max(1)
    not_pokemon = probabilities[:, 0]
    identified = (not_pokemon < thresholds["notPokemon"]) & (best >= thresholds["suggest"]) & (best >= thresholds["identified"])
    return identified, index + 1


def report(name: str, logits: torch.Tensor, labels: torch.Tensor, temperature: float, thresholds: dict | None) -> dict:
    probabilities = (logits / temperature).softmax(1)
    positive = labels > 0
    result: dict = {"imagens": len(labels)}
    if positive.any():
        ranked = probabilities[positive].topk(5, 1).indices
        target = labels[positive]
        result["top1"] = (ranked[:, 0] == target).float().mean().item()
        result["top5"] = (ranked == target[:, None]).any(1).float().mean().item()
    if thresholds:
        identified, predicted = decide(probabilities, thresholds)
        if positive.any():
            mask = identified[positive]
            result["cobertura"] = mask.float().mean().item()
            result["precisao_quando_afirma"] = (predicted[positive][mask] == labels[positive][mask]).float().mean().item() if mask.any() else None
        if (~positive).any():
            result["falso_positivo"] = identified[~positive].float().mean().item()
    print(f"{name:32}", {k: round(v, 4) if isinstance(v, float) else v for k, v in result.items()}, flush=True)
    return result


def choose_thresholds(logits: torch.Tensor, labels: torch.Tensor, temperature: float, target_precision=0.95) -> dict:
    probabilities = (logits / temperature).softmax(1)
    thresholds = {"notPokemon": 0.5, "suggest": 0.08, "identified": 0.5}
    for candidate in np.arange(0.2, 0.96, 0.02):
        thresholds["identified"] = float(candidate)
        identified, predicted = decide(probabilities, thresholds)
        if identified.sum() < 20:
            break
        # Negativos afirmados contam como erro.
        if (predicted[identified] == labels[identified]).float().mean() >= target_precision:
            break
    thresholds["identified"] = round(thresholds["identified"], 2)
    return thresholds


def load_rows(name: str) -> list[dict]:
    return json.loads((MANIFESTS / f"{name}.json").read_text(encoding="utf-8"))


def own_model(run: str):
    checkpoint = torch.load(WORK / "runs" / run / "best.pt", map_location="cpu", weights_only=False)
    args = checkpoint["args"]
    model = timm.create_model(args["model"], pretrained=False, num_classes=NUM_CLASSES)
    model.load_state_dict(checkpoint["model"])
    model = model.cuda().eval()

    def predict(images):
        with torch.autocast("cuda"):
            return model(normalize(images))

    return predict, args["size"]


def baseline_skshmjn():
    from transformers import ViTForImageClassification
    model = ViTForImageClassification.from_pretrained("skshmjn/Pokemon-classifier-gen9-1025").cuda().eval()

    def predict(images):
        # Normalização documentada do modelo: [-1, 1]. Saída 0..1024 vira 1..1025; sem classe negativa.
        x = images.float().div(255).sub(0.5).div(0.5)
        with torch.autocast("cuda"):
            logits = model(pixel_values=x).logits
        return torch.cat([torch.full((len(logits), 1), -1e4, device=logits.device), logits], 1)

    return predict, 224


def published_model():
    """O arquivo exato que vai para o site, rodando na CPU como no navegador."""
    import onnxruntime as ort
    root = WORK.parents[1] / "public" / "models" / "pokedex-vision"
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    session = ort.InferenceSession(str(root / manifest["file"]), providers=["CPUExecutionProvider"])
    name = session.get_inputs()[0].name

    def predict(images):
        batch = normalize(images).cpu().numpy()
        return torch.cat([torch.from_numpy(session.run(None, {name: item[None]})[0]) for item in batch])

    return predict, manifest["inputSize"]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default="mnv4m_256")
    parser.add_argument("--baseline", default=None)
    parser.add_argument("--published", action="store_true", help="avalia o model.onnx publicado; limites vêm da validação do ONNX")
    args = parser.parse_args()

    if args.published:
        predict, size = published_model()
        args.run = f"{args.run}-publicado"
    elif args.baseline == "skshmjn":
        predict, size = baseline_skshmjn()
    else:
        predict, size = own_model(args.run)
    photos = [Path(r["path"]) for r in load_rows("test_negative")]
    tag = args.baseline or args.run
    out = WORK / "runs" / tag
    out.mkdir(parents=True, exist_ok=True)

    val = load_rows("val")
    val_logits, val_labels = collect(val, size, "camera", predict, photos)
    # A calibração inclui a carta inteira em cena: é o uso mais comum e o mais difícil.
    scene_logits, scene_labels = collect([r for r in val if r["kind"] in ("card", "negcard")], size, "scene", predict, photos)
    val_logits, val_labels = torch.cat([val_logits, scene_logits]), torch.cat([val_labels, scene_labels])
    baseline_run = args.baseline is not None
    temperature = 1.0 if baseline_run else fit_temperature(val_logits, val_labels)
    thresholds = None if baseline_run else choose_thresholds(val_logits, val_labels, temperature)
    print("temperatura", temperature, "limites", thresholds, flush=True)
    if not baseline_run:
        print("erro de calibração na validação: antes", round(calibration_error(val_logits.softmax(1), val_labels), 4),
              "depois", round(calibration_error((val_logits / temperature).softmax(1), val_labels), 4), flush=True)

    cards, photo_rows, negative, jj = (load_rows(n) for n in ("test_cards", "test_photos", "test_negative", "test_jjmack"))
    pokemon_cards = [r for r in cards if r["label"]]
    trainer_cards = [r for r in cards if not r["label"]]
    scenarios = {
        "cartas_ilustracao_limpa": (pokemon_cards, "clean"),
        "cartas_ilustracao_camera": (pokemon_cards, "camera"),
        "cartas_inteiras_em_cena": (pokemon_cards, "scene"),
        "variadas_gen1_limpa": (photo_rows, "clean"),
        "variadas_gen1_camera": (photo_rows, "camera"),
        "sprites_referencia": (jj, "clean"),
        "negativos_fotos": (negative, "clean"),
        "negativos_fotos_camera": (negative, "camera"),
        "negativos_cartas_treinador": (trainer_cards, "clean"),
    }
    results: dict = {"temperatura": temperature, "limites": thresholds}
    for name, (rows, mode) in scenarios.items():
        if not rows:
            continue
        logits, labels = collect(rows, size, mode, predict, photos)
        results[name] = report(name, logits, labels, temperature, thresholds)
        if name == "cartas_ilustracao_limpa":
            species_generation = {}
            raw = json.loads((WORK.parents[1] / ".cache" / "pokeapi-raw.json").read_text(encoding="utf-8"))
            for species in raw["species"]:
                species_generation[species["id"]] = species["generation_id"]
            predicted = logits.argmax(1)
            per_generation = {}
            for generation in range(1, 10):
                mask = torch.tensor([species_generation.get(int(label), 0) == generation for label in labels])
                if mask.any():
                    per_generation[generation] = round((predicted[mask] == labels[mask]).float().mean().item(), 4)
            results["top1_por_geracao"] = per_generation
            print("por geração:", per_generation, flush=True)

    (out / "evaluation.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    if args.published:
        # A quantização muda levemente os logits: a calibração publicada é a do próprio arquivo final.
        path = WORK.parents[1] / "public" / "models" / "pokedex-vision" / "manifest.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        manifest |= {"temperature": round(temperature, 4), "thresholds": thresholds}
        path.write_text(json.dumps(manifest), encoding="utf-8")


if __name__ == "__main__":
    main()
