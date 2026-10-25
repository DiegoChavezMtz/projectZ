import type { ClaimItem, ClaimSession, SessionStatus } from '@/types/claims';
import type { PublishReason } from '../types';

/** Mientras el evento no empieza se pueden editar sus datos y artículos (docs/spec/claims.md). */
export const isSessionEditable = (status: SessionStatus): boolean =>
  status === 'draft' || status === 'scheduled';

/** Reglas, plazos y modo de liberación se bloquean al publicar. */
export const areRulesLocked = (status: SessionStatus): boolean => status !== 'draft';

export const isItemComplete = (item: Pick<ClaimItem, 'title' | 'price_cents' | 'image_path'>) =>
  item.title.trim().length > 0 && item.price_cents > 0 && Boolean(item.image_path);

/**
 * Replica `publish_session` (migración 07/08): ≥ 1 artículo, todos con imagen y precio,
 * `starts_at` futuro. Devuelve los motivos con los mismos códigos que la RPC.
 */
export function canPublish(
  session: Pick<ClaimSession, 'status' | 'starts_at'>,
  items: Pick<ClaimItem, 'price_cents' | 'image_path'>[],
  now: Date = new Date(),
): { ok: boolean; reasons: PublishReason[] } {
  const reasons: PublishReason[] = [];
  if (session.status !== 'draft') return { ok: false, reasons };
  if (items.length === 0) reasons.push('no_items');
  if (items.some((item) => !item.image_path)) reasons.push('items_missing_image');
  if (items.some((item) => item.price_cents <= 0)) reasons.push('items_missing_price');
  if (new Date(session.starts_at).getTime() <= now.getTime()) reasons.push('starts_at_not_future');
  return { ok: reasons.length === 0, reasons };
}

/** Mueve un elemento de `from` a `to` y devuelve la lista nueva (no muta). */
export function reorderItems<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);
  return next;
}

/** URL pública de un evento publicado. */
export const publicSessionPath = (code: string) => `/c/${code}`;
