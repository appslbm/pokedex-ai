"""Traduz descrições e efeitos de habilidade para pt-BR com um modelo local (opus-mt-tc-big-en-pt).

A PokéAPI não tem esses textos em português. A tradução roda aqui, uma vez, e o resultado
fica versionado em data/i18n/pt-BR.json: a aplicação publicada não depende de nenhum tradutor.
As categorias ("Seed Pokémon") são curtas demais para tradução automática e ficam no dicionário
data/i18n/genus.json, revisado à mão.

Uso:  python ml/scripts/translate.py
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

ROOT = Path(__file__).resolve().parents[2]
STRINGS = ROOT / "data" / "i18n" / "strings-en.json"
OUTPUT = ROOT / "data" / "i18n" / "pt-BR.json"
GENUS = ROOT / "data" / "i18n" / "genus.json"
MODEL = "Helsinki-NLP/opus-mt-tc-big-en-pt"
BATCH = 48

# Correções para termos que o modelo não conhece ou traduz fora do contexto dos jogos.
GLOSSARY: list[tuple[str, str]] = [
    (r"\bPokémons\b", "Pokémon"),
    (r"\bPoké ?Balls?\b", "Poké Bola"),
    (r"\bPoke ?Bolas?\b", "Poké Bola"),
    (r"\bHP\b", "PS"),
    (r"\bPP\b", "PP"),
    (r"\bacertos? críticos?\b", "golpes críticos"),
    (r"\bataques? super eficazes\b", "golpes supereficazes"),
    (r"\bsuper eficaz(es)?\b", "supereficaz"),
    (r"\bSp\. ?Atk\b", "Ataque Especial"),
    (r"\bSp\. ?Def\b", "Defesa Especial"),
    (r"\s+[-–]\s+", " — "),
    # O modelo mistura variantes de Portugal; o público aqui é brasileiro.
    (r"\b[Rr]egistos\b", "registros"),
    (r"\b[Rr]egisto\b", "registro"),
    (r"\bpontapés\b", "chutes"),
    (r"\bpontapé\b", "chute"),
    (r"\b(?:O|o) seu\b", "seu"),
    (r"\b(?:A|a) sua\b", "sua"),
    (r"\b(?:Os|os) seus\b", "seus"),
    (r"\b(?:As|as) suas\b", "suas"),
    (r"\bequipa\b", "equipe"),
    (r"\bcomboio\b", "trem"),
    (r"\becrã\b", "tela"),
    (r"\bbebés\b", "bebês"),
    (r"\bbebé\b", "bebê"),
    (r"\bvomita\b", "expele"),
    (r"\bvomitam\b", "expelem"),
    # "move" nos jogos é golpe, não movimento.
    (r"\b[Mm]ovimentos\b", "golpes"),
    (r"\b[Mm]ovimento\b(?= (?:de|do tipo|especial|físico))", "golpe"),
]


def split_sentences(text: str) -> list[str]:
    # "1.5×" confunde o modelo, que costuma descartar o símbolo; por extenso ele preserva o sentido.
    text = re.sub(r"(\d+(?:\.\d+)?)×", r"\1 times", text.replace("×", "×"))
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text.strip())
    return [p for p in parts if p]


def postprocess(text: str) -> str:
    for pattern, replacement in GLOSSARY:
        text = re.sub(pattern, replacement, text)
    text = re.sub(r"\s+", " ", text).strip()
    # Remover o "O" de "O seu" pode deixar a frase começando em minúscula.
    return re.sub(r"(^|[.!?]\s+)([a-záéíóúâêôãõ])", lambda m: m.group(1) + m.group(2).upper(), text)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    strings: list[str] = json.loads(STRINGS.read_text(encoding="utf-8"))
    genus: dict[str, str] = json.loads(GENUS.read_text(encoding="utf-8")) if GENUS.exists() else {}
    existing: dict[str, str] = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}

    # O texto da categoria sempre termina em "Pokémon" e é curto.
    is_genus = lambda s: s.endswith("Pokémon") and len(s) < 40  # noqa: E731
    existing = {key: value for key, value in existing.items() if "×" not in key}
    todo = [s for s in strings if s not in existing and not is_genus(s)]
    print(f"{len(strings)} textos; {len(todo)} a traduzir", flush=True)

    if todo:
        tokenizer = AutoTokenizer.from_pretrained(MODEL)
        device = "cuda" if torch.cuda.is_available() and not os.environ.get("TRANSLATE_CPU") else "cpu"
        model = AutoModelForSeq2SeqLM.from_pretrained(MODEL).to(device).eval()
        sentences = sorted({s for text in todo for s in split_sentences(text)}, key=len)
        print(f"{len(sentences)} frases únicas", flush=True)
        translated: dict[str, str] = {}
        for start in range(0, len(sentences), BATCH):
            batch = sentences[start:start + BATCH]
            encoded = tokenizer([">>por<< " + s for s in batch], return_tensors="pt", padding=True,
                                truncation=True, max_length=256).to(device)
            with torch.no_grad():
                output = model.generate(**encoded, max_new_tokens=220, num_beams=4)
            for source, target in zip(batch, tokenizer.batch_decode(output, skip_special_tokens=True)):
                translated[source] = target
            if (start // BATCH) % 20 == 0:
                print(f"  {start + len(batch)}/{len(sentences)}", flush=True)
        for text in todo:
            existing[text] = postprocess(" ".join(translated[s] for s in split_sentences(text)))

    existing = {key: postprocess(value) for key, value in existing.items()}
    existing.update(genus)
    OUTPUT.write_text(json.dumps(existing, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")
    print("Salvo:", OUTPUT, len(existing))


if __name__ == "__main__":
    main()
