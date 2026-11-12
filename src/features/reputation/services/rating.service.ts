import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';
import { AppError } from '@/utils/errors';
import type { PendingRating } from '../types';

type Client = SupabaseClient<Database>;

export const ratingService = {
  /** Cuentas completadas que el usuario en sesión aún puede calificar. Una sola consulta (RPC). */
  async pending(supabase: Client): Promise<PendingRating[]> {
    const { data, error } = await supabase.rpc('pending_ratings');
    if (error) throw new AppError('load_failed', 'No se pudieron cargar las calificaciones', error);
    return data.map((row) => ({
      orderId: row.order_id,
      sessionId: row.session_id,
      sessionCode: row.session_code,
      sessionTitle: row.session_title,
      myRole: row.my_role === 'seller' ? 'seller' : 'buyer',
      counterpartyId: row.counterparty_id,
      counterpartyHandle: row.counterparty_handle,
      counterpartyName: row.counterparty_name,
      completedAt: row.completed_at,
      rateUntil: row.rate_until,
    }));
  },

  /** Pendientes del usuario en sesión (para server components: las pantallas no tocan el cliente). */
  async pendingForCurrentUser(): Promise<PendingRating[]> {
    return this.pending(await createClient());
  },
};
