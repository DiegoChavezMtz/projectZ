import clsx from 'clsx';
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Checkbox.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  label: ReactNode;
  hint?: string;
};

/** Casilla con etiqueta y ayuda opcional; el área completa es objetivo táctil ≥ 44 px. */
export function Checkbox({ label, hint, className, id, ...rest }: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className={clsx(styles.root, className)}>
      <label className={styles.label} htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          className={styles.box}
          aria-describedby={hintId}
          {...rest}
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
