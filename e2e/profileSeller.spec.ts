import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { adminClient } from '../tests/helpers/supabase';
import { waitForEmail } from '../tests/helpers/outbox';
import { waitForCaptcha } from '../tests/helpers/e2e';
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';
import { createTestUser, type TestUser } from '../tests/helpers/users';

// e2e de perfil, avatar y onboarding de vendedor (S3-08, S3-09).

test.afterAll(async () => {
  const admin = adminClient();
  const { data } = await admin.storage.from('avatars').list();
  for (const folder of data ?? []) {
    const { data: files } = await admin.storage.from('avatars').list(folder.name);
    if (files?.length)
      await admin.storage.from('avatars').remove(files.map((f) => `${folder.name}/${f.name}`));
  }
  await cleanupTestData(supabaseCleanupStore());
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function loginUi(page: Page, user: Pick<TestUser, 'email' | 'password'>, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(next);
}

const handleOf = async (id: string) =>
  (await adminClient().from('profiles').select('handle').eq('id', id).single()).data!.handle;

test.describe('perfil (A10)', () => {
  test('cambia nombre y handle; valida en vivo y rechaza uno ocupado', async ({ page }) => {
    test.slow();
    const user = await createTestUser();
    const other = await createTestUser();
    const taken = await handleOf(other.id);
    await loginUi(page, user, '/account');
    await waitForCaptcha(page).catch(() => undefined);

    const handleField = page.getByLabel('Nombre de usuario');
    await handleField.fill(taken);
    await expect(page.getByText('Ese nombre de usuario no está disponible.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

    await handleField.fill('admin');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Ese nombre de usuario no está disponible.')).toBeVisible();

    const mine = `ana_${randomUUID().slice(0, 6)}`;
    await handleField.fill(mine);
    await expect(page.getByText('Disponible')).toBeVisible();
    await page.getByLabel('Nombre para mostrar').fill('Ana Nueva');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Guardamos tus cambios.')).toBeVisible();

    const { data } = await adminClient()
      .from('profiles')
      .select('handle, display_name')
      .eq('id', user.id)
      .single();
    expect(data).toEqual({ handle: mine, display_name: 'Ana Nueva' });
  });

  test('avatar: se redimensiona a WebP, se sube y aparece en el header', async ({ page }) => {
    test.slow();
    const user = await createTestUser();
    await loginUi(page, user, '/account');

    const input = page.getByLabel('Foto de perfil', { exact: true });
    await input.setInputFiles({
      name: 'nota.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hola'),
    });
    await expect(page.getByText('Elige una imagen JPG, PNG o WebP.')).toBeVisible();

    await input.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('Actualizamos tu foto.')).toBeVisible({ timeout: 30_000 });

    const { data } = await adminClient()
      .from('profiles')
      .select('avatar_path')
      .eq('id', user.id)
      .single();
    expect(data?.avatar_path).toMatch(new RegExp(`^${user.id}/\\d+\\.webp$`));
    const image = page.locator('header img').first();
    await expect(image).toHaveAttribute(
      'src',
      new RegExp(`/storage/v1/object/public/avatars/${user.id}/`),
    );
    const { data: files } = await adminClient().storage.from('avatars').list(user.id);
    expect(files).toHaveLength(1);
  });
});

test.describe('vendedor (A11)', () => {
  test('/dashboard sin tienda lleva al onboarding; crear la tienda lleva al dashboard', async ({
    page,
  }) => {
    test.slow();
    const user = await createTestUser({ displayName: 'Vendedora Uno' });
    await loginUi(page, user, '/');

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/onboarding\/seller/);

    await page.getByRole('link', { name: 'Quiero vender' }).first().click();
    await waitForCaptcha(page).catch(() => undefined);
    await page.getByLabel('Nombre de la tienda').fill('Cartas de Ñandú');
    await expect(page.getByLabel('Enlace de tu tienda')).toHaveValue('cartas-de-nandu');
    const slug = `tienda-${randomUUID().slice(0, 8)}`;
    await page.getByLabel('Enlace de tu tienda').fill(slug);
    await expect(page.getByText('Disponible')).toBeVisible();
    await page.getByLabel('Ciudad').fill('Puebla');
    await page.getByLabel('Instrucciones de pago').fill('Titular Ana. CLABE 012345678901234567');
    await page.getByRole('button', { name: 'Crear mi tienda' }).click();
    await page.waitForURL('/dashboard');
    await expect(page.getByRole('heading', { name: /Tu tienda: Cartas de Ñandú/ })).toBeVisible();

    const { data } = await adminClient()
      .from('seller_profiles')
      .select('slug, city')
      .eq('user_id', user.id)
      .single();
    expect(data).toEqual({ slug, city: 'Puebla' });
    const mail = await waitForEmail(user.email, 'welcome');
    expect(mail.payload).toMatchObject({ isSeller: true });

    // Ya es vendedor: el menú cambia y el onboarding no se repite.
    await expect(page.getByRole('link', { name: 'Mi tienda' }).first()).toBeAttached();
    await page.goto('/onboarding/seller');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('un enlace ocupado o reservado se rechaza', async ({ page }) => {
    test.slow();
    const owner = await createTestUser();
    const takenSlug = `ocupado-${randomUUID().slice(0, 8)}`;
    await adminClient()
      .from('seller_profiles')
      .insert({ user_id: owner.id, slug: takenSlug, shop_name: 'Otra tienda' });

    const user = await createTestUser();
    await loginUi(page, user, '/onboarding/seller');
    await waitForCaptcha(page).catch(() => undefined);
    await page.getByLabel('Nombre de la tienda').fill('Mi tienda');
    await page.getByLabel('Enlace de tu tienda').fill(takenSlug);
    await expect(page.getByText('Ese enlace no está disponible.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear mi tienda' })).toBeDisabled();

    await page.getByLabel('Enlace de tu tienda').fill('dashboard');
    await page.getByRole('button', { name: 'Crear mi tienda' }).click();
    await expect(page.getByText('Ese enlace no está disponible.')).toBeVisible();
  });
});
