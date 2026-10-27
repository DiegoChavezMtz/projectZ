-- =============================================================================
-- Resolución manual de una objeción a "no pagó" (S8-09)
-- Ejecución MANUAL por el responsable, en el SQL Editor de Supabase. Nunca la ejecuta un agente.
--
-- 1. Revisa la objeción:
--      select d.order_id, d.note, d.created_at, o.session_id, o.buyer_id, o.seller_id, o.unpaid_at
--      from public.order_disputes d join public.orders o on o.id = d.order_id
--      where d.status = 'open' order by d.created_at;
-- 2. Reemplaza los tres valores y ejecuta UNA de las dos formas:
--      'revoked' -> la marca se oculta, se revierte orders_unpaid del comprador y la cuenta queda cancelled.
--      'upheld'  -> la marca se mantiene y se muestra la nota de resolución junto a la objeción.
-- =============================================================================

select public.admin_resolve_dispute(
  '00000000-0000-0000-0000-000000000000'::uuid,   -- order_id de la cuenta objetada
  'revoked',                                      -- 'revoked' | 'upheld'
  'Nota de resolución visible (máx. 500 caracteres)'
);
