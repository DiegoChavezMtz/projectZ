import { createClient } from '@/lib/supabase/client';
import { AppError } from '@/utils/errors';
import type { BuyerInfo, ConsoleAction, ConsoleWin } from '../types';
import { CONSOLE_FEED_LIMIT, queryBuyers, queryEntries } from './consoleQueries';

type Fresh = Extract<ConsoleAction, { type: 'snapshot' }>;

// Lecturas del navegador para la consola (refetch tras acciones y reconexiones). Pasan por RLS.
export const consoleDataClient = {
  async fetchState(sessionId: string): Promise<Fresh> {
    const supabase = createClient();
    const [session, items, feed, entries] = await Promise.all([
      supabase.from('claim_sessions').select('*').eq('id', sessionId).maybeSingle(),
      supabase.from('claim_items').select('*').eq('session_id', sessionId).order('position'),
      supabase
        .from('session_feed')
        .select('*')
        .eq('session_id', sessionId)
        .order('id', { ascending: false })
        .limit(CONSOLE_FEED_LIMIT),
      queryEntries(supabase, sessionId),
    ]);
    if (session.error || items.error || feed.error || !session.data)
      throw new AppError(
        'load_failed',
        'No se pudo actualizar la consola',
        session.error ?? items.error ?? feed.error,
      );
    return {
      type: 'snapshot',
      session: session.data,
      items: items.data,
      feed: [...feed.data].reverse(),
      entries,
    };
  },

  async fetchWins(sessionId: string): Promise<ConsoleWin[]> {
    const { data, error } = await createClient()
      .from('claim_wins')
      .select('id, item_id, buyer_id, price_cents, won_via')
      .eq('session_id', sessionId);
    if (error) throw new AppError('load_failed', 'No se pudieron cargar los claims ganados', error);
    return data;
  },

  fetchBuyers: (buyerIds: string[]): Promise<BuyerInfo[]> => queryBuyers(createClient(), buyerIds),
};
