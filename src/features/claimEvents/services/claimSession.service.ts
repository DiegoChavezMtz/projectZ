import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ClaimSession, SessionStatus } from '@/types/claims';
import { AppError } from '@/utils/errors';
import type { SessionListFilter, SessionListItem, SessionWithItems } from '../types';
import type { toSessionColumns } from '../utils/session.schemas';

type SessionColumns = ReturnType<typeof toSessionColumns>;

export const LIST_LIMIT = 50;

type RpcResult =
  { ok: true; code?: string } | { ok: false; code: string; message: string; reasons?: string[] };

function unwrap(result: RpcResult | null, error: unknown): { code?: string } {
  if (error || !result) throw new AppError('save_failed', 'No se pudo completar la acción', error);
  if (!result.ok) throw new AppError(result.code, result.message, { reasons: result.reasons });
  return result;
}

// Eventos del vendedor en sesión. Todo pasa por RLS (cliente con cookies); filtramos por dueño además
// para que la consulta sea explícita aunque la policy ya lo garantiza.
export const claimSessionService = {
  async list(
    sellerId: string,
    filter: SessionListFilter = 'all',
    limit: number = LIST_LIMIT,
  ): Promise<SessionListItem[]> {
    const supabase = await createClient();
    let query = supabase
      .from('claim_sessions')
      .select('*, claim_items(count)')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (filter !== 'all') query = query.eq('status', filter as SessionStatus);
    const { data, error } = await query;
    if (error) throw new AppError('list_failed', 'No se pudieron cargar los eventos', error);
    return (data ?? []).map(({ claim_items, ...session }) => ({
      ...session,
      item_count: claim_items[0]?.count ?? 0,
    }));
  },

  /** Evento propio con sus artículos ordenados, o null si no existe o no es del vendedor. */
  async getWithItems(sellerId: string, id: string): Promise<SessionWithItems | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('claim_sessions')
      .select('*, claim_items(*)')
      .eq('id', id)
      .eq('seller_id', sellerId)
      .maybeSingle();
    if (error) throw new AppError('load_failed', 'No se pudo cargar el evento', error);
    if (!data) return null;
    const { claim_items, ...session } = data;
    return { ...session, items: [...claim_items].sort((a, b) => a.position - b.position) };
  },

  async create(sellerId: string, columns: SessionColumns): Promise<ClaimSession> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('claim_sessions')
      .insert({ ...columns, seller_id: sellerId } as never)
      .select('*')
      .single();
    if (error || !data) throw new AppError('save_failed', 'No se pudo crear el evento', error);
    return data;
  },

  async update(id: string, columns: Partial<SessionColumns>): Promise<void> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('claim_sessions')
      .update(columns as never)
      .eq('id', id)
      .select('id');
    if (error) throw new AppError('save_failed', 'No se pudo guardar el evento', error);
    // RLS filtra en silencio: cero filas = no es del vendedor o ya no es editable.
    if (!data?.length) throw new AppError('invalid_state', 'El evento ya no se puede modificar');
  },

  async cancel(id: string): Promise<void> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('cancel_session', { p_session_id: id });
    unwrap(data as RpcResult | null, error);
  },

  /** `publish_session`: devuelve el código público. Con evento incompleto lanza `validation_failed` con `reasons`. */
  async publish(id: string): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('publish_session', { p_session_id: id });
    const result = unwrap(data as RpcResult | null, error);
    if (!result.code) throw new AppError('save_failed', 'Respuesta inesperada al publicar');
    return result.code;
  },
};

export { unwrap as unwrapRpc };
export type { RpcResult };
