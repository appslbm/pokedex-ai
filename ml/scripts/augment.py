"""Aumento de dados que imita o caminho real da imagem: um celular apontado para algo.

A maior parte do acervo é arte limpa. Sem isto, o modelo iria bem em imagens perfeitas
e mal em fotos reais, com fundo, ângulo, reflexo, tremor e compressão.
"""
from __future__ import annotations

import random
from pathlib import Path

import cv2
import numpy as np

cv2.setNumThreads(0)


def rand(a: float, b: float) -> float:
    return random.uniform(a, b)


def read_rgb(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise OSError(f"imagem inválida: {path}")
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def read_rgba(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise OSError(f"imagem inválida: {path}")
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
        white = np.all(image[..., :3] > 248, axis=2)
        image[white, 3] = 0
    if image.dtype != np.uint8:
        image = (image / 257).astype(np.uint8)
    return cv2.cvtColor(image, cv2.COLOR_BGRA2RGBA)


def random_crop(image: np.ndarray, size: int, scale=(0.6, 1.0)) -> np.ndarray:
    height, width = image.shape[:2]
    side = int(min(height, width) * rand(*scale))
    side = max(side, 8)
    x = random.randint(0, width - side)
    y = random.randint(0, height - side)
    return cv2.resize(image[y:y + side, x:x + side], (size, size), interpolation=cv2.INTER_AREA)


def center_square(image: np.ndarray, size: int) -> np.ndarray:
    """Mesmo recorte usado pela aplicação no navegador."""
    height, width = image.shape[:2]
    side = min(height, width)
    x, y = (width - side) // 2, (height - side) // 2
    interp = cv2.INTER_AREA if side > size else cv2.INTER_LINEAR
    return cv2.resize(image[y:y + side, x:x + side], (size, size), interpolation=interp)


def background(size: int, photos: list[Path], root: Path) -> np.ndarray:
    choice = random.random()
    if choice < 0.18:
        return np.full((size, size, 3), 255, np.uint8)
    if choice < 0.36:
        color = np.array([random.randint(0, 255) for _ in range(3)], dtype=np.float32)
        other = np.array([random.randint(0, 255) for _ in range(3)], dtype=np.float32)
        ramp = np.linspace(0, 1, size, dtype=np.float32)[None, :, None]
        canvas = color * (1 - ramp) + other * ramp
        if random.random() < 0.5:
            canvas = np.transpose(canvas, (1, 0, 2))
        return np.broadcast_to(canvas, (size, size, 3)).astype(np.uint8)
    return random_crop(read_rgb(root / random.choice(photos)), size, (0.4, 1.0))


def paste(canvas: np.ndarray, rgba: np.ndarray, x: int, y: int) -> None:
    """Cola respeitando a transparência, cortando o que passar da borda."""
    height, width = rgba.shape[:2]
    H, W = canvas.shape[:2]
    x0, y0 = max(x, 0), max(y, 0)
    x1, y1 = min(x + width, W), min(y + height, H)
    if x1 <= x0 or y1 <= y0:
        return
    part = rgba[y0 - y:y1 - y, x0 - x:x1 - x].astype(np.float32)
    alpha = part[..., 3:] / 255
    region = canvas[y0:y1, x0:x1].astype(np.float32)
    canvas[y0:y1, x0:x1] = (part[..., :3] * alpha + region * (1 - alpha)).astype(np.uint8)


def render_sprite(path: Path, size: int, photos: list[Path], root: Path, fill=(0.5, 1.05)) -> np.ndarray:
    rgba = read_rgba(path)
    ys, xs = np.nonzero(rgba[..., 3] > 16)
    if len(xs):
        rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    target = int(size * rand(*fill))
    factor = target / max(rgba.shape[:2])
    width, height = max(1, int(rgba.shape[1] * factor)), max(1, int(rgba.shape[0] * factor))
    interp = cv2.INTER_AREA if factor < 1 else random.choice([cv2.INTER_NEAREST, cv2.INTER_LINEAR, cv2.INTER_CUBIC])
    rgba = cv2.resize(rgba, (width, height), interpolation=interp)
    canvas = background(size, photos, root).copy()
    paste(canvas, rgba, random.randint(min(0, size - width), max(0, size - width)),
          random.randint(min(0, size - height), max(0, size - height)))
    return canvas


def card_art(image: np.ndarray, size: int) -> np.ndarray:
    """Região da ilustração da carta. Sorteada, porque o layout muda bastante entre épocas."""
    height, width = image.shape[:2]
    top, bottom = int(height * rand(0.07, 0.14)), int(height * rand(0.42, 0.56))
    left, right = int(width * rand(0.03, 0.11)), int(width * rand(0.89, 0.97))
    return random_crop(image[top:bottom, left:right], size, (0.72, 1.0))


def card_in_scene(image: np.ndarray, size: int, photos: list[Path], root: Path, extent=(0.75, 1.3)) -> np.ndarray:
    """Carta inteira sobre um fundo, como quando alguém a segura diante da câmera."""
    height, width = image.shape[:2]
    target = size * rand(*extent)
    factor = target / height
    card = cv2.resize(image, (max(1, int(width * factor)), max(1, int(height * factor))), interpolation=cv2.INTER_AREA)
    rgba = np.dstack([card, np.full(card.shape[:2], 255, np.uint8)])
    canvas = background(size, photos, root).copy()
    h, w = card.shape[:2]
    paste(canvas, rgba, (size - w) // 2 + random.randint(-size // 12, size // 12), (size - h) // 2 + random.randint(-size // 8, size // 12))
    return canvas


def perspective(image: np.ndarray, strength=0.12) -> np.ndarray:
    size = image.shape[0]
    margin = size * strength
    source = np.float32([[0, 0], [size, 0], [size, size], [0, size]])
    target = source + np.float32([[rand(-margin, margin), rand(-margin, margin)] for _ in range(4)])
    matrix = cv2.getPerspectiveTransform(source, target)
    return cv2.warpPerspective(image, matrix, (size, size), borderMode=cv2.BORDER_REFLECT_101)


def rotate(image: np.ndarray, degrees: float) -> np.ndarray:
    size = image.shape[0]
    matrix = cv2.getRotationMatrix2D((size / 2, size / 2), degrees, rand(1.0, 1.15))
    return cv2.warpAffine(image, matrix, (size, size), borderMode=cv2.BORDER_REFLECT_101)


def color(image: np.ndarray) -> np.ndarray:
    output = image.astype(np.float32)
    output *= np.array([rand(0.88, 1.12), rand(0.92, 1.08), rand(0.88, 1.12)], dtype=np.float32)  # balanço de branco
    output = (output - 128) * rand(0.7, 1.3) + 128 + rand(-35, 35)
    output = np.clip(output, 0, 255)
    gray = output.mean(axis=2, keepdims=True)
    output = gray + (output - gray) * rand(0.6, 1.35)
    output = 255 * (np.clip(output, 0, 255) / 255) ** rand(0.7, 1.4)
    return np.clip(output, 0, 255).astype(np.uint8)


def hue(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
    # Pouco: a cor é informação importante para distinguir espécies.
    hsv[..., 0] = (hsv[..., 0].astype(np.int16) + random.randint(-5, 5)) % 180
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)


def blur(image: np.ndarray) -> np.ndarray:
    if random.random() < 0.5:
        kernel = random.choice([3, 5, 7])
        return cv2.GaussianBlur(image, (kernel, kernel), 0)
    length = random.choice([5, 7, 9])
    motion = np.zeros((length, length), np.float32)
    motion[length // 2] = 1
    matrix = cv2.getRotationMatrix2D((length / 2 - .5, length / 2 - .5), rand(0, 180), 1)
    motion = cv2.warpAffine(motion, matrix, (length, length))
    return cv2.filter2D(image, -1, motion / max(motion.sum(), 1e-3))


def low_resolution(image: np.ndarray) -> np.ndarray:
    size = image.shape[0]
    small = int(size * rand(0.35, 0.7))
    reduced = cv2.resize(image, (small, small), interpolation=cv2.INTER_AREA)
    return cv2.resize(reduced, (size, size), interpolation=random.choice([cv2.INTER_NEAREST, cv2.INTER_LINEAR]))


def noise(image: np.ndarray) -> np.ndarray:
    grain = np.random.normal(0, rand(4, 18), image.shape)
    return np.clip(image.astype(np.float32) + grain, 0, 255).astype(np.uint8)


def jpeg(image: np.ndarray) -> np.ndarray:
    ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, random.randint(35, 90)])
    return cv2.imdecode(encoded, cv2.IMREAD_COLOR) if ok else image


def glare(image: np.ndarray) -> np.ndarray:
    """Reflexo de luz, comum em cartas brilhantes e telas."""
    size = image.shape[0]
    grid_y, grid_x = np.mgrid[0:size, 0:size].astype(np.float32)
    center_x, center_y, radius = rand(0, size), rand(0, size), rand(size * .15, size * .5)
    spot = np.exp(-((grid_x - center_x) ** 2 + (grid_y - center_y) ** 2) / (2 * radius ** 2))
    return np.clip(image + (spot * rand(60, 170))[..., None], 0, 255).astype(np.uint8)


def moire(image: np.ndarray) -> np.ndarray:
    """Padrão que surge ao fotografar uma tela."""
    size = image.shape[0]
    grid_y, grid_x = np.mgrid[0:size, 0:size].astype(np.float32)
    angle = rand(0, np.pi)
    wave = np.sin((grid_x * np.cos(angle) + grid_y * np.sin(angle)) * rand(0.5, 1.6))
    return np.clip(image.astype(np.float32) * (1 + wave[..., None] * rand(0.03, 0.12)), 0, 255).astype(np.uint8)


def occlusion(image: np.ndarray) -> np.ndarray:
    """Dedos e outros objetos cobrindo parte do Pokémon."""
    output = image.copy()
    size = image.shape[0]
    for _ in range(random.randint(1, 3)):
        width, height = random.randint(size // 12, size // 3), random.randint(size // 12, size // 3)
        x, y = random.randint(0, size - width), random.randint(0, size - height)
        tone = random.choice([(214, 170, 140), (120, 86, 66), (40, 40, 40), (235, 235, 235)])
        output[y:y + height, x:x + width] = tone
    return output


def camera(image: np.ndarray, severity: float = 1.0) -> np.ndarray:
    """Sequência aleatória de degradações. `severity` controla a probabilidade de cada uma."""
    chance = lambda p: random.random() < p * severity  # noqa: E731
    if random.random() < 0.5:
        image = image[:, ::-1].copy()
    if chance(0.5):
        image = perspective(image)
    if chance(0.35):
        image = rotate(image, rand(-22, 22))
    if chance(0.8):
        image = color(image)
    if chance(0.3):
        image = hue(image)
    if chance(0.2):
        image = glare(image)
    if chance(0.25):
        image = occlusion(image)
    if chance(0.3):
        image = blur(image)
    if chance(0.2):
        image = low_resolution(image)
    if chance(0.12):
        image = moire(image)
    if chance(0.3):
        image = noise(image)
    if chance(0.4):
        image = jpeg(image)
    return image
