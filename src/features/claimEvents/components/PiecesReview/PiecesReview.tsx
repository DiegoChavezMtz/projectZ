'use client';

import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { scannerContent } from '../../content/scanner';
import type { MultiWarning } from '../../utils/scanner/multi';
import type { Quad } from '../../utils/scanner/types';
import { CropAdjuster } from '../CropAdjuster';
import styles from './PiecesReview.module.css';

const c = scannerContent.multi;

export type ReviewPiece = { id: string; corners: Quad; valid: boolean };

type Props = {
  imageUrl: string;
  imageAspect: number;
  pieces: readonly ReviewPiece[];
  warnings: readonly MultiWarning[];
  onCornersChange: (id: string, corners: Quad) => void;
  onRemove: (id: string) => void;
  /** Añade una pieza a mano y devuelve su id para seleccionarla. */
  onAdd: () => string | null;
  onRetake: () => void;
  onConfirm: () => void;
};

/**
 * Revisión de una foto con varias piezas: las detectadas van numeradas sobre la foto. Se puede quitar una falsa,
 * ajustar las esquinas de una (con el mismo ajuste que el modo de una pieza) o añadir una a mano. Una pieza
 * marcada "por revisar" debe ajustarse o quitarse antes de confirmar: nunca se recorta algo dudoso sin que se vea.
 */
export function PiecesReview({ imageUrl, imageAspect, pieces, warnings, onCornersChange, onRemove, onAdd, onRetake, onConfirm }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(pieces[0]?.id ?? null);
  const selected = pieces.find((p) => p.id === selectedId) ?? pieces[0] ?? null;
  const pending = pieces.filter((p) => !p.valid).length;
  const numberOf = (id: string) => pieces.findIndex((p) => p.id === id) + 1;

  return (
    <section className={styles.root} aria-labelledby="pieces-heading">
      <Heading level={2} size="lg" id="pieces-heading">
        {c.reviewTitle} ({c.count(pieces.length)})
      </Heading>
      <Text size="sm" tone="muted">
        {c.reviewIntro}
      </Text>
      {warnings.map((w) => (
        <Text key={w} size="sm" role="status">
          {c.warnings[w]}
        </Text>
      ))}

      {selected ? (
        <CropAdjuster
          key={selected.id}
          imageUrl={imageUrl}
          imageAspect={imageAspect}
          corners={selected.corners}
          onChange={(corners) => onCornersChange(selected.id, corners)}
          others={pieces
            .filter((p) => p.id !== selected.id)
            .map((p) => ({
              id: p.id,
              corners: p.corners,
              label: String(numberOf(p.id)),
              ariaLabel: c.selectPiece(numberOf(p.id)),
              invalid: !p.valid,
              onSelect: () => setSelectedId(p.id),
            }))}
        />
      ) : (
        <Text tone="muted">{c.none}</Text>
      )}

      <ol className={styles.list}>
        {pieces.map((piece, index) => (
          <li key={piece.id} className={styles.item} data-selected={piece.id === selected?.id || undefined} data-testid="piece-row">
            <button type="button" className={styles.pick} onClick={() => setSelectedId(piece.id)} aria-pressed={piece.id === selected?.id}>
              {c.piece(index + 1)}
            </button>
            {!piece.valid ? <Badge tone="warning">{c.toReview}</Badge> : null}
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedId(piece.id)}>
              {c.adjust}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`${c.remove} ${c.piece(index + 1)}`}
              onClick={() => {
                onRemove(piece.id);
                if (piece.id === selectedId) setSelectedId(null);
              }}
            >
              {c.remove}
            </Button>
          </li>
        ))}
      </ol>

      {pending > 0 ? (
        <Text size="sm" role="status">
          {c.mustReview}
        </Text>
      ) : null}

      <div className={styles.actions}>
        <Button type="button" onClick={onConfirm} disabled={pieces.length === 0 || pending > 0}>
          {c.confirm(pieces.length)}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setSelectedId(onAdd())}>
          {c.add}
        </Button>
        <Button type="button" variant="ghost" onClick={onRetake}>
          {c.retake}
        </Button>
      </div>
    </section>
  );
}
