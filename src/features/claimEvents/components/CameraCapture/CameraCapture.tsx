'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { scannerContent, type ItemLabels } from '../../content/scanner';
import { useCamera } from '../../hooks/useCamera';
import { useFitGuide } from '../../hooks/useFitGuide';
import type { FrameDetection } from '../../services/scanner/scannerImage';
import { checkItemImageInput } from '../../utils/image';
import styles from './CameraCapture.module.css';

const c = scannerContent.camera;

type Props = {
  aspect: { width: number; height: number };
  labels: ItemLabels;
  /** Mientras hay un recorte o un panel abierto no se acepta otra captura. */
  disabled?: boolean;
  /** Recibe cada foto, venga de la cámara o de un archivo. */
  onCapture: (photo: Blob) => void;
  /** Analiza cuadros del video para orientar el encuadre en vivo (opcional). */
  detectFrame?: (frame: ImageBitmap) => Promise<FrameDetection | null>;
};

/** Vista de captura: cámara trasera con guía de encuadre, disparo grande y alternativa de archivo. */
export function CameraCapture({ aspect, labels, disabled = false, onCapture, detectFrame }: Props) {
  const {
    videoRef,
    status,
    canSwitch,
    torchSupported,
    torchOn,
    start,
    switchCamera,
    toggleTorch,
    capture,
  } = useCamera();
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLButtonElement>(null);
  const fit = useFitGuide({
    videoRef,
    viewportRef,
    guideRef,
    detect: detectFrame,
    active: status === 'ready' && !disabled,
  });
  const [flash, setFlash] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'idle') void start();
  }, [start, status]);

  const shoot = useCallback(async () => {
    if (disabled || status !== 'ready') return;
    const photo = await capture();
    if (!photo) return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 140);
    onCapture(photo);
  }, [capture, disabled, onCapture, status]);

  // Barra espaciadora = disparo, salvo que el foco esté en un control que ya la usa.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName)) return;
      if (target?.closest('[role="dialog"]')) return;
      event.preventDefault();
      void shoot();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shoot]);

  const onFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setFileError(null);
    for (const file of files) {
      if (checkItemImageInput(file)) setFileError(c.badFile);
      else onCapture(file);
    }
  };

  const unavailable = status === 'denied' || status === 'unsupported' || status === 'error';
  const message =
    status === 'denied'
      ? c.denied
      : status === 'unsupported'
        ? c.unsupported
        : status === 'error'
          ? c.failed
          : null;

  return (
    <section className={styles.root} aria-label={scannerContent.pageTitle}>
      <div ref={viewportRef} className={styles.viewport}>
        <video
          ref={videoRef}
          className={clsx(styles.video, unavailable && styles.hidden)}
          playsInline
          muted
          aria-hidden="true"
        />
        {status === 'starting' ? <Text className={styles.overlayText}>{c.starting}</Text> : null}
        {unavailable ? (
          <div className={styles.fallback}>
            <Text>{message}</Text>
            <Text size="sm" tone="muted">
              {c.pickFilesNote}
            </Text>
          </div>
        ) : (
          <button
            ref={guideRef}
            type="button"
            data-fit={fit}
            className={clsx(styles.guide, flash && styles.flash)}
            style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}
            onClick={() => void shoot()}
            disabled={disabled || status !== 'ready'}
            aria-label={`${c.shoot}. ${c.guide(labels)}`}
          />
        )}
      </div>

      <div className={styles.controls}>
        {status === 'ready' ? (
          <>
            <Text
              size="sm"
              className={styles.hint}
              role="status"
              aria-live="polite"
              data-testid="fit-hint"
            >
              {detectFrame ? (c.fit[fit] ?? c.guide(labels)) : c.guide(labels)}
            </Text>
            <Text size="sm" tone="muted" className={styles.hint}>
              {c.shootHint}
            </Text>
            <div className={styles.row}>
              {canSwitch ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void switchCamera()}
                >
                  {c.switchCamera}
                </Button>
              ) : null}
              <button
                type="button"
                className={styles.shutter}
                onClick={() => void shoot()}
                disabled={disabled}
                aria-label={c.shoot}
              />
              {torchSupported ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void toggleTorch()}
                  aria-pressed={torchOn}
                >
                  {torchOn ? c.torchOff : c.torchOn}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
        <div className={styles.row}>
          {unavailable && status !== 'unsupported' ? (
            <Button type="button" variant="secondary" onClick={() => void start()}>
              {c.retry}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={unavailable ? 'primary' : 'ghost'}
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {c.pickFiles}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            data-testid="scanner-file-input"
            onChange={onFiles}
          />
        </div>
        {fileError ? (
          <Text tone="danger" role="alert" size="sm">
            {fileError}
          </Text>
        ) : null}
      </div>
    </section>
  );
}
