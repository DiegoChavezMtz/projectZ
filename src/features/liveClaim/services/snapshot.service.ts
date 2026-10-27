import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ClaimSession } from '@/types/claims';
import { AppError } from '@/utils/errors';
import { FEED_LIMIT, type LiveSeller, type LiveSnapshot } from '../types';
import { querySellers } from './liveQueries';

const PUBLIC_STATUSES = ['scheduled', 'live', 'ended'] as const;

// Lecturas del visor en server components. Todo pasa por RLS: un visitante anónimo solo ve eventos
// publicados y artículos no ocultos (o preview); nunca claim_entries ni claim_wins.
export const snapshotService = {
  /** Hora autoritativa del servidor (ISO UTC), para calcular `clockOffset` en el cliente. */
  async getServerClock(): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('server_now');
    if (error || !data)
      throw new AppError('clock_failed', 'No se pudo leer la hora del servidor', error);
    return new Date(data).toISOString();
  },

  /** Usuario con sesión (o null). Valida el token con Auth, no solo la cookie. */
  async getViewer(): Promise<{ id: string } | null> {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user ? { id: data.user.id } : null;
  },

  /** Evento publicado (no borrador ni cancelado) con ese código, sin artículos. */
  async getPublishedSession(code: string): Promise<ClaimSession | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('claim_sessions')
      .select('*')
      .eq('code', code.toUpperCase())
      .in('status', PUBLIC_STATUSES)
      .maybeSingle();
    if (error) throw new AppError('load_failed', 'No se pudo cargar el evento', error);
    return data;
  },

  /** Vendedores por id (nombre de tienda y handle públicos). */
  async getSellers(sellerIds: string[]): Promise<Map<string, LiveSeller>> {
    return querySellers(await createClient(), sellerIds);
  },

  /**
   * Snapshot del evento con ese código, o null si no existe, no es público o fue cancelado.
   * El dueño puede ver su borrador (vista previa): la RLS se lo permite, y para el resto se
   * exige un estado público.
   */
  async getSnapshot(code: string, viewerId?: string | null): Promise<LiveSnapshot | null> {
    const supabase = await createClient();
    const { data: session, error } = await supabase
      .from('claim_sessions')
      .select('*')
      .eq('code', code.toUpperCase())
      .maybeSingle();
    if (error) throw new AppError('load_failed', 'No se pudo cargar el evento', error);
    if (!session) return null;
    const isPublic = (PUBLIC_STATUSES as readonly string[]).includes(session.status);
    const isOwnerDraft = session.status === 'draft' && viewerId === session.seller_id;
    if (!isPublic && !isOwnerDraft) return null;

    const [items, feed, serverNow, sellers] = await Promise.all([
      supabase.from('claim_items').select('*').eq('session_id', session.id).order('position'),
      supabase
        .from('session_feed')
        .select('*')
        .eq('session_id', session.id)
        .order('id', { ascending: false })
        .limit(FEED_LIMIT),
      this.getServerClock(),
      this.getSellers([session.seller_id]),
    ]);
    if (items.error)
      throw new AppError('load_failed', 'No se pudieron cargar los artículos', items.error);
    if (feed.error) throw new AppError('load_failed', 'No se pudo cargar el feed', feed.error);

    const seller = sellers.get(session.seller_id);
    if (!seller) throw new AppError('load_failed', 'No se pudo cargar al vendedor');
    return { session, items: items.data, feed: [...feed.data].reverse(), serverNow, seller };
  },

  /** Intentos del comprador en el evento (RLS: solo los suyos). */
  async getViewerEntries(sessionId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('claim_entries')
      .select('id, item_id, kind, amount_cents, status, seq')
      .eq('session_id', sessionId);
    if (error) throw new AppError('load_failed', 'No se pudieron cargar tus intentos', error);
    return data;
  },
};
