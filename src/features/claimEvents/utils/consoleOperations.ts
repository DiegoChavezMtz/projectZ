import type { ClaimItem } from '@/types/claims';
import type {
  BuyerInfo,
  ConsoleEntry,
  ConsoleSummary,
  ConsoleWin,
  ItemOperation,
  QueueRow,
} from '../types';

const OPEN_STATUSES: ConsoleEntry['status'][] = ['queued', 'pending'];

function toRow(
  entry: ConsoleEntry,
  buyers: Record<string, BuyerInfo>,
  leaderEntryId: string | null,
): QueueRow {
  const buyer = buyers[entry.buyer_id];
  return {
    entry,
    buyerName: buyer?.name ?? '',
    memberSince: buyer?.memberSince ?? null,
    badge: buyer?.badge ?? null,
    isLeader: entry.id === leaderEntryId,
  };
}

/**
 * Cola y ofertas de cada artículo. El orden es `seq`, que asigna el servidor: la consola nunca
 * reordena por otra cosa. Las ofertas van de mayor a menor monto.
 */
export function buildOperations(
  items: ClaimItem[],
  entries: ConsoleEntry[],
  buyers: Record<string, BuyerInfo>,
): ItemOperation[] {
  const open = entries.filter((entry) => OPEN_STATUSES.includes(entry.status));
  return items.map((item) => {
    const own = open.filter((entry) => entry.item_id === item.id);
    const queue = own
      .filter((entry) => entry.kind === 'claim')
      .sort((a, b) => a.seq - b.seq)
      .map((entry, index) =>
        toRow(entry, buyers, item.leader_entry_id ?? (index === 0 ? entry.id : null)),
      );
    const offers = own
      .filter((entry) => entry.kind === 'offer')
      .sort((a, b) => b.amount_cents - a.amount_cents || a.seq - b.seq)
      .map((entry) => toRow(entry, buyers, null));
    const won = entries.find((entry) => entry.item_id === item.id && entry.status === 'accepted');
    return { item, queue, offers, winner: won ? toRow(won, buyers, null) : null };
  });
}

/** Siguiente artículo oculto por orden de posición: la sugerencia de "liberar". */
export function nextHiddenItem(items: ClaimItem[]): ClaimItem | null {
  return (
    [...items].sort((a, b) => a.position - b.position).find((item) => item.status === 'hidden') ??
    null
  );
}

export const countHidden = (items: ClaimItem[]) =>
  items.filter((item) => item.status === 'hidden').length;

/**
 * Resumen al terminar el evento: vendidos y compradores salen de `claim_wins`; "sin vender" son los
 * artículos que no se vendieron ni se retiraron.
 */
export function buildSummary(
  items: ClaimItem[],
  wins: ConsoleWin[],
  buyers: Record<string, BuyerInfo>,
): ConsoleSummary {
  const byBuyer = new Map<string, { winsCount: number; totalCents: number }>();
  for (const win of wins) {
    const acc = byBuyer.get(win.buyer_id) ?? { winsCount: 0, totalCents: 0 };
    acc.winsCount += 1;
    acc.totalCents += win.price_cents;
    byBuyer.set(win.buyer_id, acc);
  }
  return {
    soldCount: wins.length,
    unsoldCount: items.filter((item) => item.status !== 'sold' && item.status !== 'withdrawn')
      .length,
    withdrawnCount: items.filter((item) => item.status === 'withdrawn').length,
    revenueCents: wins.reduce((total, win) => total + win.price_cents, 0),
    buyers: [...byBuyer.entries()]
      .map(([buyerId, value]) => ({ buyerId, name: buyers[buyerId]?.name ?? '', ...value }))
      .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, 'es-MX')),
  };
}

/** Años o meses de antigüedad de la cuenta, en palabras cortas ("3 meses", "2 años"). */
export function memberSinceLabel(memberSince: string | null, now: number = Date.now()): string {
  if (!memberSince) return '';
  const days = Math.max(0, Math.floor((now - Date.parse(memberSince)) / 86_400_000));
  if (days < 30) return days <= 1 ? 'Cuenta nueva' : `${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 mes' : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 año' : `${years} años`;
}
