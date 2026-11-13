/** Claim abierto o próximo, tal como lo ve un visitante de la landing (solo datos públicos). */
export type OpenClaim = {
  id: string;
  /** Código para `/c/<code>`. */
  code: string;
  title: string;
  status: 'live' | 'scheduled';
  /** ISO UTC. */
  startsAt: string;
  /** Nombre público del espacio del vendedor. */
  shopName: string;
  /** Para `/u/<handle>`; null si el vendedor aún no tiene handle público. */
  handle: string | null;
  itemCount: number;
  /** Hasta 4 fotos de muestra (rutas del bucket `item-images`). */
  photos: string[];
};
