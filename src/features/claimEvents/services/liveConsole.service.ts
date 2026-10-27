import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/utils/errors';
import type { ConsoleSnapshot, ConsoleWin } from '../types';
import { CONSOLE_FEED_LIMIT, queryBuyers, queryEntries } from './consoleQueries';

// Lectura SSR de la consola. Todo pasa por RLS; además se filtra por dueño para que un evento
// ajeno devuelva `null` (la page responde 404) y no una lista vacía.
export const liveConsoleService = {
  async getSnapshot(sellerId: string, sessionId: string): Promise<ConsoleSnapshot | null> {
    const supabase = await createClient();
    const { data: session, error } = await supabase
      .from('claim_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('seller_id', sellerId)
      .maybeSingle();
    if (error) throw new AppError('load_failed', 'No se pudo cargar el evento', error);
    if (!session) return null;

    const [items, feed, entries, clock, wins] = await Promise.all([
      supabase.from('claim_items').select('*').eq('session_id', session.id).order('position'),
      supabase
        .from('session_feed')
        .select('*')
        .eq('session_id', session.id)
        .order('id', { ascending: false })
        .limit(CONSOLE_FEED_LIMIT),
      queryEntries(supabase, session.id),
      supabase.rpc('server_now'),
      supabase
        .from('claim_wins')
        .select('id, item_id, buyer_id, price_cents, won_via')
        .eq('session_id', session.id),
    ]);
    if (items.error)
      throw new AppError('load_failed', 'No se pudieron cargar los artículos', items.error);
    if (feed.error) throw new AppError('load_failed', 'No se pudo cargar el feed', feed.error);
    if (wins.error)
      throw new AppError('load_failed', 'No se pudieron cargar los claims ganados', wins.error);
    if (clock.error || !clock.data)
      throw new AppError('clock_failed', 'No se pudo leer la hora del servidor', clock.error);

    const winRows: ConsoleWin[] = wins.data;
    const buyers = await queryBuyers(supabase, [
      ...entries.map((entry) => entry.buyer_id),
      ...winRows.map((win) => win.buyer_id),
    ]);
    return {
      session,
      items: items.data,
      feed: [...feed.data].reverse(),
      entries,
      buyers,
      wins: winRows,
      serverNow: new Date(clock.data).toISOString(),
    };
  },
};
