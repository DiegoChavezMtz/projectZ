import type { ClaimItem, ClaimSession } from '@/types/claims';

/** Estado serializable que devuelven las Server Actions a `useActionState`. */
export type ActionState = {
  status: 'idle' | 'error' | 'success';
  /** Código estable de error (mapeable a texto de UI). */
  code?: string;
  /** Errores por campo. */
  fieldErrors?: Partial<Record<string, string>>;
  /** Motivos por los que un evento no se puede publicar (`publish_session`). */
  reasons?: string[];
  /** Código público (`/c/[code]`) tras publicar. */
  publicCode?: string;
};

export const initialActionState: ActionState = { status: 'idle' };

/** Motivos que devuelve `publish_session` y que `canPublish` replica en el cliente. */
export type PublishReason =
  'no_items' | 'items_missing_image' | 'items_missing_price' | 'starts_at_not_future';

export type SessionListItem = ClaimSession & { item_count: number };
export type SessionWithItems = ClaimSession & { items: ClaimItem[] };

/** Filtros de la lista del vendedor. */
export type SessionListFilter = 'all' | ClaimSession['status'];
