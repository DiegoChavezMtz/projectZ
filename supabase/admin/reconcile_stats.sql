-- =============================================================================
-- Reconciliación de user_stats (S9-09)
-- Ejecución MANUAL por el responsable, en el SQL Editor de Supabase. Nunca la ejecuta un agente.
--
-- Recalcula los contadores de user_stats desde la fuente de verdad: claim_wins, session_participants,
-- claim_sessions, reputation_events (sin las marcas revoked) y ratings. Es la misma definición de
-- audit_user_stats(user_id); úsala cuando la auditoría reporte discrepancias.
--
-- 1. Detecta usuarios con discrepancias (vacío = todo correcto):
--      select p.id, p.handle, a.*
--      from public.profiles p, lateral public.audit_user_stats(p.id) a;
-- 2. Para corregir un usuario, reemplaza el uuid y ejecuta el bloque (devuelve la fila resultante).
--    Sin el uuid (null) no hace nada, para que no se ejecute completo por accidente.
-- =============================================================================

with target as (select null::uuid as user_id)   -- <- reemplaza por el uuid del usuario
update public.user_stats u set
  wins_count = (select count(*) from public.claim_wins where buyer_id = u.user_id),
  wins_sold = (select count(*) from public.claim_wins where seller_id = u.user_id),
  sessions_participated = (select count(*) from public.session_participants where user_id = u.user_id),
  sessions_hosted = (select count(*) from public.claim_sessions
                     where seller_id = u.user_id and started_at is not null),
  orders_paid_on_time = (select count(*) from public.reputation_events
                         where user_id = u.user_id and kind = 'paid_on_time' and status <> 'revoked'),
  orders_paid_late = (select count(*) from public.reputation_events
                      where user_id = u.user_id and kind = 'paid_late' and status <> 'revoked'),
  orders_unpaid = (select count(*) from public.reputation_events
                   where user_id = u.user_id and kind = 'unpaid' and status <> 'revoked'),
  orders_released = (select count(*) from public.reputation_events
                     where user_id = u.user_id and kind = 'accumulate_released' and status <> 'revoked'),
  deliveries_received = (select count(*) from public.reputation_events
                         where user_id = u.user_id and kind = 'received' and status <> 'revoked'),
  orders_closed_on_time = (select count(*) from public.reputation_events
                           where user_id = u.user_id and kind = 'order_closed_on_time' and status <> 'revoked'),
  orders_closed_late = (select count(*) from public.reputation_events
                        where user_id = u.user_id and kind = 'order_closed_late' and status <> 'revoked'),
  deliveries_on_time = (select count(*) from public.reputation_events
                        where user_id = u.user_id and kind = 'delivered_on_time' and status <> 'revoked'),
  deliveries_late = (select count(*) from public.reputation_events
                     where user_id = u.user_id and kind = 'delivered_late' and status <> 'revoked'),
  rating_as_buyer_count = (select count(*) from public.ratings where ratee_id = u.user_id and rater_role = 'seller'),
  rating_as_buyer_sum = (select coalesce(sum(stars), 0) from public.ratings
                         where ratee_id = u.user_id and rater_role = 'seller'),
  rating_as_seller_count = (select count(*) from public.ratings where ratee_id = u.user_id and rater_role = 'buyer'),
  rating_as_seller_sum = (select coalesce(sum(stars), 0) from public.ratings
                          where ratee_id = u.user_id and rater_role = 'buyer')
from target t
where u.user_id = t.user_id
returning u.*;
