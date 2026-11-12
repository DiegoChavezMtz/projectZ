import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ClaimSession } from '@/types/claims';
import { AppError } from '@/utils/errors';

export type ClaimSummary = {
  /** Claim en vivo o, si no hay, el próximo programado. */
  active: (ClaimSession & { item_count: number }) | null;
  /** Intentos en cola o pendientes de «tuyo» en el claim en vivo (0 si no hay). */
  pendingToConfirm: number;
};

export const claimSummaryService = {
  async get(sellerId: string): Promise<ClaimSummary> {
    const supabase = await createClient();
    const live = await supabase
      .from('claim_sessions')
      .select('*, claim_items(count)')
      .eq('seller_id', sellerId)
      .eq('status', 'live')
      .order('starts_at', { ascending: false })
      .limit(1);
    if (live.error) throw new AppError('list_failed', 'No se pudo cargar el resumen', live.error);

    let row = live.data[0];
    if (!row) {
      const next = await supabase
        .from('claim_sessions')
        .select('*, claim_items(count)')
        .eq('seller_id', sellerId)
        .eq('status', 'scheduled')
        .order('starts_at', { ascending: true })
        .limit(1);
      if (next.error) throw new AppError('list_failed', 'No se pudo cargar el resumen', next.error);
      row = next.data[0];
    }
    if (!row) return { active: null, pendingToConfirm: 0 };

    const { claim_items, ...session } = row;
    let pendingToConfirm = 0;
    if (session.status === 'live') {
      const { count, error } = await supabase
        .from('claim_entries')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .in('status', ['queued', 'pending']);
      if (error) throw new AppError('list_failed', 'No se pudo cargar el resumen', error);
      pendingToConfirm = count ?? 0;
    }
    return { active: { ...session, item_count: claim_items[0]?.count ?? 0 }, pendingToConfirm };
  },
};
