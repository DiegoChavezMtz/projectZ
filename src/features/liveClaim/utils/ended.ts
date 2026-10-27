import type { ClaimItem } from '@/types/claims';

export type EndedSummary = {
  sold: Array<{
    id: string;
    title: string;
    priceCents: number;
    buyerName: string | null;
    imagePath: string | null;
  }>;
  unsold: Array<{ id: string; title: string; priceCents: number; imagePath: string | null }>;
};

/**
 * Resumen público de un evento terminado. El precio es el publicado (una oferta aceptada puede haber sido menor y no es público). Solo se arman campos ya públicos: nombre del comprador
 * (el que ve cualquiera en el feed), nunca su id ni datos de pago o contacto.
 */
export function summarizeEnded(items: ClaimItem[]): EndedSummary {
  const sold: EndedSummary['sold'] = [];
  const unsold: EndedSummary['unsold'] = [];
  for (const item of items) {
    if (item.status === 'sold') {
      sold.push({
        id: item.id,
        title: item.title,
        priceCents: item.price_cents,
        buyerName: item.leader_display_name ?? item.leader_handle,
        imagePath: item.image_path,
      });
    } else if (item.status === 'available') {
      unsold.push({
        id: item.id,
        title: item.title,
        priceCents: item.price_cents,
        imagePath: item.image_path,
      });
    }
  }
  return { sold, unsold };
}
