export interface CropRect {
  x: number;
  y: number;
  size: number;
}

/** Maior quadrado centralizado. `scale` menor que 1 aproxima, como o visor do scanner. */
export function centerSquare(width: number, height: number, scale = 1): CropRect {
  const size = Math.round(Math.min(width, height) * scale);
  return { x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), size };
}

/** Converte RGBA em tensor NCHW normalizado, na ordem que o modelo espera. */
export function imageDataToTensor(
  image: Pick<ImageData, 'data' | 'width' | 'height'>,
  mean: readonly number[],
  std: readonly number[],
): Float32Array {
  const { data, width, height } = image;
  const pixels = width * height;
  const tensor = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) {
    const offset = i * 4;
    tensor[i] = (data[offset] / 255 - mean[0]) / std[0];
    tensor[pixels + i] = (data[offset + 1] / 255 - mean[1]) / std[1];
    tensor[2 * pixels + i] = (data[offset + 2] / 255 - mean[2]) / std[2];
  }
  return tensor;
}

/** Recorta e redimensiona uma imagem, vídeo ou bitmap para o tamanho de entrada do modelo. */
export function grabSquare(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  inputSize: number,
  scale = 1,
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = inputSize;
  canvas.height = inputSize;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D indisponível');
  context.imageSmoothingQuality = 'high';
  const crop = centerSquare(sourceWidth, sourceHeight, scale);
  context.drawImage(source, crop.x, crop.y, crop.size, crop.size, 0, 0, inputSize, inputSize);
  return context.getImageData(0, 0, inputSize, inputSize);
}
