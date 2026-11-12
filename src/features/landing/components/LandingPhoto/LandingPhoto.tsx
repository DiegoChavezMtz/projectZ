import Image from 'next/image';

type Props = {
  src: string;
  sizes: string;
  priority?: boolean;
};

/** Foto decorativa de la landing dentro de un `PieceFrame` (`media`): optimizada por `next/image`. */
export function LandingPhoto({ src, sizes, priority = false }: Props) {
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      preload={priority}
      loading={priority ? 'eager' : undefined}
    />
  );
}
