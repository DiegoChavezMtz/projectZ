import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { ClaimItem, ClaimSession, SessionFeedEvent } from '@/types/claims';

export type RealtimeStatus = 'subscribed' | 'error' | 'closed';

export type RealtimeHandlers = {
  onItem: (item: ClaimItem) => void;
  onFeed: (event: SessionFeedEvent) => void;
  onSession: (session: ClaimSession) => void;
  onStatus: (status: RealtimeStatus) => void;
};

// Un solo canal por evento con los tres `postgres_changes` filtrados por `session_id` (claims.md).
// RLS filtra lo que cada cliente puede recibir.
export const liveRealtimeService = {
  subscribe(sessionId: string, handlers: RealtimeHandlers): () => void {
    const supabase = createClient();
    const channel: RealtimeChannel = supabase
      .channel(`live-claim:${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claim_items', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType !== 'DELETE') handlers.onItem(payload.new as ClaimItem);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_feed', filter: `session_id=eq.${sessionId}` },
        (payload) => handlers.onFeed(payload.new as SessionFeedEvent),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'claim_sessions', filter: `id=eq.${sessionId}` },
        (payload) => handlers.onSession(payload.new as ClaimSession),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') handlers.onStatus('subscribed');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') handlers.onStatus('error');
        else if (status === 'CLOSED') handlers.onStatus('closed');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
