import type { ClaimItem } from '@/types/claims';
import type { ItemFilter, ViewerEntry } from '../types';
import { publicItemState } from './itemState';

/** Minúsculas y sin acentos, para buscar "pokémon" con "pokemon". */
export const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function filterItems(
  items: ClaimItem[],
  options: { filter: ItemFilter; query: string; entries: ViewerEntry[] },
): ClaimItem[] {
  const query = normalizeText(options.query);
  // "Mis intentos": los que siguen abiertos o ganados; un intento retirado o rechazado ya no cuenta.
  const mine = new Set(
    options.entries
      .filter((entry) => ['queued', 'pending', 'accepted'].includes(entry.status))
      .map((entry) => entry.item_id),
  );
  return items.filter((item) => {
    if (query && !normalizeText(item.title).includes(query)) return false;
    const state = publicItemState(item);
    switch (options.filter) {
      case 'all':
        return true;
      case 'available':
        return state === 'available' || state === 'claimed' || state === 'offers';
      case 'sold':
        return state === 'sold';
      case 'mine':
        return mine.has(item.id);
    }
  });
}
