'use client';

import clsx from 'clsx';
import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { common } from '@/content/es-MX';
import styles from './CodeInput.module.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Se llama una vez cuando se completan todas las casillas (teclado o pegado). */
  onComplete?: (value: string) => void;
  length?: number;
  /** Nombre del campo oculto que viaja en el formulario. */
  name?: string;
  label?: string;
  disabled?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
  autoFocus?: boolean;
};

const onlyDigits = (text: string) => text.replace(/\D/g, '');

/** N casillas numéricas: autoavance, retroceso, flechas y pegado del código completo. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  name,
  label = common.codeInput.group,
  disabled = false,
  invalid = false,
  autoFocus = false,
  'aria-describedby': describedBy,
}: Props) {
  const labelId = useId();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const focusAt = (index: number) => {
    const target = refs.current[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select();
  };

  const commit = (next: string, focusIndex: number) => {
    const clean = next.slice(0, length);
    onChange(clean);
    if (clean.length === length) {
      refs.current[length - 1]?.blur();
      onComplete?.(clean);
    } else {
      focusAt(focusIndex);
    }
  };

  // Escribe `incoming` a partir de `index` (un dígito tecleado o varios pegados). El valor es una cadena contigua.
  const write = (index: number, incoming: string) => {
    const clean = onlyDigits(incoming);
    if (!clean) return;
    const next = [...digits];
    [...clean].forEach((ch, i) => {
      if (index + i < length) next[index + i] = ch;
    });
    commit(next.join(''), index + clean.length);
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Backspace': {
        event.preventDefault();
        if (digits[index]) {
          onChange(digits.map((d, i) => (i === index ? '' : d)).join(''));
        } else if (index > 0) {
          onChange(digits.map((d, i) => (i === index - 1 ? '' : d)).join(''));
          focusAt(index - 1);
        }
        break;
      }
      case 'ArrowLeft':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        focusAt(index + 1);
        break;
    }
  };

  const onPaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = onlyDigits(event.clipboardData.getData('text'));
    if (!pasted) return;
    // Un código completo reemplaza todo; uno parcial se escribe desde la casilla actual.
    if (pasted.length >= length) commit(pasted, length - 1);
    else write(index, pasted);
  };

  return (
    <div role="group" aria-labelledby={labelId} className={styles.root}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={styles.cells}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className={clsx(styles.cell)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            value={digit}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-label={common.codeInput.digit(index + 1, length)}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onFocus={(event) => event.target.select()}
            onChange={(event) => write(index, event.target.value)}
            onKeyDown={onKeyDown(index)}
            onPaste={onPaste(index)}
          />
        ))}
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
