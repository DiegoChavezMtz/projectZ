import type { SVGAttributes } from 'react';

type Props = SVGAttributes<SVGSVGElement> & { title?: string };

/** Marca Zlotify (Z naranja sobre tinta, punto rosa). Decorativa salvo que se pase `title`. */
export function BrandMark({ title, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={34}
      height={34}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      <rect width="48" height="48" rx="14" fill="var(--zl-color-ink)" />
      <path d="M13 13h22v6L21 29h14v6H13v-6l14-10H13z" fill="var(--zl-color-orange)" />
      <circle cx="38" cy="10" r="4" fill="var(--zl-color-pink)" />
    </svg>
  );
}
