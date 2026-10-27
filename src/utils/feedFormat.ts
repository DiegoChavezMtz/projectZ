import type { SessionFeedEvent } from '@/types/claims';
import { formatDateTime } from '@/utils/dates';

export type FeedLabels = {
  /** "carta" / "cartas" según la categoría. */
  noun: { singular: string; plural: string };
  texts: {
    sessionStarted: string;
    sessionEnded: string;
    released: (title: string) => string;
    releasedMany: (count: number, noun: string) => string;
    claimed: (actor: string, title: string) => string;
    offer: (actor: string, title: string) => string;
    sold: (actor: string, title: string) => string;
    withdrawn: (title: string) => string;
    rejected: (title: string) => string;
    featured: (title: string) => string;
    extended: (when: string) => string;
    someone: string;
    item: string;
  };
};

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

/** Texto legible de un evento del feed. Nunca muestra montos ni datos privados. */
export function formatFeedEvent(event: SessionFeedEvent, labels: FeedLabels): string {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const t = labels.texts;
  const title = str(payload.item_title) ?? t.item;
  const actor = event.actor_display_name?.trim() || t.someone;

  switch (event.type) {
    case 'session_started':
      return t.sessionStarted;
    case 'session_ended':
      return t.sessionEnded;
    case 'item_released': {
      const count = typeof payload.count === 'number' ? payload.count : null;
      return count !== null
        ? t.releasedMany(count, count === 1 ? labels.noun.singular : labels.noun.plural)
        : t.released(title);
    }
    case 'item_claimed':
      return t.claimed(actor, title);
    case 'item_offer':
      return t.offer(actor, title);
    case 'item_sold':
      return t.sold(actor, title);
    case 'item_withdrawn':
      return t.withdrawn(title);
    case 'entry_rejected':
      return t.rejected(title);
    case 'item_featured':
      return t.featured(title);
    case 'announcement':
      return str(payload.text) ?? '';
    case 'session_extended': {
      const closesAt = str(payload.closes_at);
      return t.extended(closesAt ? formatDateTime(closesAt) : '');
    }
  }
}
