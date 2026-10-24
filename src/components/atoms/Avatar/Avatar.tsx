import clsx from 'clsx';
import styles from './Avatar.module.css';

type Props = {
  /** URL de la foto; sin ella se muestran las iniciales. */
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

export function Avatar({ src, name, size = 'md', className }: Props) {
  return (
    <span className={clsx(styles.root, styles[size], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- WebP de 512 px ya optimizado en el bucket público.
        <img className={styles.image} src={src} alt={name} loading="lazy" decoding="async" />
      ) : (
        <span className={styles.initials} aria-hidden="true">
          {initials(name) || '?'}
        </span>
      )}
      {!src ? <span className={styles.hidden}>{name}</span> : null}
    </span>
  );
}
