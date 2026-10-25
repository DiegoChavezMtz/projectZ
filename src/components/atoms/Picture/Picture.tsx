import clsx from 'clsx';
import styles from './Picture.module.css';

type Props = {
  src?: string | null;
  alt: string;
  /** Relación de aspecto ancho:alto (TCG: 63:88). */
  aspect: { width: number; height: number };
  className?: string;
  /** Texto del recuadro cuando aún no hay imagen. */
  placeholder?: string;
};

/** Imagen de artículo con relación de aspecto fija (evita saltos de layout). */
export function Picture({ src, alt, aspect, className, placeholder }: Props) {
  return (
    <div
      className={clsx(styles.root, className)}
      style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- WebP ya optimizado (≤ 1600 px) en el bucket público o blob local.
        <img className={styles.image} src={src} alt={alt} loading="lazy" decoding="async" />
      ) : placeholder ? (
        <span className={styles.placeholder}>{placeholder}</span>
      ) : null}
    </div>
  );
}
