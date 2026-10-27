import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  createLiveSession,
  createTestSeller,
  rpc as rawRpc,
  type TestSeller,
} from '../tests/helpers/claims';
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';
import { waitForCaptcha } from '../tests/helpers/e2e';
import { auditSession } from '../tests/helpers/claims';
import { createTestUser, type TestUser } from '../tests/helpers/users';

// S7-03, S7-06, S7-08, S7-09: la consola del vendedor operando un evento con compradores reales.

let seller: TestSeller;

/** Las RPC devuelven `{ok:false}` sin lanzar: aquí un rechazo inesperado rompe el test en su origen. */
async function rpc(...args: Parameters<typeof rawRpc>) {
  const result = await rawRpc(...args);
  expect(result, `${args[1]} → ${result.code} ${result.message}`).toMatchObject({ ok: true });
  return result;
}

test.beforeAll(async () => {
  seller = await createTestSeller();
});

test.afterAll(async () => {
  await cleanupTestData(supabaseCleanupStore());
});

async function loginAs(page: Page, user: TestUser, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await waitForCaptcha(page).catch(() => undefined);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`**${next}`);
}

async function buyer(name: string) {
  return createTestUser({ displayName: name });
}

async function buyerClient(user: TestUser) {
  const { signInAs } = await import('../tests/helpers/users');
  return signInAs(user);
}

async function codeOf(sessionId: string) {
  const { data } = await seller.client
    .from('claim_sessions')
    .select('code')
    .eq('id', sessionId)
    .single();
  return data!.code as string;
}

async function consolePage(
  browser: Browser,
  sessionId: string,
  viewport?: { width: number; height: number },
) {
  const context = await browser.newContext(viewport ? { viewport } : undefined);
  const page = await context.newPage();
  await loginAs(page, seller.user, `/dashboard/claims/${sessionId}/live`);
  return { page, context };
}

test('un vendedor ajeno recibe 404 y un anónimo va a iniciar sesión', async ({ page, browser }) => {
  const live = await createLiveSession(seller, { items: 1 });
  await page.goto(`/dashboard/claims/${live.sessionId}/live`);
  await expect(page).toHaveURL(/\/login/);

  const other = await createTestSeller();
  const context = await browser.newContext();
  const otherPage = await context.newPage();
  await loginAs(otherPage, other.user, '/dashboard/claims');
  await otherPage.goto(`/dashboard/claims/${live.sessionId}/live`);
  await expect(otherPage.getByText('404')).toBeVisible();
  await context.close();
});

test('iniciar y terminar con confirmación; el visor público lo refleja en vivo (S7-02)', async ({
  browser,
}) => {
  const live = await createLiveSession(seller, { items: 1, live: false });
  const code = await codeOf(live.sessionId);
  const { page } = await consolePage(browser, live.sessionId);

  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  await viewer.goto(`/c/${code}`);

  await page.getByRole('button', { name: 'Iniciar claim' }).click();
  await page.getByRole('button', { name: 'Sí, continuar' }).click();
  await expect(page.getByRole('button', { name: 'Terminar claim' })).toBeVisible();
  await expect(viewer.getByRole('heading', { name: 'Carta 1' })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Terminar claim' }).click();
  await page.getByRole('button', { name: 'Sí, continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Resumen del claim' })).toBeVisible();
  await viewerContext.close();
});

test('con auto_confirm desactivado: rechaza al primero, el segundo pasa a líder y se confirma; las ofertas venden al monto (S7-03)', async ({
  browser,
}) => {
  const live = await createLiveSession(seller, { items: 2, autoConfirm: false });
  const [first, second] = [await buyer('Primera'), await buyer('Segundo')];
  const [c1, c2] = [await buyerClient(first), await buyerClient(second)];
  const [itemA, itemB] = live.itemIds as [string, string];
  const { page } = await consolePage(browser, live.sessionId);

  await rpc(c1, 'claim_item', { p_item_id: itemA });
  await rpc(c2, 'claim_item', { p_item_id: itemA });
  await expect(page.getByText('Primera').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Segundo').first()).toBeVisible();

  const rowA = page.locator(`#item-${itemA}`);
  await rowA.getByRole('button', { name: 'Rechazar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Rechazar' }).click();
  await expect(rowA.getByRole('button', { name: 'Dar «tuyo»' })).toBeVisible();
  await rowA.getByRole('button', { name: 'Dar «tuyo»' }).click();
  await expect(rowA.getByText(/Vendida a Segundo/)).toBeVisible({ timeout: 10_000 });

  // Oferta aceptada: se vende al monto ofertado.
  await rpc(c1, 'make_offer', { p_item_id: itemB, p_amount_cents: 9_000 });
  const rowB = page.locator(`#item-${itemB}`);
  await expect(rowB.getByText(/\$90\.00 de \$150\.00/)).toBeVisible({ timeout: 10_000 });
  await rowB.getByRole('button', { name: 'Aceptar oferta' }).click();
  await expect(rowB.getByText(/Vendida a Primera por \$90\.00/)).toBeVisible({ timeout: 10_000 });
});

test('liberación manual y anuncio (S7-04, S7-05)', async ({ browser }) => {
  const live = await createLiveSession(seller, { items: 2, releaseMode: 'manual' });
  const code = await codeOf(live.sessionId);
  const { page } = await consolePage(browser, live.sessionId);
  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  await viewer.goto(`/c/${code}`);

  await expect(page.getByText('2 cartas por salir.')).toBeVisible();
  await page.getByRole('button', { name: 'Sacar la siguiente' }).click();
  await expect(viewer.getByRole('heading', { name: 'Carta 1' })).toBeVisible({ timeout: 10_000 });

  await page.getByLabel('Mensaje para los compradores').fill('Salen más en 10 minutos');
  await page.getByRole('button', { name: 'Publicar anuncio' }).click();
  await expect(viewer.getByText('Salen más en 10 minutos')).toBeVisible({ timeout: 5_000 });
  await viewerContext.close();
});

test('móvil a 360 px: sin scroll horizontal y acciones con objetivo táctil ≥ 44 px (S7-06)', async ({
  browser,
}) => {
  const live = await createLiveSession(seller, { items: 1, autoConfirm: false });
  const c1 = await buyerClient(await buyer('Móvil'));
  await rpc(c1, 'claim_item', { p_item_id: live.itemIds[0] });
  const { page, context } = await consolePage(browser, live.sessionId, { width: 360, height: 740 });

  const confirm = page.getByRole('button', { name: 'Dar «tuyo»' });
  await expect(confirm).toBeVisible({ timeout: 10_000 });
  expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole('tab', { name: 'Actividad' }).click();
  await expect(page.getByLabel('Mensaje para los compradores')).toBeVisible();
  await context.close();
});

test('operación completa con tres compradores y extensión del cierre (S7-08, S7-09)', async ({
  browser,
}) => {
  const closesAt = new Date(Date.now() + 60 * 3_600_000).toISOString();
  const live = await createLiveSession(seller, { items: 3, autoConfirm: false, closesAt });
  const code = await codeOf(live.sessionId);
  const users = await Promise.all([buyer('Ana'), buyer('Beto'), buyer('Caro')]);
  const clients = await Promise.all(users.map(buyerClient));
  const [a, b, c] = live.itemIds as [string, string, string];
  const { page } = await consolePage(browser, live.sessionId);

  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  await viewer.goto(`/c/${code}`);

  // Extender el cierre con el evento en vivo.
  const newClose = new Date(Date.now() + 72 * 3_600_000);
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'short',
    timeStyle: 'short',
  })
    .format(newClose)
    .replace(' ', 'T');
  await page.getByLabel('Nueva hora de cierre').fill(local);
  await page.getByRole('button', { name: 'Extender cierre' }).click();
  await page.getByRole('button', { name: 'Sí, continuar' }).click();
  await expect(page.getByText(/Moviste el cierre/)).toBeVisible({ timeout: 10_000 });
  await expect(viewer.getByText(/movió el cierre/)).toBeVisible({ timeout: 10_000 });

  // Competencia y confirmaciones.
  await rpc(clients[0]!, 'claim_item', { p_item_id: a });
  await rpc(clients[1]!, 'claim_item', { p_item_id: a });
  await rpc(clients[2]!, 'claim_item', { p_item_id: b });
  await page.locator(`#item-${a}`).getByRole('button', { name: 'Dar «tuyo»' }).click();
  await expect(page.locator(`#item-${a}`).getByText(/Vendida a Ana/)).toBeVisible({
    timeout: 10_000,
  });
  await page.locator(`#item-${b}`).getByRole('button', { name: 'Dar «tuyo»' }).click();
  await expect(page.locator(`#item-${b}`).getByText(/Vendida a Caro/)).toBeVisible({
    timeout: 10_000,
  });

  // Retiro con intentos abiertos.
  await rpc(clients[0]!, 'claim_item', { p_item_id: c });
  await page.locator(`#item-${c}`).getByRole('button', { name: 'Retirar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, continuar' }).click();
  await expect(page.locator(`#item-${c}`).getByText('Retirada').first()).toBeVisible({
    timeout: 10_000,
  });

  // Término y resumen.
  await page.getByRole('button', { name: 'Terminar claim' }).click();
  await page.getByRole('button', { name: 'Sí, continuar' }).click();
  await expect(page.getByText('2 cartas vendidas')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Ana', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cuentas' })).toBeDisabled();

  expect(await auditSession(live.sessionId)).toEqual([]);
  await viewerContext.close();
});
