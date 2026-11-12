import { reputationBadgeService } from '@/services/reputation.service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { AppError } from '@/utils/errors';
import type { BuyerInfo, ConsoleEntry } from '../types';

type Client = SupabaseClient<Database>;

export const CONSOLE_FEED_LIMIT = 50;

export const ENTRY_COLUMNS =
  'id, item_id, session_id, buyer_id, kind, amount_cents, status, seq, created_at, resolved_at';

/** Todos los intentos del evento (RLS: el dueño los lee todos). */
export async function queryEntries(supabase: Client, sessionId: string): Promise<ConsoleEntry[]> {
  const { data, error } = await supabase
    .from('claim_entries')
    .select(ENTRY_COLUMNS)
    .eq('session_id', sessionId)
    .order('seq');
  if (error) throw new AppError('load_failed', 'No se pudieron cargar los intentos', error);
  return data;
}

/** Nombre público, antigüedad e insignia de reputación de los compradores (dos consultas por tanda). */
export async function queryBuyers(supabase: Client, buyerIds: string[]): Promise<BuyerInfo[]> {
  const ids = [...new Set(buyerIds)];
  if (ids.length === 0) return [];
  const [{ data, error }, badges] = await Promise.all([
    supabase.from('public_profiles').select('id, handle, display_name, created_at').in('id', ids),
    reputationBadgeService.forUsers(supabase, ids, { asRole: 'buyer' }),
  ]);
  if (error) throw new AppError('load_failed', 'No se pudo cargar a los compradores', error);
  return data.flatMap((row) =>
    row.id && row.created_at
      ? [
          {
            id: row.id,
            name: row.display_name ?? row.handle ?? '',
            memberSince: row.created_at,
            badge: badges.get(row.id) ?? null,
          },
        ]
      : [],
  );
}
