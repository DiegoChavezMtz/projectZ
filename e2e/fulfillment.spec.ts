import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  createTestBuyers,
  createTestSeller,
  rpc,
  type TestBuyer,
  type TestSeller,
} from '../tests/helpers/claims';
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';
import { waitForCaptcha } from '../tests/helpers/e2e';
import {
  ADDRESS,
  PNG,
  closeAndPay,
  daysFromNow,
  endedSession,
  processDeadlines,
} from '../tests/helpers/fulfillment';
import { adminClient } from '../tests/helpers/supabase';
import type { TestUser } from '../tests/helpers/users';

// S8-16 y S8-19: el flujo de cumplimiento completo con la interfaz real (vendedor y comprador en
// contextos separados). Los datos de partida se preparan por RPC; las acciones bajo prueba van por la UI.

let seller: TestSeller;
let buyer: TestBuyer;

test.beforeAll(async () => {
  seller = await createTestSeller();
  buyer = (await createTestBuyers(1))[0]!;
  await adminClient()
    .from('seller_profiles')
    .update({ payment_instructions: 'Titular: Tienda de prueba\nCLABE: 012345678901234567' })
    .eq('user_id', seller.user.id);
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
  await page.waitForURL(`**${next.split('?')[0]}**`);
}

async function session(browser: Browser, user: TestUser, next: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, user, next);
  return { page, context };
}

const proofFile = { name: 'comprobante.png', mimeType: 'image/png', buffer: PNG };

async function fillAddress(page: Page) {
  await page.getByLabel('Nombre de quien recibe').fill(ADDRESS.recipient);
  await page.getByLabel('Teléfono').fill(ADDRESS.phone);
  await page.getByLabel('Calle').fill(ADDRESS.street);
  await page.getByLabel('Número exterior').fill(ADDRESS.exterior);
  await page.getByLabel('Colonia').fill(ADDRESS.neighborhood);
  await page.getByLabel('Ciudad').fill(ADDRESS.city);
  await page.getByLabel('Estado').fill(ADDRESS.state);
  await page.getByLabel('Código postal').fill(ADDRESS.postal_code);
}

test('S8-16: cierre con envío, comprobante, confirmación, envío y recepción', async ({
  browser,
}) => {
  const { live, orders } = await endedSession(seller, [buyer], [2]);
  const orderId = orders[0]!.id;
  const sellerSession = await session(browser, seller.user, '/dashboard/orders');
  const buyerSession = await session(browser, buyer.user, `/orders/${orderId}`);
  const [s, b] = [sellerSession.page, buyerSession.page];

  // El comprador aún no puede pagar: el vendedor no ha cerrado la cuenta.
  await expect(b.getByText('El vendedor está armando tu cuenta')).toBeVisible();

  // Vendedor cierra con envío de $80.
  await s.reload();
  await s.getByLabel('Costo de envío (MXN)').fill('80');
  await s.getByRole('button', { name: 'Cerrar cuenta' }).click();
  await expect(s.getByText('Cuenta cerrada')).toBeVisible();

  // Comprador: ve el total con envío, las instrucciones y sube su comprobante con dirección.
  await b.reload();
  await expect(b.getByText('$280.00').first()).toBeVisible();
  await expect(b.getByText('CLABE: 012345678901234567')).toBeVisible();
  await fillAddress(b);
  await b.getByLabel('Archivo del comprobante').setInputFiles(proofFile);
  await b.getByRole('button', { name: 'Enviar comprobante' }).click();
  await expect(b.getByText('Comprobante enviado')).toBeVisible();
  await expect(b.getByText('En revisión').first()).toBeVisible();

  // Vendedor revisa y confirma el pago; la entrega queda por enviar.
  await s.goto('/dashboard/orders?tab=toReview');
  await s.getByRole('button', { name: 'Confirmar pago' }).click();
  await expect(s.getByText('Pago confirmado')).toBeVisible();
  await s.goto('/dashboard/orders?tab=toShip');
  await expect(s.getByText(ADDRESS.recipient, { exact: false })).toBeVisible();
  await s.getByLabel('Guía de rastreo (opcional)').fill('MX123456');
  await s.getByRole('button', { name: 'Marcar enviado' }).click();
  await expect(s.getByText('Avisamos al comprador')).toBeVisible();

  // Comprador confirma la recepción.
  await b.reload();
  await expect(b.getByText('Guía de rastreo: MX123456')).toBeVisible();
  await b.getByRole('button', { name: 'Ya lo recibí' }).click();
  await expect(b.getByText('Entrega confirmada')).toBeVisible();

  const { data } = await adminClient()
    .from('orders')
    .select('completed_at')
    .eq('id', orderId)
    .single();
  expect(data?.completed_at).not.toBeNull();
  expect(live.sessionId).toBeTruthy();
  await sellerSession.context.close();
  await buyerSession.context.close();
});

test('S8-16: entrega en persona sin costo y rechazo de comprobante con motivo', async ({
  browser,
}) => {
  const { orders } = await endedSession(seller, [buyer], [1]);
  const orderId = orders[0]!.id;
  await rpc(seller.client, 'close_order', {
    p_order_id: orderId,
    p_delivery_method: 'pickup',
    p_shipping_cents: 0,
  });

  const sellerSession = await session(browser, seller.user, '/dashboard/orders?tab=toReview');
  const buyerSession = await session(browser, buyer.user, `/orders/${orderId}`);
  const [s, b] = [sellerSession.page, buyerSession.page];

  await b.getByLabel('Archivo del comprobante').setInputFiles(proofFile);
  await b.getByRole('button', { name: 'Enviar comprobante' }).click();
  await expect(b.getByText('Comprobante enviado')).toBeVisible();

  await s.reload();
  await s.getByRole('button', { name: 'Rechazar', exact: true }).click();
  await s.getByLabel('Motivo del rechazo').fill('No se alcanza a leer');
  await s.getByRole('button', { name: 'Rechazar comprobante' }).click();
  await expect(s.getByText('Comprobante rechazado')).toBeVisible();

  await b.reload();
  await expect(b.getByText('Rechazado')).toBeVisible();
  await expect(b.getByText('Motivo: No se alcanza a leer')).toBeVisible();
  await sellerSession.context.close();
  await buyerSession.context.close();
});

test('S8-16: impago por vencimiento con reloj simulado y objeción visible', async ({ browser }) => {
  const { orders } = await endedSession(seller, [buyer], [1]);
  const orderId = orders[0]!.id;
  await rpc(seller.client, 'close_order', {
    p_order_id: orderId,
    p_delivery_method: 'pickup',
    p_shipping_cents: 0,
  });
  await processDeadlines(daysFromNow(5));

  const buyerSession = await session(browser, buyer.user, `/orders/${orderId}`);
  const b = buyerSession.page;
  await expect(b.getByText('Esta cuenta venció sin pago')).toBeVisible();
  await b.getByLabel('Cuéntanos qué pasó').fill('Pagué por otro medio');
  await b.getByRole('button', { name: 'Enviar objeción' }).click();
  await expect(b.getByText('Objeción enviada')).toBeVisible();
  await expect(b.getByText('Pagué por otro medio')).toBeVisible();

  const { data } = await adminClient()
    .from('public_disputes')
    .select('note')
    .eq('order_id', orderId);
  expect(data).toEqual([{ note: 'Pagué por otro medio' }]);
  await buyerSession.context.close();
});

test('S8-19: guardadito de dos eventos en una entrega, cotización y pago del envío', async ({
  browser,
}) => {
  const patch = { allow_accumulate: true };
  const a = await endedSession(seller, [buyer], [1], { patch });
  const c = await endedSession(seller, [buyer], [1], { patch });
  await closeAndPay(seller, buyer, a.orders[0]!, { accumulate: true });
  const second = await closeAndPay(seller, buyer, c.orders[0]!, { accumulate: true });

  const buyerSession = await session(browser, buyer.user, '/orders');
  const sellerSession = await session(browser, seller.user, '/dashboard/orders?tab=toQuote');
  const [b, s] = [buyerSession.page, sellerSession.page];

  await expect(b.getByRole('heading', { name: 'Guardadito' })).toBeVisible();
  await b.getByRole('checkbox').first().check();
  await b.getByRole('checkbox').nth(1).check();
  await fillAddress(b);
  await b.getByRole('button', { name: 'Pedir envío' }).click();
  await expect(b.getByText('Envío solicitado')).toBeVisible();

  await s.reload();
  await s.getByLabel('Costo del envío (MXN)').fill('90');
  await s.getByRole('button', { name: 'Enviar cotización' }).click();
  await expect(s.getByText('Cotización enviada')).toBeVisible();

  await b.goto(`/orders/${second.id}`);
  await expect(b.getByText('$90.00').first()).toBeVisible();
  await b.getByLabel('Archivo del comprobante').setInputFiles(proofFile);
  await b.getByRole('button', { name: 'Enviar comprobante' }).click();
  await expect(b.getByText('Comprobante enviado')).toBeVisible();

  await s.goto('/dashboard/orders?tab=toReview');
  await s.getByRole('button', { name: 'Confirmar pago' }).click();
  await expect(s.getByText('Pago confirmado')).toBeVisible();
  await s.goto('/dashboard/orders?tab=toShip');
  await expect(s.getByText('2 cuentas').first()).toBeVisible();
  await sellerSession.context.close();
  await buyerSession.context.close();
});

test('S8-19: alerta de vencimiento y liberación voluntaria; liberación por falta de confirmación', async ({
  browser,
}) => {
  const patch = { allow_accumulate: true, accumulate_days: 30 };
  const voluntary = await endedSession(seller, [buyer], [1], { patch });
  const paid = await closeAndPay(seller, buyer, voluntary.orders[0]!, { accumulate: true });
  const until = new Date(paid.accumulate_until!);
  await processDeadlines(new Date(until.getTime() + 3_600_000)); // alerta de vencimiento

  const buyerSession = await session(browser, buyer.user, `/orders/${paid.id}`);
  const b = buyerSession.page;
  await expect(b.getByText('La vigencia terminó')).toBeVisible();
  await expect(b.getByRole('button', { name: 'Confirmar mi envío' })).toBeVisible();
  await b.getByRole('button', { name: 'No puedo / necesito más tiempo' }).click();
  await expect(b.getByText('Las piezas volverán al vendedor')).toBeVisible();
  await b.getByRole('button', { name: 'Sí, liberar' }).click();
  await expect(b.getByText('Este guardadito se liberó')).toBeVisible();

  // Variante: nadie confirma dentro de los 3 días de gracia.
  const silent = await endedSession(seller, [buyer], [1], { patch });
  const silentPaid = await closeAndPay(seller, buyer, silent.orders[0]!, { accumulate: true });
  const silentUntil = new Date(silentPaid.accumulate_until!);
  await processDeadlines(new Date(silentUntil.getTime() + 3_600_000));
  await processDeadlines(new Date(silentUntil.getTime() + 4 * 86_400_000));
  await b.goto(`/orders/${silentPaid.id}`);
  await expect(b.getByText('Este guardadito se liberó')).toBeVisible();

  const sellerSession = await session(browser, seller.user, '/dashboard/orders?tab=released');
  await expect(sellerSession.page.getByText('Liberada el').first()).toBeVisible();
  await sellerSession.context.close();
  await buyerSession.context.close();
});
