import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { statsFromRow } from '@/services/reputation.service';
import type { Database, Json } from '@/types/database.types';
import { AppError } from '@/utils/errors';
import type {
  HistoryEntry,
  HistoryPage,
  PublicProfile,
  RatingSummary,
  RatingTag,
  RepKind,
  RepRole,
} from '../types';
import {
  RATING_TAGS,
  averageRating,
  hasBuyerData,
  hasSellerData,
  ratingAsRole,
} from '../utils/reputation.utils';

type Client = SupabaseClient<Database>;

export const HISTORY_PAGE_SIZE = 20;

const fail = (what: string, error: unknown) =>
  new AppError('load_failed', `No se pudo cargar ${what}`, error);

const record = (value: Json | null): Record<string, Json | undefined> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
const num = (value: Json | undefined) => (typeof value === 'number' ? value : null);
const text = (value: Json | undefined) => (typeof value === 'string' ? value : null);

const isTag = (value: Json): value is RatingTag => RATING_TAGS.includes(value as RatingTag);

type EventRow = Database['public']['Views']['public_reputation_events']['Row'];

export function toHistoryEntry(row: EventRow): HistoryEntry | null {
  if (!row.id || !row.kind || !row.role || !row.occurred_at) return null;
  if (row.status !== 'active' && row.status !== 'disputed') return null;
  const payload = record(row.payload);
  const method = text(payload.method);
  return {
    id: row.id,
    role: row.role === 'seller' ? 'seller' : 'buyer',
    kind: row.kind as RepKind,
    status: row.status,
    sessionCode: row.session_code,
    sessionTitle: row.session_title,
    counterpartyHandle: row.counterparty_handle,
    counterpartyName: row.counterparty_name,
    hours: num(payload.hours),
    method: method === 'shipping' || method === 'pickup' ? method : null,
    stars: num(payload.stars),
    tags: Array.isArray(payload.tags) ? payload.tags.filter(isTag) : [],
    comment: text(payload.comment),
    releaseReason: text(payload.reason),
    disputeNote: row.dispute_note,
    disputeResolutionNote: row.dispute_resolution_note ?? text(payload.resolution_note),
    occurredAt: row.occurred_at,
  };
}

export const reputationService = {
  /** Perfil público por handle. Null si no existe. Cuentas eliminadas llegan anonimizadas. */
  async profileByHandle(supabase: Client, handle: string): Promise<PublicProfile | null> {
    const { data, error } = await supabase
      .from('public_user_stats')
      .select('*')
      .eq('handle', handle)
      .maybeSingle();
    if (error) throw fail('el perfil', error);
    if (!data?.user_id || !data.handle || !data.member_since) return null;
    return {
      header: {
        userId: data.user_id,
        handle: data.handle,
        displayName: data.display_name ?? data.handle,
        avatarPath: data.avatar_path,
        memberSince: data.member_since,
        isDeleted: Boolean(data.is_deleted),
        isSeller: Boolean(data.is_seller),
        sellerSlug: data.seller_slug,
        shopName: data.shop_name,
        sellerSince: data.seller_since,
      },
      stats: statsFromRow(data),
    };
  },

  /** Historial paginado (20 por página, más reciente primero), con filtro opcional por rol. */
  async history(
    supabase: Client,
    userId: string,
    options: { role?: RepRole; page?: number } = {},
  ): Promise<HistoryPage> {
    const page = Math.max(1, Math.floor(options.page ?? 1));
    const from = (page - 1) * HISTORY_PAGE_SIZE;
    let query = supabase
      .from('public_reputation_events')
      .select('*')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .range(from, from + HISTORY_PAGE_SIZE); // una fila de más para saber si hay otra página
    if (options.role) query = query.eq('role', options.role);
    const { data, error } = await query;
    if (error) throw fail('el historial', error);
    const entries = data
      .slice(0, HISTORY_PAGE_SIZE)
      .map(toHistoryEntry)
      .filter((entry): entry is HistoryEntry => entry !== null);
    return { entries, page, hasMore: data.length > HISTORY_PAGE_SIZE };
  },

  /** Promedio, distribución y etiquetas más frecuentes de las calificaciones recibidas como `role`. */
  async ratingSummary(
    supabase: Client,
    userId: string,
    role: RepRole,
    totals: { sum: number; count: number },
  ): Promise<RatingSummary> {
    // `rater_role` es quien calificó: a un vendedor lo califican compradores.
    const raterRole = role === 'seller' ? 'buyer' : 'seller';
    const [stars, tags] = await Promise.all([
      supabase
        .from('public_rating_breakdown')
        .select('stars, total')
        .eq('user_id', userId)
        .eq('rater_role', raterRole),
      supabase
        .from('public_rating_tags')
        .select('tag, total')
        .eq('user_id', userId)
        .eq('rater_role', raterRole),
    ]);
    if (stars.error) throw fail('las calificaciones', stars.error);
    if (tags.error) throw fail('las etiquetas', tags.error);
    return {
      role,
      average: averageRating(totals.sum, totals.count),
      count: totals.count,
      distribution: stars.data.flatMap((r) =>
        r.stars != null && r.total != null ? [{ stars: r.stars, total: r.total }] : [],
      ),
      topTags: tags.data.flatMap((r) =>
        r.tag && isTag(r.tag) && r.total != null ? [{ tag: r.tag, total: r.total }] : [],
      ),
    };
  },

  ratingTotals: ratingAsRole,

  /** Claims próximos y en vivo del vendedor (RLS ya limita a eventos públicos). */
  async upcomingEvents(supabase: Client, sellerId: string) {
    const { data, error } = await supabase
      .from('claim_sessions')
      .select('code, title, status, starts_at, closes_at')
      .eq('seller_id', sellerId)
      .in('status', ['scheduled', 'live'])
      .order('starts_at')
      .limit(10);
    if (error) throw fail('los claims del vendedor', error);
    return data.map((s) => ({
      code: s.code,
      title: s.title,
      status: s.status as 'scheduled' | 'live',
      startsAt: s.starts_at,
      closesAt: s.closes_at,
    }));
  },

  /** Todo lo que pinta `/u/[handle]`, con el cliente de la petición. Null si el handle no existe. */
  async profilePage(handle: string, options: { role?: RepRole; page?: number } = {}) {
    const supabase = await createClient();
    const profile = await this.profileByHandle(supabase, handle);
    if (!profile) return null;
    const { header, stats } = profile;
    const showBuyer = hasBuyerData(stats);
    const showSeller = header.isSeller && hasSellerData(stats);
    const [history, buyerRatings, sellerRatings, events] = await Promise.all([
      this.history(supabase, header.userId, options),
      showBuyer
        ? this.ratingSummary(supabase, header.userId, 'buyer', ratingAsRole(stats, 'buyer'))
        : null,
      showSeller
        ? this.ratingSummary(supabase, header.userId, 'seller', ratingAsRole(stats, 'seller'))
        : null,
      header.isSeller && !header.isDeleted ? this.upcomingEvents(supabase, header.userId) : [],
    ]);
    return { profile, history, buyerRatings, sellerRatings, events, showBuyer, showSeller };
  },

  /** Nombre visible para metadatos; null si el handle no existe. */
  async displayNameFor(handle: string): Promise<{ name: string; isDeleted: boolean } | null> {
    const profile = await this.profileByHandle(await createClient(), handle);
    return profile
      ? { name: profile.header.displayName, isDeleted: profile.header.isDeleted }
      : null;
  },
};
