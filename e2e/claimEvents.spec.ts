import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';
import { waitForCaptcha } from '../tests/helpers/e2e';
import { adminClient } from '../tests/helpers/supabase';
import { createTestUser } from '../tests/helpers/users';

// S4-13: el vendedor crea un claim, agrega artículos con imagen, reordena, publica y revisa los bloqueos.

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const userIds: string[] = [];

test.afterAll(async () => {
  const admin = adminClient();
  for (const id of userIds) {
    const { data: folders } = await admin.storage.from('item-images').list(id);
    for (const folder of folders ?? []) {
      const { data: files } = await admin.storage.from('item-images').list(`${id}/${folder.name}`);
      if (files?.length)
        await admin.storage
          .from('item-images')
          .remove(files.map((f) => `${id}/${folder.name}/${f.name}`));
    }
  }
  await cleanupTestData(supabaseCleanupStore());
});

/** Espera a que React haya hidratado el formulario (escribir antes se pierde). */
const waitHydrated = (page: Page) =>
  page.waitForFunction(() =>
    [...document.querySelectorAll('form')].some((f) =>
      Object.keys(f).some((k) => k.startsWith('__reactProps')),
    ),
  );

async function sellerSession(page: Page) {
  const user = await createTestUser({ displayName: 'Vendedora Claims' });
  userIds.push(user.id);
  const { error } = await adminClient()
    .from('seller_profiles')
    .insert({ user_id: user.id, slug: `t-${randomUUID().slice(0, 8)}`, shop_name: 'Tienda e2e' });
  if (error) throw error;
  await page.goto('/login?next=/dashboard/claims');
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await waitForCaptcha(page).catch(() => undefined);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/dashboard/claims');
  return user;
}

const nextYear = () => `${new Date().getFullYear() + 1}-03-15T20:00`;

async function addItem(page: Page, title: string, price: string) {
  await page.getByRole('button', { name: 'Agregar carta' }).click();
  const dialog = page.getByRole('dialog');
  await waitHydrated(page);
  await dialog
    .getByTestId('item-image-input')
    .setInputFiles({ name: 'carta.png', mimeType: 'image/png', buffer: PNG });
  await expect(dialog.getByRole('button', { name: 'Cambiar imagen' })).toBeVisible();
  await dialog.getByLabel('Nombre').fill(title);
  await dialog.getByLabel('Precio (MXN)').fill(price);
  await dialog.getByLabel('Idioma').selectOption('es');
  await dialog.getByLabel('Condición').selectOption('NM');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('item-row').filter({ hasText: title })).toBeVisible();
}

test('vendedor: crea, agrega artículos, reordena, publica y ve los campos bloqueados', async ({
  page,
}) => {
  test.slow();
  const user = await sellerSession(page);

  // Lista vacía.
  await expect(page.getByRole('heading', { name: 'Aún no tienes claims' })).toBeVisible();

  // Crear el evento.
  await page.getByRole('link', { name: 'Nuevo claim' }).first().click();
  await waitHydrated(page);
  await page.getByLabel('Título').fill('Claim de viernes');
  await page.getByLabel('Fecha y hora de inicio').fill(nextYear());
  // Validación de plazos fuera de rango.
  await page.getByLabel('Plazo para cerrar cuentas (horas)').fill('500');
  await page.getByRole('button', { name: 'Crear y agregar artículos' }).click();
  await expect(page.getByText('Debe estar entre 1 y 168.')).toBeVisible();
  await page.getByLabel('Plazo para cerrar cuentas (horas)').fill('24');
  await page.getByRole('button', { name: 'Crear y agregar artículos' }).click();
  await page.waitForURL(/\/dashboard\/claims\/[0-9a-f-]+\/edit/);
  const sessionId = page.url().split('/').at(-2)!;

  // Sin artículos no se puede publicar.
  await waitHydrated(page);
  await expect(page.getByRole('button', { name: 'Publicar claim' })).toBeDisabled();
  await expect(page.getByText('Agrega al menos un artículo.')).toBeVisible();

  // Artículos con imagen; $1,550.50 → 155050 centavos.
  await addItem(page, 'Charizard', '$1,550.50');
  await addItem(page, 'Pikachu', '200');
  const { data: items } = await adminClient()
    .from('claim_items')
    .select('title, price_cents, position, image_path')
    .eq('session_id', sessionId)
    .order('position');
  expect(items?.map((i) => [i.title, i.price_cents, i.position])).toEqual([
    ['Charizard', 155050, 1],
    ['Pikachu', 20000, 2],
  ]);
  expect(items?.every((i) => i.image_path?.startsWith(`${user.id}/${sessionId}/`))).toBe(true);

  // Reordenar con el teclado (botones) y comprobar que persiste.
  await page.getByRole('button', { name: 'Subir Pikachu' }).click();
  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from('claim_items')
        .select('title')
        .eq('session_id', sessionId)
        .order('position');
      return data?.map((i) => i.title);
    })
    .toEqual(['Pikachu', 'Charizard']);
  await page.reload();
  await expect(page.getByTestId('item-row').first()).toContainText('Pikachu');

  // Imágenes: reemplazar borra el objeto anterior; duplicar copia; eliminar borra (sin huérfanos).
  const storedFiles = async () => {
    const admin = adminClient();
    const { data } = await admin.storage.from('item-images').list(`${user.id}/${sessionId}`);
    return (data ?? []).map((f) => f.name);
  };
  const before = await storedFiles();
  expect(before).toHaveLength(2);
  await waitHydrated(page);
  const pikachu = page.getByTestId('item-row').filter({ hasText: 'Pikachu' });
  await pikachu.getByRole('button', { name: 'Editar' }).click();
  await page
    .getByRole('dialog')
    .getByTestId('item-image-input')
    .setInputFiles({ name: 'otra.png', mimeType: 'image/png', buffer: PNG });
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Cambiar imagen' }),
  ).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect.poll(async () => (await storedFiles()).length).toBe(2);
  expect((await storedFiles()).sort()).not.toEqual(before.sort());

  await page
    .getByTestId('item-row')
    .filter({ hasText: 'Pikachu' })
    .getByRole('button', { name: 'Duplicar' })
    .click();
  await expect(page.getByTestId('item-row')).toHaveCount(3);
  await expect.poll(async () => (await storedFiles()).length).toBe(3);
  await page.getByTestId('item-row').last().getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByTestId('item-row')).toHaveCount(2);
  await expect.poll(async () => (await storedFiles()).length).toBe(2);

  // Publicar y compartir.
  await waitHydrated(page);
  await page.getByRole('button', { name: 'Publicar claim' }).click();
  await expect(page.getByRole('heading', { name: 'Tu claim está publicado' })).toBeVisible();
  const { data: session } = await adminClient()
    .from('claim_sessions')
    .select('code, status')
    .eq('id', sessionId)
    .single();
  expect(session?.status).toBe('scheduled');
  await expect(page.getByLabel('Enlace público')).toHaveValue(new RegExp(`/c/${session?.code}$`));

  // Campos bloqueados tras publicar.
  await page.reload();
  await waitHydrated(page);
  await expect(page.getByLabel('Plazo para cerrar cuentas (horas)')).toBeDisabled();
  await expect(page.getByLabel('Liberación de artículos')).toBeDisabled();
  await expect(page.getByText(/Este claim ya está publicado/)).toBeVisible();
  await page.getByLabel('Título').fill('Claim de viernes (editado)');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cambios guardados.')).toBeVisible();

  // En la lista aparece como programado.
  await page.goto('/dashboard/claims?status=scheduled');
  await expect(page.getByRole('heading', { name: 'Claim de viernes (editado)' })).toBeVisible();
  await expect(page.getByText('2 cartas')).toBeVisible();
});

// S5-13: cierre programado y vigencia del guardadito en el editor.
test('vendedor: programa el cierre y la vigencia del guardadito, y mueve el cierre tras publicar', async ({
  page,
}) => {
  test.slow();
  await sellerSession(page);
  const year = new Date().getFullYear() + 1;

  await page.getByRole('link', { name: 'Nuevo claim' }).first().click();
  await waitHydrated(page);
  await page.getByLabel('Título').fill('Claim de fin de semana');
  await page.getByLabel('Fecha y hora de inicio').fill(`${year}-03-15T20:00`);

  // Combinaciones inválidas: cierre antes del inicio y vigencia fuera de rango.
  await page.getByLabel('Cierre programado (opcional)').fill(`${year}-03-15T10:00`);
  await expect(page.getByLabel('Vigencia del guardadito (días)')).toHaveCount(0);
  await page.getByLabel('Permitir juntar cuentas en una sola entrega').check();
  await page.getByLabel('Vigencia del guardadito (días)').fill('10');
  await page.getByRole('button', { name: 'Crear y agregar artículos' }).click();
  await expect(page.getByText('El cierre debe ser posterior al inicio.')).toBeVisible();
  await expect(page.getByText('Debe estar entre 30 y 120.')).toBeVisible();

  // Valores válidos: cierre 24 h después del inicio (36 h de ventana total) y 90 días de vigencia.
  await page.getByLabel('Cierre programado (opcional)').fill(`${year}-03-16T20:00`);
  await page.getByLabel('Vigencia del guardadito (días)').fill('90');
  await page.getByRole('button', { name: 'Crear y agregar artículos' }).click();
  await page.waitForURL(/\/dashboard\/claims\/[0-9a-f-]+\/edit/);
  const sessionId = page.url().split('/').at(-2)!;

  const stored = async () => {
    const { data } = await adminClient()
      .from('claim_sessions')
      .select('starts_at, closes_at, accumulate_days, allow_accumulate, status')
      .eq('id', sessionId)
      .single();
    return data!;
  };
  const created = await stored();
  expect(created.accumulate_days).toBe(90);
  expect(created.allow_accumulate).toBe(true);
  expect(new Date(created.closes_at!).getTime() - new Date(created.starts_at).getTime()).toBe(
    24 * 3_600_000,
  );

  // Publicar y mover el cierre: la vigencia queda bloqueada, el cierre sigue editable.
  await waitHydrated(page);
  await addItem(page, 'Charizard', '1500');
  await page.getByRole('button', { name: 'Publicar claim' }).click();
  await expect(page.getByRole('heading', { name: 'Tu claim está publicado' })).toBeVisible();
  await page.reload();
  await waitHydrated(page);
  await expect(page.getByLabel('Vigencia del guardadito (días)')).toBeDisabled();
  await expect(page.getByLabel('Cierre programado (opcional)')).toBeEnabled();

  await page.getByLabel('Cierre programado (opcional)').fill(`${year}-03-15T19:00`);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('El cierre debe ser posterior al inicio.')).toBeVisible();

  await page.getByLabel('Cierre programado (opcional)').fill(`${year}-03-17T08:00`);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cambios guardados.')).toBeVisible();
  const moved = await stored();
  expect(moved.status).toBe('scheduled');
  expect(new Date(moved.closes_at!).getTime() - new Date(moved.starts_at).getTime()).toBe(
    36 * 3_600_000,
  );
  expect(moved.accumulate_days).toBe(90);

  // Quitar el cierre mientras está programado.
  await page.getByLabel('Cierre programado (opcional)').fill('');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  // El aviso de guardado del paso anterior sigue en pantalla: se espera el valor en la BD.
  await expect.poll(async () => (await stored()).closes_at).toBeNull();
});
