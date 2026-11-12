import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';
import { sessionRow } from '../tests/helpers/claims';
import { waitForCaptcha } from '../tests/helpers/e2e';
import { adminClient } from '../tests/helpers/supabase';
import { createTestUser } from '../tests/helpers/users';

// S11-11: modo escáner con cámara simulada (dispositivo de medios falso de Chromium): capturar, poner precio,
// subir, recargar a mitad de la subida, revisar por lotes, y la alternativa de archivo sin permiso de cámara.

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

async function sellerWithDraft(page: Page) {
  const user = await createTestUser({ displayName: 'Vendedora Escáner' });
  userIds.push(user.id);
  const admin = adminClient();
  const { error } = await admin
    .from('seller_profiles')
    .insert({ user_id: user.id, slug: `t-${randomUUID().slice(0, 8)}`, shop_name: 'Tienda e2e' });
  if (error) throw error;
  const { data: session, error: sessionError } = await admin
    .from('claim_sessions')
    .insert(sessionRow(user.id))
    .select('id')
    .single();
  if (sessionError) throw sessionError;
  await page.goto('/login?next=/dashboard/claims');
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await waitForCaptcha(page).catch(() => undefined);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/dashboard/claims');
  await expect(page.getByRole('heading', { name: 'Tus claims' })).toBeVisible();
  return { user, sessionId: session!.id };
}

const itemsOf = async (sessionId: string) =>
  (
    await adminClient()
      .from('claim_items')
      .select('*')
      .eq('session_id', sessionId)
      .order('position')
  ).data ?? [];

/** Dispara la cámara y completa el recorte (si se abrió) y el precio. `price = null` omite el precio. */
async function capture(page: Page, price: string | null) {
  await page.getByRole('button', { name: 'Tomar foto', exact: true }).click();
  const done = page.getByRole('button', { name: 'Listo', exact: true });
  const apply = page.getByRole('button', { name: 'Aplicar recorte' });
  await expect(done.or(apply)).toBeVisible({ timeout: 30_000 });
  if (await apply.isVisible()) {
    await apply.click();
    await expect(done).toBeVisible({ timeout: 30_000 });
  }
  if (price === null) await page.getByRole('button', { name: 'Omitir precio' }).click();
  else {
    for (const ch of price)
      await page
        .getByRole('button', { name: ch === '.' ? 'Punto decimal' : ch, exact: true })
        .click();
    await done.click();
  }
}

// Dispositivo de medios falso de Chromium (video de prueba) y permiso de cámara concedido.
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
});

test.describe('con cámara simulada', () => {
  test('captura 3 piezas, las sube, recarga a mitad de subida sin perder nada y revisa por lotes', async ({
    page,
  }) => {
    const { sessionId } = await sellerWithDraft(page);
    await page.goto(`/dashboard/claims/${sessionId}/scanner`);
    await expect(page.getByRole('button', { name: 'Tomar foto', exact: true })).toBeEnabled({
      timeout: 30_000,
    });

    // Axe sobre la vista de captura.
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === 'critical')).toEqual([]);

    await capture(page, '1550.50');
    await capture(page, '99');
    await capture(page, null);
    await expect(page.getByTestId('strip-item')).toHaveCount(3);
    await expect(page.getByTestId('strip-item').filter({ hasText: 'lista' })).toHaveCount(3, {
      timeout: 60_000,
    });

    const items = await itemsOf(sessionId);
    expect(items.map((i) => i.price_cents)).toEqual([155050, 9900, 0]);
    expect(items.every((i) => i.status === 'hidden' && i.image_path)).toBe(true);
    expect(items.map((i) => i.title)).toEqual(['Carta 1', 'Carta 2', 'Carta 3']);

    // Recarga a mitad de la subida: se corta la red de las Server Actions, se captura, se recarga y se restablece.
    await page.route('**/dashboard/claims/**', (route) =>
      route.request().headers()['next-action'] ? route.abort() : route.continue(),
    );
    await capture(page, '10');
    await expect(page.getByTestId('strip-item')).toHaveCount(4);
    await page.unroute('**/dashboard/claims/**');
    await page.reload();
    await expect(page.getByTestId('strip-item').last()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('strip-item').filter({ hasText: 'lista' })).toHaveCount(4, {
      timeout: 60_000,
    });
    const afterReload = await itemsOf(sessionId);
    expect(afterReload).toHaveLength(4); // ninguna perdida, ninguna duplicada
    expect(afterReload[3]!.price_cents).toBe(1000);

    // Revisión por lotes: marca incompleta, edición con teclado (título y nota) y precio a la pieza sin precio.
    await page.getByRole('button', { name: 'Revisar capturas' }).click();
    await expect(page.getByRole('heading', { name: 'Revisión por lotes' })).toBeVisible();
    await expect(page.getByTestId('review-row')).toHaveCount(4);
    await expect(page.getByText('4 en total. 1 incompletas.')).toBeVisible();
    const third = page.getByTestId('review-row').nth(2);
    await third.getByLabel('Título').fill('Mew ex');
    await third.getByLabel('Nota del vendedor').fill('Cartas del Centro, 2 nov');
    await third.getByLabel('Precio').fill('420');
    await third.getByLabel('Precio').press('Enter');
    await expect(
      page.getByRole('status').filter({ hasText: 'Cambios guardados: Mew ex' }),
    ).toHaveCount(1);
    await expect(page.getByText('4 en total. Todas completas.')).toBeVisible();
    const edited = (await itemsOf(sessionId))[2]!;
    expect(edited).toMatchObject({
      title: 'Mew ex',
      seller_note: 'Cartas del Centro, 2 nov',
      price_cents: 42000,
    });
  });
});

test.describe('sin cámara disponible', () => {
  test('la alternativa de archivo usa el mismo pipeline', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined }),
    );
    const { sessionId } = await sellerWithDraft(page);
    await page.goto(`/dashboard/claims/${sessionId}/scanner`);
    await expect(page.getByTestId('scanner-file-input')).toBeAttached({ timeout: 30_000 });
    await page
      .getByTestId('scanner-file-input')
      .setInputFiles({ name: 'carta.png', mimeType: 'image/png', buffer: PNG });
    const apply = page.getByRole('button', { name: 'Aplicar recorte' });
    const done = page.getByRole('button', { name: 'Listo', exact: true });
    await expect(done.or(apply)).toBeVisible({ timeout: 30_000 });
    if (await apply.isVisible()) await apply.click();
    for (const ch of '200') await page.getByRole('button', { name: ch, exact: true }).click();
    await done.click();
    await expect(page.getByTestId('strip-item').filter({ hasText: 'lista' })).toHaveCount(1, {
      timeout: 60_000,
    });
    const items = await itemsOf(sessionId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ price_cents: 20000, status: 'hidden' });
  });
});

test.describe('lote grande', () => {
  test('60 piezas en una sesión: todas se procesan, suben y quedan en orden sin degradar', async ({
    page,
  }) => {
    test.setTimeout(420_000);
    const { sessionId } = await sellerWithDraft(page);
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'mediaDevices', { value: undefined }),
    );
    await page.goto(`/dashboard/claims/${sessionId}/scanner`);
    const input = page.getByTestId('scanner-file-input');
    await expect(input).toBeAttached({ timeout: 30_000 });
    await input.setInputFiles(
      Array.from({ length: 60 }, (_, i) => ({
        name: `carta-${i}.png`,
        mimeType: 'image/png',
        buffer: PNG,
      })),
    );
    const apply = page.getByRole('button', { name: 'Aplicar recorte' });
    const skip = page.getByRole('button', { name: 'Omitir precio' });
    const started = Date.now();
    const perPiece: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const t0 = Date.now();
      await expect(apply.or(skip)).toBeVisible({ timeout: 30_000 });
      if (await apply.isVisible()) await apply.click();
      await skip.click();
      perPiece.push(Date.now() - t0);
    }
    await expect(page.getByTestId('strip-item').filter({ hasText: 'lista' })).toHaveCount(60, {
      timeout: 180_000,
    });
    const items = await itemsOf(sessionId);
    expect(items).toHaveLength(60);
    expect(new Set(items.map((i) => i.position)).size).toBe(60); // sin posiciones repetidas pese a las subidas en paralelo
    expect(new Set(items.map((i) => i.image_path)).size).toBe(60); // ninguna imagen duplicada
    const firstTen = perPiece.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
    const lastTen = perPiece.slice(-10).reduce((a, b) => a + b, 0) / 10;
    console.log(
      `60 piezas: total ${Math.round((Date.now() - started) / 1000)} s; por pieza, primeras 10: ${Math.round(firstTen)} ms, últimas 10: ${Math.round(lastTen)} ms`,
    );
    expect(lastTen).toBeLessThan(firstTen * 3 + 500); // sin degradación notable
  });
});
