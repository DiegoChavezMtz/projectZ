import { createClient } from '@/lib/supabase/client';
import type { ClaimItem, ClaimSession, SessionFeedEvent } from '@/types/claims';
import { AppError } from '@/utils/errors';
import { FEED_LIMIT, type ViewerEntry } from '../types';

// Lecturas desde el navegador (refetch tras reconexión, intentos propios, reloj). Todo pasa por RLS:
// un anónimo solo ve lo público y `claim_entries` solo devuelve los intentos del propio comprador.
export const liveDataClient = {
  async fetchState(
    sessionId: string,
  ): Promise<{ session: ClaimSession; items: ClaimItem[]; feed: SessionFeedEvent[] }> {
    const supabase = createClient();
    const [session, items, feed] = await Promise.all([
      supabase.from('claim_sessions').select('*').eq('id', sessionId).maybeSingle(),
      supabase.from('claim_items').select('*').eq('session_id', sessionId).order('position'),
      supabase
        .from('session_feed')
        .select('*')
        .eq('session_id', sessionId)
        .order('id', { ascending: false })
        .limit(FEED_LIMIT),
    ]);
    if (session.error || items.error || feed.error || !session.data)
      throw new AppError('load_failed', 'No se pudo actualizar el claim', session.error ?? items.error ?? feed.error);
    return { session: session.data, items: items.data, feed: [...feed.data].reverse() };
  },

  async fetchMyEntries(sessionId: string, userId: string): Promise<ViewerEntry[]> {
    const { data, error } = await createClient()
      .from('claim_entries')
      .select('id, item_id, kind, amount_cents, status, seq')
      .eq('session_id', sessionId)
      .eq('buyer_id', userId);
    if (error) throw new AppError('load_failed', 'No se pudieron cargar tus intentos', error);
    return data;
  },

  /** Hora del servidor con tiempos de ida y vuelta, para estimar `clockOffset`. */
  async sampleServerClock(): Promise<{ serverMs: number; sentAtMs: number; receivedAtMs: number }> {
    const sentAtMs = Date.now();
    const { data, error } = await createClient().rpc('server_now');
    const receivedAtMs = Date.now();
    if (error || !data) throw new AppError('clock_failed', 'No se pudo leer la hora del servidor', error);
    return { serverMs: Date.parse(data), sentAtMs, receivedAtMs };
  },
};
