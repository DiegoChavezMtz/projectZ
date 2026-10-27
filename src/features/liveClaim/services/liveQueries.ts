import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { AppError } from '@/utils/errors';
import type { LiveListEntry, LiveSeller } from '../types';

type Client = SupabaseClient<Database>;

/** Vendedores por id (nombre de tienda y handle públicos; nunca datos de pago). */
export async function querySellers(
  supabase: Client,
  sellerIds: string[],
): Promise<Map<string, LiveSeller>> {
  const ids = [...new Set(sellerIds)];
  const [shops, profiles] = await Promise.all([
    supabase.from('public_seller_profiles').select('user_id, shop_name, city').in('user_id', ids),
    supabase.from('public_profiles').select('id, handle, display_name').in('id', ids),
  ]);
  if (shops.error || profiles.error)
    throw new AppError('load_failed', 'No se pudo cargar al vendedor', shops.error ?? profiles.error);
  const result = new Map<string, LiveSeller>();
  for (const id of ids) {
    const shop = shops.data.find((row) => row.user_id === id);
    const profile = profiles.data.find((row) => row.id === id);
    result.set(id, {
      id,
      shopName: shop?.shop_name ?? profile?.display_name ?? 'Vendedor',
      handle: profile?.handle ?? null,
      city: shop?.city ?? null,
    });
  }
  return result;
}

/** Eventos `live` (sin cuentas de prueba), del más reciente al más antiguo, con artículos disponibles/total. */
export async function queryLiveList(supabase: Client): Promise<LiveListEntry[]> {
  const { data: sessions, error } = await supabase
    .from('claim_sessions')
    .select('id, code, title, category, started_at, starts_at, seller_id')
    .eq('status', 'live')
    .eq('is_test', false)
    .order('started_at', { ascending: false });
  if (error) throw new AppError('load_failed', 'No se pudieron cargar los claims en vivo', error);
  if (sessions.length === 0) return [];

  const ids = sessions.map((s) => s.id);
  const [items, sellers] = await Promise.all([
    supabase.from('claim_items').select('session_id, status').in('session_id', ids),
    querySellers(supabase, sessions.map((s) => s.seller_id)),
  ]);
  if (items.error) throw new AppError('load_failed', 'No se pudieron contar los artículos', items.error);

  return sessions.flatMap(({ seller_id, ...session }) => {
    const seller = sellers.get(seller_id);
    if (!seller) return [];
    const own = items.data.filter((item) => item.session_id === session.id);
    return [
      {
        session,
        seller,
        totalCount: own.filter((item) => item.status !== 'hidden' && item.status !== 'withdrawn').length,
        availableCount: own.filter((item) => item.status === 'available').length,
      },
    ];
  });
}
