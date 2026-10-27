-- =============================================================================
-- Datos de ejemplo del motor de claims (S5-10). EJECUCIÓN MANUAL por el responsable; ningún agente la corre.
--
-- Qué crea (todo is_test, correos seed-*@test.zlotify.invalid, sin contraseña ni acceso por correo):
--   * 1 vendedor (tienda "Tienda de ejemplo") y 4 compradores.
--   * 1 evento EN VIVO con 10 artículos, usando las RPC reales del motor (impersonando a cada usuario):
--       1-2  vendidos por claim confirmado        3    vendido por oferta aceptada
--       4    líder + 2 más en la cola             5    solo ofertas pendientes
--       6    líder + oferta pendiente             7-8  disponibles sin actividad
--       9    oculto (liberación manual)           10   retirado
--     release_mode = manual, auto_confirm = false.
--   * Al final imprime el código del evento (/c/<código>) y los resultados de las auditorías.
--
-- Cómo correrla: Supabase → SQL Editor → pegar el archivo completo → Run. Es una sola transacción; si falla
-- no deja nada. Se niega a correr si ya existen datos de ejemplo (corre primero dev_seed_cleanup.sql).
-- Cómo limpiar: ejecutar supabase/admin/dev_seed_cleanup.sql.
-- Las imágenes apuntan a rutas inexistentes del bucket item-images (placeholders): sube imágenes reales
-- desde el panel del vendedor si quieres verlas.
-- =============================================================================

begin;

do $$
declare
  v_seller uuid := gen_random_uuid();
  v_buyers uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_session uuid;
  v_items uuid[];
  v_entry uuid;
  v_result jsonb;
  v_code text;
  v_i int;
begin
  if exists (select 1 from auth.users where email like 'seed-%@test.zlotify.invalid') then
    raise exception 'Ya existen datos de ejemplo. Ejecuta primero supabase/admin/dev_seed_cleanup.sql';
  end if;

  -- Usuarios (el trigger on_auth_user_created crea perfil y user_stats; is_test por el dominio).
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values
    (v_seller, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'seed-vendedor@test.zlotify.invalid', now(), '{"display_name":"Vendedor de ejemplo"}', now(), now()),
    (v_buyers[1], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'seed-comprador1@test.zlotify.invalid', now(), '{"display_name":"Comprador Uno"}', now(), now()),
    (v_buyers[2], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'seed-comprador2@test.zlotify.invalid', now(), '{"display_name":"Comprador Dos"}', now(), now()),
    (v_buyers[3], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'seed-comprador3@test.zlotify.invalid', now(), '{"display_name":"Comprador Tres"}', now(), now()),
    (v_buyers[4], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'seed-comprador4@test.zlotify.invalid', now(), '{"display_name":"Comprador Cuatro"}', now(), now());

  insert into public.seller_profiles (user_id, slug, shop_name, bio, city)
  values (v_seller, 'seed-tienda-ejemplo', 'Tienda de ejemplo', 'Datos de ejemplo del motor de claims.', 'Ciudad de México');

  -- Evento y artículos (el trigger fija código, is_test y status = draft).
  insert into public.claim_sessions (seller_id, title, description, starts_at, release_mode, auto_confirm)
  values (v_seller, 'Claim de ejemplo', 'Evento sembrado para desarrollo.', now() + interval '1 hour', 'manual', false)
  returning id, code into v_session, v_code;

  insert into public.claim_items (session_id, position, title, attributes, price_cents, image_path)
  select v_session, g, 'Carta de ejemplo ' || g,
         jsonb_build_object('language', 'es', 'condition', 'NM', 'set_name', 'Colección de ejemplo'),
         (g * 10000 + 5000), 'seed/placeholder-' || g || '.webp'
  from generate_series(1, 10) g;

  select array_agg(id order by position) into v_items from public.claim_items where session_id = v_session;

  -- A partir de aquí todo pasa por las RPC reales. El vendedor publica e inicia.
  perform set_config('request.jwt.claim.sub', v_seller::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_seller)::text, true);
  v_result := public.publish_session(v_session);
  if not (v_result->>'ok')::boolean then raise exception 'publish_session: %', v_result; end if;
  v_result := public.start_session(v_session);
  if not (v_result->>'ok')::boolean then raise exception 'start_session: %', v_result; end if;
  -- Libera 1-8 y 10 (9 queda oculto).
  for v_i in 1..10 loop
    if v_i <> 9 then
      v_result := public.release_item(v_items[v_i]);
      if not (v_result->>'ok')::boolean then raise exception 'release_item %: %', v_i, v_result; end if;
    end if;
  end loop;

  -- 1 y 2: claim del comprador 1 y 2, confirmados.
  for v_i in 1..2 loop
    perform set_config('request.jwt.claim.sub', v_buyers[v_i]::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyers[v_i])::text, true);
    v_result := public.claim_item(v_items[v_i]);
    v_entry := (v_result->>'entry_id')::uuid;
    perform set_config('request.jwt.claim.sub', v_seller::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_seller)::text, true);
    v_result := public.confirm_entry(v_entry);
    if not (v_result->>'ok')::boolean then raise exception 'confirm_entry %: %', v_i, v_result; end if;
  end loop;

  -- 3: oferta del comprador 3 aceptada.
  perform set_config('request.jwt.claim.sub', v_buyers[3]::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyers[3])::text, true);
  v_result := public.make_offer(v_items[3], 20000);
  v_entry := (v_result->>'entry_id')::uuid;
  perform set_config('request.jwt.claim.sub', v_seller::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_seller)::text, true);
  v_result := public.accept_offer(v_entry);
  if not (v_result->>'ok')::boolean then raise exception 'accept_offer: %', v_result; end if;

  -- 4: cola de 3 compradores (líder = comprador 1).
  for v_i in 1..3 loop
    perform set_config('request.jwt.claim.sub', v_buyers[v_i]::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyers[v_i])::text, true);
    v_result := public.claim_item(v_items[4]);
    if not (v_result->>'ok')::boolean then raise exception 'claim 4/%: %', v_i, v_result; end if;
  end loop;

  -- 5: solo ofertas (compradores 2 y 4).
  perform set_config('request.jwt.claim.sub', v_buyers[2]::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyers[2])::text, true);
  perform public.make_offer(v_items[5], 30000);
  perform set_config('request.jwt.claim.sub', v_buyers[4]::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyers[4])::text, true);
  perform public.make_offer(v_items[5], 28000);

  -- 6: líder (comprador 4) y una oferta pendiente (comprador 3).
  v_result := public.claim_item(v_items[6]);
  perform set_config('request.jwt.claim.sub', v_buyers[3]::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_buyers[3])::text, true);
  perform public.make_offer(v_items[6], 40000);

  -- 10: retirado; 8 destacado.
  perform set_config('request.jwt.claim.sub', v_seller::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_seller)::text, true);
  perform public.withdraw_item(v_items[10]);
  perform public.feature_item(v_items[8]);
  perform public.post_announcement(v_session, '¡Bienvenidos al claim de ejemplo!');

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  raise notice 'Evento de ejemplo creado: /c/%  (id %)', v_code, v_session;
  raise notice 'Violaciones de audit_session: %', (select count(*) from public.audit_session(v_session));
  raise notice 'Diferencias de audit_user_stats: %',
    (select count(*) from unnest(v_buyers || v_seller) u(id), lateral public.audit_user_stats(u.id));
end;
$$;

commit;
