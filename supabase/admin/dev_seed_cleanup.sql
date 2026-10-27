-- =============================================================================
-- Limpieza de los datos de ejemplo de dev_seed.sql (S5-10). EJECUCIÓN MANUAL por el responsable.
-- Borra solo cuentas seed-*@test.zlotify.invalid con is_test = true y todo lo que cuelga de ellas.
-- Orden: claim_wins -> eventos (artículos, intentos, participantes y feed en cascada) -> intentos y
-- participaciones sueltas -> perfiles (seller_profiles y user_stats en cascada) -> auth.users.
-- =============================================================================

begin;

do $$
declare
  v_ids uuid[];
begin
  select array_agg(u.id) into v_ids
  from auth.users u
  join public.profiles p on p.id = u.id and p.is_test
  where u.email like 'seed-%@test.zlotify.invalid';

  if v_ids is null then
    raise notice 'No hay datos de ejemplo que limpiar.';
    return;
  end if;

  delete from public.claim_wins where buyer_id = any (v_ids) or seller_id = any (v_ids);
  delete from public.claim_sessions where seller_id = any (v_ids) and is_test;
  delete from public.claim_entries where buyer_id = any (v_ids);
  delete from public.session_participants where user_id = any (v_ids);
  delete from public.profiles where id = any (v_ids) and is_test;
  delete from auth.users where id = any (v_ids);

  raise notice 'Datos de ejemplo eliminados (% cuentas).', cardinality(v_ids);
end;
$$;

commit;
