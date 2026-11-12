import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type { BadgeData, ReputationStats } from '@/types/reputation';
import { AppError } from '@/utils/errors';
import { toBadgeData } from '@/utils/reputationStats';

// Lecturas públicas de reputación compartidas por varias pantallas. Una sola consulta por pantalla:
// las insignias de todos los usuarios visibles viajan juntas (nunca una consulta por usuario).
type Client = SupabaseClient<Database>;
type StatsRow = Database['public']['Views']['public_user_stats']['Row'];

const n = (value: number | null) => value ?? 0;

export function statsFromRow(row: StatsRow): ReputationStats {
  return {
    winsCount: n(row.wins_count),
    sessionsParticipated: n(row.sessions_participated),
    ordersPaidOnTime: n(row.orders_paid_on_time),
    ordersPaidLate: n(row.orders_paid_late),
    ordersUnpaid: n(row.orders_unpaid),
    ordersReleased: n(row.orders_released),
    deliveriesReceived: n(row.deliveries_received),
    sessionsHosted: n(row.sessions_hosted),
    winsSold: n(row.wins_sold),
    ordersClosedOnTime: n(row.orders_closed_on_time),
    ordersClosedLate: n(row.orders_closed_late),
    deliveriesOnTime: n(row.deliveries_on_time),
    deliveriesLate: n(row.deliveries_late),
    ratingAsBuyerSum: n(row.rating_as_buyer_sum),
    ratingAsBuyerCount: n(row.rating_as_buyer_count),
    ratingAsSellerSum: n(row.rating_as_seller_sum),
    ratingAsSellerCount: n(row.rating_as_seller_count),
  };
}

export const reputationBadgeService = {
  /**
   * Datos de insignia de varios usuarios en UNA consulta. `asRole` fuerza el rol mostrado (p. ej. el
   * vendedor de un evento); sin él, se usa `is_seller` del usuario. Usuarios sin fila quedan fuera del mapa.
   */
  async forUsers(
    supabase: Client,
    userIds: string[],
    options: { asRole?: 'buyer' | 'seller' } = {},
  ): Promise<Map<string, BadgeData>> {
    const ids = [...new Set(userIds.filter(Boolean))];
    const result = new Map<string, BadgeData>();
    if (ids.length === 0) return result;
    const { data, error } = await supabase.from('public_user_stats').select('*').in('user_id', ids);
    if (error) throw new AppError('load_failed', 'No se pudo cargar la reputación', error);
    for (const row of data) {
      if (!row.user_id || !row.handle || !row.member_since) continue;
      const isSeller = options.asRole ? options.asRole === 'seller' : Boolean(row.is_seller);
      result.set(
        row.user_id,
        toBadgeData(
          { userId: row.user_id, handle: row.handle, memberSince: row.member_since, isSeller },
          statsFromRow(row),
        ),
      );
    }
    return result;
  },
};
