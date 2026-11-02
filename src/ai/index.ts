import { OnDeviceRecognizer } from './onDeviceRecognizer';

const DEFAULT_MANIFEST = `${import.meta.env.BASE_URL}models/pokedex-vision/manifest.json`;

/**
 * Ponto único de escolha do reconhecedor. Hoje tudo roda no aparelho, sem servidor e sem
 * chaves. VITE_MODEL_MANIFEST_URL permite hospedar o modelo em outro lugar sem mudar código.
 */
export const recognizer = new OnDeviceRecognizer(
  import.meta.env.VITE_MODEL_MANIFEST_URL || DEFAULT_MANIFEST,
);

export * from './types';
