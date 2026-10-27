import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { ChannelStatus } from '@/hooks/useResilientChannel';
import type { ClaimItem, ClaimSession, SessionFeedEvent } from '@/types/claims';
import type { ConsoleEntry } from '../types';

export type ConsoleRealtimeHandlers = {
  onItem: (item: ClaimItem) => void;
  onFeed: (event: SessionFeedEvent) => void;
  onSession: (session: ClaimSession) => void;
  onEntry: (entry: ConsoleEntry) => void;
  onStatus: (status: ChannelStatus) => void;
};

// Un canal por evento con cuatro `postgres_changes` filtrados por `session_id`. `claim_entries`
// llega al vendedor por su policy de SELECT (migración 16); a un anónimo no le llega nada.
export const consoleRealtimeService = {
  subscribe(sessionId: string, handlers: ConsoleRealtimeHandlers): () => void {
    const supabase = createClient();
    const filter = `session_id=eq.${sessionId}`;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const open = () =>
      supabase
        .channel(`seller-console:${sessionId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'claim_items', filter },
          (payload) => {
            if (payload.eventType !== 'DELETE') handlers.onItem(payload.new as ClaimItem);
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'session_feed', filter },
          (payload) => handlers.onFeed(payload.new as SessionFeedEvent),
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'claim_sessions',
            filter: `id=eq.${sessionId}`,
          },
          (payload) => handlers.onSession(payload.new as ClaimSession),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'claim_entries', filter },
          (payload) => {
            if (payload.eventType !== 'DELETE') handlers.onEntry(payload.new as ConsoleEntry);
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') handlers.onStatus('subscribed');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handlers.onStatus('error');
          else if (status === 'CLOSED') handlers.onStatus('closed');
        });

    // Realtime evalúa los filtros con el rol del token del socket. Si el canal se une antes de que la
    // sesión (cookies) esté cargada lo hace como anónimo y `claim_entries` resulta inválido para ese
    // rol, así que primero se entrega el token del vendedor y luego se abre el canal.
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (data.session) supabase.realtime.setAuth(data.session.access_token);
        channel = open();
      })
      .catch(() => {
        if (!cancelled) handlers.onStatus('error');
      });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  },
};
