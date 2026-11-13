'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unsupported' | 'error';
type Facing = 'environment' | 'user';

/** Un cuadro completamente negro (muestreado a 8×8) no es una foto: es un video pausado o sin pintar. */
function isBlankFrame(canvas: HTMLCanvasElement): boolean {
  try {
    const probe = document.createElement('canvas');
    probe.width = 8;
    probe.height = 8;
    const context = probe.getContext('2d');
    if (!context) return false;
    context.drawImage(canvas, 0, 0, 8, 8);
    const { data } = context.getImageData(0, 0, 8, 8);
    for (let i = 0; i < data.length; i += 4)
      if ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0) > 6) return false;
    return true;
  } catch {
    return false; // si no se puede leer, mejor entregar la foto que bloquearla
  }
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

/**
 * Cámara del modo escáner: pide permiso, prefiere la trasera, permite cambiar de cámara y encender la
 * linterna cuando el dispositivo lo ofrece, y libera los streams al desmontar. Sin API o sin permiso queda
 * en `unsupported` / `denied` y la vista ofrece elegir archivos con el mismo pipeline.
 */
export function useCamera(mediaDevices?: MediaDevices | undefined) {
  const devices =
    mediaDevices ?? (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>(
    devices?.getUserMedia ? 'idle' : 'unsupported',
  );
  const [facing, setFacing] = useState<Facing>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const start = useCallback(
    async (wanted: Facing = 'environment') => {
      if (!devices?.getUserMedia) return setStatus('unsupported');
      stop();
      setStatus('starting');
      try {
        const stream = await devices.getUserMedia({
          // La resolución más alta que dé el dispositivo (ideal 4K): el navegador baja solo si no la tiene.
          video: { facingMode: { ideal: wanted }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          // iOS Safari: reproducción en línea y sin sonido también como ATRIBUTOS (React solo fija la propiedad).
          video.muted = true;
          video.setAttribute('muted', '');
          video.setAttribute('playsinline', '');
          video.srcObject = stream;
          await video.play().catch(() => undefined);
          // Listo de verdad cuando ya hay cuadros con dimensiones (si no, el primer disparo saldría vacío).
          if (video.videoWidth === 0)
            await new Promise<void>((resolve) => {
              const done = () => resolve();
              video.addEventListener('loadedmetadata', done, { once: true });
              window.setTimeout(done, 3000);
            });
        }
        const track = stream.getVideoTracks()[0];
        const capabilities = (track?.getCapabilities?.() ?? {}) as TorchCapabilities;
        setTorchSupported(Boolean(capabilities.torch));
        setFacing(wanted);
        setStatus('ready');
        const list = await devices.enumerateDevices?.().catch(() => []);
        setCanSwitch((list ?? []).filter((d) => d.kind === 'videoinput').length > 1);
      } catch (error) {
        const name = (error as { name?: string } | null)?.name ?? '';
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
      }
    },
    [devices, stop],
  );

  useEffect(() => stop, [stop]);

  const switchCamera = useCallback(
    () => start(facing === 'environment' ? 'user' : 'environment'),
    [facing, start],
  );

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn, torchSupported]);

  /**
   * Retoma la cámara tras haber estado oculta o en segundo plano. Safari/iOS pausa el video (o termina las pistas)
   * cuando el elemento no se muestra o la app pasa a segundo plano: se vuelve a reproducir y, si la pista terminó,
   * se reabre la cámara.
   */
  const resume = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video) return;
    const track = stream?.getVideoTracks()[0];
    if (!stream || !track || track.readyState === 'ended' || !stream.active) return start(facing);
    if (video.paused || video.videoWidth === 0) {
      const played = await video.play().then(
        () => true,
        () => false,
      );
      if (!played) return start(facing);
    }
  }, [facing, start]);

  /** Congela el cuadro actual como JPEG (resolución completa del stream). `null` si no hay un cuadro utilizable. */
  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(video, 0, 0);
    if (isBlankFrame(canvas)) return null; // iOS entrega un cuadro negro si el video estaba pausado u oculto
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, []);

  return {
    videoRef,
    status,
    facing,
    canSwitch,
    torchSupported,
    torchOn,
    start,
    stop,
    switchCamera,
    toggleTorch,
    capture,
    resume,
  };
}
