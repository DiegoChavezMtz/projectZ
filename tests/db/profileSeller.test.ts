import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, anonClient } from '../helpers/supabase';
import { createTestUser, signInAs } from '../helpers/users';

// S3-08 y S3-09 contra la BD en línea (migración 20261024120000): perfil, handle, avatars y seller_profiles.

const WEBP = () => new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'image/webp' });
const uploaded: string[] = [];
const slug = () => `t-${randomUUID().slice(0, 8)}`;

afterAll(async () => {
  if (uploaded.length) await adminClient().storage.from('avatars').remove(uploaded);
});

describe('handle_new_user: nombre del proveedor', () => {
  it.each([
    [{ full_name: 'Ana Google' }, 'Ana Google'],
    [{ name: 'Beto Google' }, 'Beto Google'],
    [{ display_name: 'Propio', full_name: 'Otro' }, 'Propio'],
  ])('user_metadata %j → display_name %s', async (metadata, expected) => {
    const email = `oauth-${randomUUID().slice(0, 8)}@test.zlotify.invalid`;
    const { data } = await adminClient().auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
    });
    const { data: profile } = await adminClient()
      .from('profiles')
      .select('display_name, is_test')
      .eq('id', data.user!.id)
      .single();
    expect(profile).toEqual({ display_name: expected, is_test: true });
    await adminClient().auth.admin.deleteUser(data.user!.id);
    await adminClient().from('profiles').delete().eq('id', data.user!.id).eq('is_test', true);
  });
});

describe('profiles: handle', () => {
  it('el usuario cambia el suyo; uno reservado, duplicado o inválido se rechaza', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const client = await signInAs(a);
    const mine = `mine_${randomUUID().slice(0, 6)}`;

    expect(
      (await client.from('profiles').update({ handle: mine }).eq('id', a.id)).error,
    ).toBeNull();

    const reserved = await client.from('profiles').update({ handle: 'admin' }).eq('id', a.id);
    expect(reserved.error?.code).toBe('23514');

    const { data: other } = await adminClient()
      .from('profiles')
      .select('handle')
      .eq('id', b.id)
      .single();
    const dup = await client.from('profiles').update({ handle: other!.handle }).eq('id', a.id);
    expect(dup.error?.code).toBe('23505');

    const bad = await client.from('profiles').update({ handle: 'Con Espacios' }).eq('id', a.id);
    expect(bad.error?.code).toBe('23514');
  });

  it('is_handle_available: libre, tomado y reservado', async () => {
    const user = await createTestUser();
    const { data: p } = await adminClient()
      .from('profiles')
      .select('handle')
      .eq('id', user.id)
      .single();
    const anon = anonClient();
    expect(
      (await anon.rpc('is_handle_available', { p_handle: `libre_${randomUUID().slice(0, 6)}` }))
        .data,
    ).toBe(true);
    expect((await anon.rpc('is_handle_available', { p_handle: p!.handle })).data).toBe(false);
    expect((await anon.rpc('is_handle_available', { p_handle: 'admin' })).data).toBe(false);
  });
});

describe('Storage: avatars', () => {
  it('escribe en su carpeta, no en la ajena, y la lectura pública funciona', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const clientA = await signInAs(a);
    const clientB = await signInAs(b);

    const own = `${a.id}/${Date.now()}.webp`;
    const ok = await clientA.storage
      .from('avatars')
      .upload(own, WEBP(), { contentType: 'image/webp' });
    expect(ok.error).toBeNull();
    uploaded.push(own);

    const foreign = `${b.id}/intruso.webp`;
    const denied = await clientA.storage
      .from('avatars')
      .upload(foreign, WEBP(), { contentType: 'image/webp' });
    expect(denied.error).not.toBeNull();
    uploaded.push(foreign);

    const anon = await anonClient()
      .storage.from('avatars')
      .upload(`${a.id}/anon.webp`, WEBP(), { contentType: 'image/webp' });
    expect(anon.error).not.toBeNull();
    uploaded.push(`${a.id}/anon.webp`);

    const wrongType = await clientA.storage
      .from('avatars')
      .upload(`${a.id}/x.png`, new Blob(['x'], { type: 'image/png' }), {
        contentType: 'image/png',
      });
    expect(wrongType.error).not.toBeNull();

    // Lectura pública por URL, sin sesión.
    const { data } = anonClient().storage.from('avatars').getPublicUrl(own);
    expect((await fetch(data.publicUrl)).status).toBe(200);

    // B no puede borrar el archivo de A; A sí el suyo.
    const present = async () =>
      ((await adminClient().storage.from('avatars').list(a.id)).data ?? []).length;
    await clientB.storage.from('avatars').remove([own]);
    expect(await present()).toBeGreaterThan(0);
    expect((await clientA.storage.from('avatars').remove([own])).error).toBeNull();
    // (la URL pública puede seguir sirviéndose unos minutos desde la caché del CDN)
    expect(await present()).toBe(0);
  });
});

describe('seller_profiles', () => {
  const sellerRow = (userId: string, patch: object = {}) => ({
    user_id: userId,
    slug: slug(),
    shop_name: 'Mi tienda',
    bio: 'Cartas',
    city: 'Puebla',
    payment_instructions: 'CLABE 0123456789',
    ...patch,
  });

  it('el dueño crea y lee la suya; no puede crear la de otro; el slug es único y no reservado', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const clientA = await signInAs(a);

    const row = sellerRow(a.id);
    expect((await clientA.from('seller_profiles').insert(row)).error).toBeNull();
    const { data } = await clientA.from('seller_profiles').select('*').eq('user_id', a.id).single();
    expect(data).toMatchObject({ slug: row.slug, payment_instructions: 'CLABE 0123456789' });

    const forB = await clientA.from('seller_profiles').insert(sellerRow(b.id));
    expect(forB.error).not.toBeNull();

    const clientB = await signInAs(b);
    const dup = await clientB.from('seller_profiles').insert(sellerRow(b.id, { slug: row.slug }));
    expect(dup.error?.code).toBe('23505');
    const reserved = await clientB
      .from('seller_profiles')
      .insert(sellerRow(b.id, { slug: 'dashboard' }));
    expect(reserved.error?.code).toBe('23514');
    const badSlug = await clientB
      .from('seller_profiles')
      .insert(sellerRow(b.id, { slug: 'Mal Slug' }));
    expect(badSlug.error?.code).toBe('23514');
  });

  it('el slug es inmutable para el cliente; lo demás se edita', async () => {
    const a = await createTestUser();
    const client = await signInAs(a);
    const row = sellerRow(a.id);
    await client.from('seller_profiles').insert(row);

    expect(
      (await client.from('seller_profiles').update({ slug: slug() }).eq('user_id', a.id)).error,
    ).not.toBeNull();
    expect(
      (
        await client
          .from('seller_profiles')
          .update({ shop_name: 'Nuevo nombre' })
          .eq('user_id', a.id)
      ).error,
    ).toBeNull();
    const { data } = await adminClient()
      .from('seller_profiles')
      .select('shop_name, slug')
      .eq('user_id', a.id)
      .single();
    expect(data).toEqual({ shop_name: 'Nuevo nombre', slug: row.slug });
  });

  it('payment_instructions no es legible por anon ni por otro usuario', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const row = sellerRow(a.id);
    await (await signInAs(a)).from('seller_profiles').insert(row);

    const anon = anonClient();
    const direct = await anon
      .from('seller_profiles')
      .select('payment_instructions')
      .eq('user_id', a.id);
    expect(direct.error !== null || (direct.data ?? []).length === 0).toBe(true);

    const other = await (
      await signInAs(b)
    )
      .from('seller_profiles')
      .select('payment_instructions')
      .eq('user_id', a.id);
    expect(other.data ?? []).toHaveLength(0);

    const view = await anon
      .from('public_seller_profiles')
      .select('*')
      .eq('slug', row.slug)
      .single();
    expect(view.data).toMatchObject({ slug: row.slug, shop_name: 'Mi tienda', city: 'Puebla' });
    expect(Object.keys(view.data ?? {})).not.toContain('payment_instructions');
    const column = await anon
      .from('public_seller_profiles')
      .select('payment_instructions')
      .eq('slug', row.slug);
    expect(column.error).not.toBeNull();
  });

  it('is_slug_available: libre, tomado, reservado y mal formado', async () => {
    const a = await createTestUser();
    const row = sellerRow(a.id);
    await (await signInAs(a)).from('seller_profiles').insert(row);
    const anon = anonClient();
    const check = async (value: string) =>
      (await anon.rpc('is_slug_available', { p_slug: value })).data;
    expect(await check(slug())).toBe(true);
    expect(await check(row.slug)).toBe(false);
    expect(await check('dashboard')).toBe(false);
    expect(await check('Mal Slug')).toBe(false);
  });
});
