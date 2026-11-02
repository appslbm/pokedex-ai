"""Exporta o modelo treinado para ONNX, reduz o tamanho e confere se nada mudou.

Gera public/models/pokedex-vision/{model.onnx,manifest.json}. A variante quantizada só
é aceita se a acurácia na validação cair pouco; senão, cai para precisão de 16 bits.

Uso:  python ml/scripts/export_model.py --run mnv4m_256
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import timm
import torch
from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quant_pre_process, quantize_static

sys.path.insert(0, str(Path(__file__).parent))
import augment as A  # noqa: E402
from evaluate import TestSet, load_rows  # noqa: E402
from train import NUM_CLASSES, WORK  # noqa: E402

ROOT = WORK.parents[1]
TARGET = ROOT / "public" / "models" / "pokedex-vision"
MEAN = np.array([0.485, 0.456, 0.406], np.float32)[:, None, None]
STD = np.array([0.229, 0.224, 0.225], np.float32)[:, None, None]
MAX_ACCURACY_DROP = 0.01


def to_input(image: torch.Tensor) -> np.ndarray:
    return ((image.numpy().astype(np.float32) / 255 - MEAN) / STD)[None]


def accuracy(path: Path, dataset: TestSet, limit: int = 1200) -> float:
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    name = session.get_inputs()[0].name
    hits = total = 0
    for index in range(min(limit, len(dataset))):
        image, label = dataset[index]
        hits += int(session.run(None, {name: to_input(image)})[0][0].argmax() == label)
        total += 1
    return hits / total


class Calibration(CalibrationDataReader):
    def __init__(self, dataset: TestSet, name: str, samples: int = 300):
        indices = np.linspace(0, len(dataset) - 1, samples).astype(int)
        self.items = iter({name: to_input(dataset[int(i)][0])} for i in indices)

    def get_next(self):
        return next(self.items, None)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default="mnv4m_256")
    args = parser.parse_args()

    run = WORK / "runs" / args.run
    checkpoint = torch.load(run / "best.pt", map_location="cpu", weights_only=False)
    config = checkpoint["args"]
    size = config["size"]
    model = timm.create_model(config["model"], pretrained=False, num_classes=NUM_CLASSES, exportable=True)
    model.load_state_dict(checkpoint["model"])
    model.eval()

    float_path = run / "model-float.onnx"
    dummy = torch.randn(1, 3, size, size)
    torch.onnx.export(model, (dummy,), str(float_path), input_names=["pixel_values"], output_names=["logits"],
                      opset_version=17, dynamo=False, do_constant_folding=True)
    onnx.checker.check_model(onnx.load(str(float_path)))

    session = ort.InferenceSession(str(float_path), providers=["CPUExecutionProvider"])
    with torch.no_grad():
        expected = model(dummy).numpy()
    delta = np.abs(session.run(None, {"pixel_values": dummy.numpy()})[0] - expected).max()
    print(f"ONNX float: {float_path.stat().st_size / 1e6:.1f} MB; diferença máxima para o PyTorch: {delta:.6f}", flush=True)
    assert delta < 1e-2

    val = [row for row in load_rows("val") if row["label"]]
    dataset = TestSet(val, size, "clean")
    base_accuracy = accuracy(float_path, dataset)
    print(f"acurácia float (amostra da validação): {base_accuracy:.4f}", flush=True)

    prepared = run / "model-prep.onnx"
    quant_pre_process(str(float_path), str(prepared), skip_symbolic_shape=True)
    quantized = run / "model-int8.onnx"
    quantize_static(str(prepared), str(quantized), Calibration(dataset, "pixel_values"), quant_format=QuantFormat.QDQ,
                    per_channel=True, activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8)
    quant_accuracy = accuracy(quantized, dataset)
    print(f"int8: {quantized.stat().st_size / 1e6:.1f} MB; acurácia {quant_accuracy:.4f}", flush=True)

    if base_accuracy - quant_accuracy <= MAX_ACCURACY_DROP:
        chosen = quantized
    else:
        from onnxconverter_common import float16
        half = float16.convert_float_to_float16(onnx.load(str(float_path)), keep_io_types=True)
        chosen = run / "model-fp16.onnx"
        onnx.save(half, str(chosen))
        print(f"fp16: {chosen.stat().st_size / 1e6:.1f} MB; acurácia {accuracy(chosen, dataset):.4f}", flush=True)

    evaluation = json.loads((run / "evaluation.json").read_text(encoding="utf-8"))
    TARGET.mkdir(parents=True, exist_ok=True)
    shutil.copy(chosen, TARGET / "model.onnx")
    manifest = {
        "version": args.run,
        "file": "model.onnx",
        "bytes": (TARGET / "model.onnx").stat().st_size,
        "inputSize": size,
        "mean": [0.485, 0.456, 0.406],
        "std": [0.229, 0.224, 0.225],
        "temperature": round(evaluation["temperatura"], 4),
        "labels": list(range(NUM_CLASSES)),
        "thresholds": evaluation["limites"],
    }
    (TARGET / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    print("publicado:", chosen.name, manifest["bytes"] / 1e6, "MB", flush=True)


if __name__ == "__main__":
    main()
