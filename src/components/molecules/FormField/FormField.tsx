import { useId, type ReactNode } from 'react';
import { Label } from '../../atoms/Label';
import { Text } from '../../atoms/Text';
import styles from './FormField.module.css';

export type FieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  invalid: boolean;
};

type Props = {
  label: string;
  hint?: string;
  error?: string;
  /** Recibe los props de accesibilidad para pasarlos al `Input`/`Textarea`. */
  children: (control: FieldControlProps) => ReactNode;
};

export function FormField({ label, hint, error, children }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.root}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-describedby': describedBy, invalid: Boolean(error) })}
      {hint ? (
        <Text id={hintId} size="sm" tone="muted">
          {hint}
        </Text>
      ) : null}
      {error ? (
        <Text id={errorId} size="sm" tone="danger" role="alert">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
