import { createClient } from '@/lib/supabase/client';
import { unwrapRpc } from '@/utils/rpc';
import { liveActionErrors, liveConsoleContent } from '../content/es-MX';

type Counted = { released?: number; rejected?: number };

// Acciones del vendedor durante el evento (consola en vivo, S7). Van directo a la RPC desde el navegador;
// Postgres valida sesión, propiedad y estado. Los fallos llegan como AppError con texto en español.
async function call<T extends object = object>(
  fn: string,
  args: Record<string, unknown>,
  messages: Record<string, string> = liveActionErrors,
) {
  const { data, error } = await createClient().rpc(fn as 'start_session', args as never);
  return unwrapRpc<T>(data, error, messages);
}

export const liveActionsService = {
  startSession: (sessionId: string) => call<Counted>('start_session', { p_session_id: sessionId }),
  endSession: (sessionId: string) => call<Counted>('end_session', { p_session_id: sessionId }),
  releaseItem: (itemId: string) => call('release_item', { p_item_id: itemId }),
  releaseAllItems: (sessionId: string) =>
    call<Counted>('release_all_items', { p_session_id: sessionId }),
  withdrawItem: (itemId: string) => call('withdraw_item', { p_item_id: itemId }),
  postAnnouncement: (sessionId: string, text: string) =>
    call('post_announcement', { p_session_id: sessionId, p_text: text }),
  featureItem: (itemId: string, featured = true) =>
    call('feature_item', { p_item_id: itemId, p_featured: featured }),
  /** Mueve el cierre programado (solo hacia el futuro; la RPC valida). */
  setSessionClose: (sessionId: string, closesAt: string) =>
    call(
      'set_session_close',
      { p_session_id: sessionId, p_closes_at: closesAt },
      { ...liveActionErrors, validation_failed: liveConsoleContent.close.notLater },
    ),
  confirmEntry: (entryId: string) => call('confirm_entry', { p_entry_id: entryId }),
  rejectEntry: (entryId: string) => call('reject_entry', { p_entry_id: entryId }),
  acceptOffer: (entryId: string) => call('accept_offer', { p_entry_id: entryId }),
  rejectOffer: (entryId: string) => call('reject_offer', { p_entry_id: entryId }),
};
