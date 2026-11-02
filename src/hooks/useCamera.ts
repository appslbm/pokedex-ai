import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'error';

export type CameraError =
  | 'denied'
  | 'not-found'
  | 'in-use'
  | 'insecure'
  | 'unsupported'
  | 'unknown';

export const CAMERA_ERROR_MESSAGE: Record<CameraError, { title: string; message: string }> = {
  denied: {
    title: 'Permissão da câmera negada',
    message: 'Libere a câmera nas configurações do navegador para este site e tente de novo. Enquanto isso, você pode enviar uma foto.',
  },
  'not-found': {
    title: 'Nenhuma câmera encontrada',
    message: 'Este aparelho não tem câmera disponível. Envie uma foto da galeria.',
  },
  'in-use': {
    title: 'A câmera está ocupada',
    message: 'Outro aplicativo parece estar usando a câmera. Feche-o e tente de novo.',
  },
  insecure: {
    title: 'A câmera exige conexão segura',
    message: 'Navegadores só liberam a câmera em HTTPS. Abra o site por um endereço https:// ou envie uma foto.',
  },
  unsupported: {
    title: 'Câmera não suportada',
    message: 'Este navegador não permite acessar a câmera. Envie uma foto da galeria.',
  },
  unknown: {
    title: 'Não foi possível abrir a câmera',
    message: 'Tente de novo ou envie uma foto.',
  },
};

export function classifyCameraError(error: unknown): CameraError {
  const name = (error as DOMException | undefined)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found';
  if (name === 'NotReadableError' || name === 'AbortError') return 'in-use';
  return 'unknown';
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<CameraError | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [canSwitch, setCanSwitch] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  const start = useCallback(
    async (mode: 'environment' | 'user' = facing) => {
      if (!window.isSecureContext) {
        setError('insecure');
        setStatus('error');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('unsupported');
        setStatus('error');
        return;
      }
      setStatus('requesting');
      setError(null);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        });
        streamRef.current = stream;
        setFacing(mode);
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setStatus('live');
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch (cause) {
        setError(classifyCameraError(cause));
        setStatus('error');
      }
    },
    [facing],
  );

  const flip = useCallback(() => start(facing === 'environment' ? 'user' : 'environment'), [facing, start]);

  // A câmera deve desligar ao sair da tela e ao esconder o aplicativo.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && streamRef.current) stop();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [stop]);

  return { videoRef, status, error, facing, canSwitch, start, stop, flip };
}
