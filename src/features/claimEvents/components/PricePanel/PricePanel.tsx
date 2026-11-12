'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Picture } from '@/components/atoms/Picture';
import { Text } from '@/components/atoms/Text';
import { scannerContent } from '../../content/scanner';
import {
  applyKeypadKey,
  formatKeypadDisplay,
  keypadToCents,
  type KeypadKey,
} from '../../utils/scanner/price';
import { centsToPesosInput } from '@/utils/money';
import styles from './PricePanel.module.css';

const c = scannerContent.price;

const KEYS: { key: KeypadKey; label: string; aria?: string }[] = [
  ...(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((k) => ({ key: k, label: k })),
  { key: 'dot', label: '.', aria: c.dot },
  { key: '0', label: '0' },
  { key: 'back', label: '⌫', aria: c.backspace },
];

type Props = {
  cropUrl: string;
  aspect: { width: number; height: number };
  /** Precio ya guardado (al repetir la foto de un artículo existente). */
  initialCents?: number | null;
  /** En un evento publicado no se puede omitir el precio. */
  canSkip: boolean;
  /** La región recortada tiene poca resolución: se avisa, sin bloquear. */
  lowResolution?: boolean;
  onDone: (priceCents: number | null) => void;
  onAdjust: () => void;
  onRepeat: () => void;
};

/** Panel posterior a cada captura: recorte visible, teclado numérico para el precio y "Listo". */
export function PricePanel({
  cropUrl,
  aspect,
  initialCents,
  canSkip,
  lowResolution = false,
  onDone,
  onAdjust,
  onRepeat,
}: Props) {
  const [value, setValue] = useState(
    initialCents ? centsToPesosInput(initialCents).replace(/\.00$/, '') : '',
  );
  const [showError, setShowError] = useState(false);

  const press = (key: KeypadKey) => {
    setShowError(false);
    setValue((current) => applyKeypadKey(current, key));
  };

  const submit = () => {
    const cents = keypadToCents(value);
    if (cents === null && !canSkip) return setShowError(true);
    onDone(cents);
  };

  // Teclado físico (escritorio): dígitos, punto, borrar y Enter.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (/^[0-9]$/.test(event.key)) press(event.key as KeypadKey);
      else if (event.key === '.') press('dot');
      else if (event.key === 'Backspace') press('back');
      else if (event.key === 'Enter' && target?.tagName !== 'BUTTON') submit();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // `submit` depende de `value`; se vuelve a registrar con cada cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, canSkip]);

  const display = formatKeypadDisplay(value);

  return (
    <section className={styles.root} aria-label={c.title}>
      <Picture className={styles.crop} aspect={aspect} src={cropUrl} alt={c.cropAlt} priority />
      <div className={styles.side}>
        <p
          className={styles.display}
          role="status"
          aria-live="polite"
          aria-label={c.display(display)}
          data-testid="price-display"
        >
          {display}
        </p>
        {lowResolution ? (
          <Text size="sm" role="status">
            {scannerContent.camera.lowResolution}
          </Text>
        ) : null}
        {showError ? (
          <Text tone="danger" role="alert" size="sm">
            {c.needsPrice}
          </Text>
        ) : null}
        <div className={styles.keypad} role="group" aria-label={c.keypad}>
          {KEYS.map(({ key, label, aria }) => (
            <button
              key={key}
              type="button"
              className={styles.key}
              aria-label={aria}
              onClick={() => press(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <Button type="button" size="lg" fullWidth onClick={submit}>
          {c.done}
        </Button>
        <div className={styles.secondary}>
          {canSkip ? (
            <Button type="button" variant="secondary" onClick={() => onDone(null)}>
              {c.skip}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onAdjust}>
            {scannerContent.crop.adjust}
          </Button>
          <Button type="button" variant="ghost" onClick={onRepeat}>
            {c.repeat}
          </Button>
        </div>
        {canSkip ? (
          <Text size="sm" tone="muted">
            {c.skipHint}
          </Text>
        ) : null}
      </div>
    </section>
  );
}
