'use client';

import { useRef } from 'react';
import { Text } from '@/components/atoms/Text';
import { scannerContent } from '../../content/scanner';
import type { Quad } from '../../utils/scanner/types';
import styles from './CropAdjuster.module.css';

const c = scannerContent.crop;
const STEP = 0.005; // 0.5 % de la foto por pulsación de flecha

type Props = {
  imageUrl: string;
  /** Proporción ancho/alto de la foto original, para que el marco no deforme las coordenadas. */
  imageAspect: number;
  /** Esquinas normalizadas (0 a 1): sup. izq., sup. der., inf. der., inf. izq. */
  corners: Quad;
  onChange: (corners: Quad) => void;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Ajuste manual de las cuatro esquinas: arrastre con puntero o flechas del teclado en cada punto. */
export function CropAdjuster({ imageUrl, imageAspect, corners, onChange }: Props) {
  const frame = useRef<HTMLDivElement>(null);

  const move = (index: number, x: number, y: number) => {
    onChange(corners.map((p, i) => (i === index ? { x: clamp(x), y: clamp(y) } : p)) as Quad);
  };

  const onPointerMove = (index: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    move(index, (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
  };

  const onKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const point = corners[index];
    if (!point) return;
    const delta = (
      {
        ArrowLeft: [-STEP, 0],
        ArrowRight: [STEP, 0],
        ArrowUp: [0, -STEP],
        ArrowDown: [0, STEP],
      } as Record<string, number[]>
    )[event.key];
    if (!delta) return;
    event.preventDefault();
    move(index, point.x + (delta[0] ?? 0), point.y + (delta[1] ?? 0));
  };

  return (
    <div className={styles.root}>
      <div ref={frame} className={styles.frame} style={{ aspectRatio: String(imageAspect) }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- foto local (URL de objeto), no optimizable por next/image. */}
        <img className={styles.image} src={imageUrl} alt="" />
        <svg
          className={styles.outline}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon points={corners.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} />
        </svg>
        {corners.map((point, index) => (
          <button
            key={index}
            type="button"
            className={styles.handle}
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            aria-label={c.handle(index + 1)}
            onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
            onPointerMove={onPointerMove(index)}
            onKeyDown={onKeyDown(index)}
          />
        ))}
      </div>
      <Text size="sm" tone="muted">
        {c.moveHint}
      </Text>
    </div>
  );
}
