import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  auditUserStats,
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
  completeOrder,
  endedSession,
  orderById,
  processDeadlines,
} from '../tests/helpers/fulfillment';
import { adminClient } from '../tests/helpers/supabase';
import type { TestUser } from '../tests/helpers/users';

// S9-10: un evento con dos compradores (uno paga a tiempo y completa; el otro vence y objeta), calificaciones
// mutuas por la interfaz y perfiles públicos. Los datos de partida se preparan por RPC.

let seller: TestSeller;
let paying: TestBuyer;
let late: TestBuyer;

test.beforeAll(async () => {
  seller = await createTestSeller();
  [paying, late] = (await createTestBuyers(2)) as [TestBuyer, TestBuyer];
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

const handleOf = async (userId: string) =>
  (await adminClient().from('profiles').select('handle').eq('id', userId).single()).data!
    .handle as string;

test('S9-10: calificaciones mutuas, perfiles públicos, objeción visible y marca revocada', async ({
  browser,
}) => {
  const { orders } = await endedSession(seller, [paying, late], [1, 1]);
  const [payingOrder, lateOrder] = orders as [(typeof orders)[number], (typeof orders)[number]];

  // Comprador A: paga, recibe y completa su cuenta.
  const done = await completeOrder(seller, paying, payingOrder);
  expect(done.completed_at).not.toBeNull();

  // Comprador B: la cuenta vence sin pago y presenta una objeción.
  await rpc(seller.client, 'close_order', {
    p_order_id: lateOrder.id,
    p_delivery_method: 'shipping',
    p_shipping_cents: 5_000,
  });
  const closed = await orderById(lateOrder.id);
  await processDeadlines(new Date(new Date(closed.pay_due_at!).getTime() + 3_600_000));
  expect((await orderById(lateOrder.id)).status).toBe('unpaid');
  expect(
    (
      await rpc(late.client, 'object_unpaid', {
        p_order_id: lateOrder.id,
        p_note: 'Pagué en efectivo',
      })
    ).ok,
  ).toBe(true);

  // El comprador califica al vendedor desde /orders.
  const buyerSession = await session(browser, paying.user, '/orders');
  const b = buyerSession.page;
  await expect(b.getByRole('heading', { name: 'Por calificar' })).toBeVisible();
  await b.getByRole('radio', { name: '5 estrellas' }).check({ force: true });
  await b.getByLabel('Envío rápido').check();
  await b.getByLabel('Comentario (opcional)').fill('Todo perfecto');
  await b.getByRole('button', { name: 'Enviar calificación' }).click();
  await expect(b.getByText('Gracias por calificar')).toBeVisible();
  await b.reload();
  await expect(b.getByRole('heading', { name: 'Por calificar' })).toHaveCount(0);

  // El vendedor califica al comprador desde /dashboard/orders.
  const sellerSession = await session(browser, seller.user, '/dashboard/orders');
  const s = sellerSession.page;
  await expect(s.getByRole('heading', { name: 'Por calificar' })).toBeVisible();
  await s.getByRole('radio', { name: '4 estrellas' }).check({ force: true });
  await s.getByLabel('Pago rápido').check();
  await s.getByRole('button', { name: 'Enviar calificación' }).click();
  await expect(s.getByText('Gracias por calificar')).toBeVisible();

  // Perfiles públicos (visitante sin sesión).
  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto(`/u/${await handleOf(seller.user.id)}`);
  await expect(v.getByText('Miembro desde')).toBeVisible();
  await expect(v.getByText('5.0 de 5 · 1 calificación')).toBeVisible();
  await expect(v.getByText('Recibió 5 estrellas')).toBeVisible();
  await expect(v.getByRole('link', { name: 'Claim de prueba' }).first()).toHaveAttribute(
    'href',
    /\/c\/.+/,
  );
  await expect(v.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  await v.goto(`/u/${await handleOf(paying.user.id)}`);
  await expect(v.getByText('Recibió 4 estrellas')).toBeVisible();
  await expect(v.getByText(/^Pagó en /).first()).toBeVisible();

  // Accesibilidad del perfil del vendedor (con calificaciones, historial y eventos).
  await v.goto(`/u/${await handleOf(seller.user.id)}`);
  await expect(v.getByRole('heading', { level: 1 })).toBeVisible();
  const axe = await new AxeBuilder({ page: v }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.filter((x) => x.impact === 'critical' || x.impact === 'serious')).toEqual(
    [],
  );

  // Objeción visible junto a la marca "No pagó".
  await v.goto(`/u/${await handleOf(late.user.id)}`);
  await expect(v.getByText('No pagó').first()).toBeVisible();
  await expect(v.getByText('En disputa')).toBeVisible();
  await expect(v.getByText('Pagué en efectivo')).toBeVisible();

  // Resolución revoked: la marca desaparece y los contadores se revierten.
  await adminClient().rpc('admin_resolve_dispute', {
    p_order_id: lateOrder.id,
    p_resolution: 'revoked',
    p_note: 'Verificado',
  });
  await v.reload();
  await expect(v.getByText('No pagó')).toHaveCount(0);

  // Handle inexistente: 404.
  expect((await v.goto('/u/no-existe-xyz'))?.status()).toBe(404);

  for (const user of [seller.user, paying.user, late.user]) {
    expect(await auditUserStats(user.id)).toEqual([]);
  }
  await buyerSession.context.close();
  await sellerSession.context.close();
  await visitor.close();
});
