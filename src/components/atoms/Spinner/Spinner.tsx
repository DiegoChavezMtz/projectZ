import { common } from '@/content/es-MX';
import { VisuallyHidden } from '../VisuallyHidden';
import styles from './Spinner.module.css';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  /** Texto para lectores de pantalla. */
  label?: string;
  /** Si es true no se anuncia (el padre ya comunica el estado, p. ej. `aria-busy`). */
  decorative?: boolean;
};

export function Spinner({ size = 'md', label = common.a11y.loading, decorative = false }: Props) {
  const circle = (
    <svg
      className={`${styles.svg} ${styles[size]}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className={styles.track} cx="12" cy="12" r="9" strokeWidth="3" />
      <path className={styles.arc} d="M21 12a9 9 0 0 0-9-9" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (decorative) return circle;
  return (
    <span role="status" className={styles.root}>
      {circle}
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}
