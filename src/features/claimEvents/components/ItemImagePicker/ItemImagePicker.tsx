'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Picture } from '@/components/atoms/Picture';
import { Text } from '@/components/atoms/Text';
import { claimEventsContent } from '../../content/es-MX';
import { toItemWebp } from '../../services/image.client';
import { checkItemImageInput } from '../../utils/image';
import styles from './ItemImagePicker.module.css';

const c = claimEventsContent.items;

type Props = {
  /** Imagen ya guardada (URL pública), si existe. */
  currentUrl: string | null;
  aspect: { width: number; height: number };
  alt: string;
  /** Recibe el WebP listo para subir, o null si se descartó. */
  onChange: (blob: Blob | null) => void;
  /** Código de error de la subida (servidor). */
  serverError?: string;
  uploading: boolean;
};

/** Elige una imagen, la convierte a WebP (≤ 1600 px, ≤ 5 MB) en el navegador y muestra la vista previa. */
export function ItemImagePicker({
  currentUrl,
  aspect,
  alt,
  onChange,
  serverError,
  uploading,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLocalError(null);
    const problem = checkItemImageInput(file);
    if (problem) return setLocalError(`image_${problem}`);
    setProcessing(true);
    const blob = await toItemWebp(file);
    setProcessing(false);
    if (!blob) {
      setLocalError('image_size');
      return onChange(null);
    }
    setPreview(URL.createObjectURL(blob));
    onChange(blob);
  };

  const code = localError ?? serverError;
  const shown = preview ?? currentUrl;
  const busy = processing || uploading;

  return (
    <div className={styles.root}>
      <div className={styles.thumb}>
        <Picture src={shown} alt={shown ? alt : ''} aspect={aspect} placeholder={c.image} />
      </div>
      <div className={styles.side}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.file}
          onChange={onFile}
          aria-label={c.image}
          data-testid="item-image-input"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={busy}
          onClick={() => inputRef.current?.click()}
        >
          {processing
            ? c.imageProcessing
            : uploading
              ? c.imageUploading
              : shown
                ? c.imageReplace
                : c.imageChoose}
        </Button>
        <Text size="sm" tone="muted">
          {c.imageHint}
        </Text>
        <div aria-live="polite">
          {code ? (
            <Text size="sm" tone="danger" role="alert">
              {claimEventsContent.errors[code] ?? claimEventsContent.errors.unknown}
            </Text>
          ) : null}
        </div>
      </div>
    </div>
  );
}
