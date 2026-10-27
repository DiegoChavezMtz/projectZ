import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createLiveSession, createTestSeller, rpc, type TestSeller } from '../tests/helpers/claims';
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';
import { waitForCaptcha } from '../tests/helpers/e2e';
import { createTestUser, type TestUser } from '../tests/helpers/users';

// S6-14: los tres estados del visor y el flujo del comprador, con dos navegadores compitiendo.

let seller: TestSeller;

test.beforeAll(async () => {
  seller = await createTestSeller();
});

test.afterAll(async () => {
  await cleanupTestData(supabaseCleanupStore());
});

async function codeOf(sessionId: string) {
  const { data } = await seller.client
    .from('claim_sessions')
    .select('code')
    .eq('id', sessionId)
    .single();
  return data!.code as string;
}

async function loginAs(page: Page, user: TestUser, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await waitForCaptcha(page).catch(() => undefined);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function buyerPage(browser: Browser, path: string) {
  const user = await createTestUser({
    displayName: `Comprador ${Math.floor(Math.random() * 1000)}`,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, user, path);
  await page.waitForURL(`**${path}`);
  return { user, page, context };
}

test('programado: portada con cuenta regresiva, calendario y panel de ayuda (SSR)', async ({
  page,
  request,
}) => {
  const live = await createLiveSession(seller, { items: 2, live: false });
  const code = await codeOf(live.sessionId);
  // Antes de empezar el público solo ve los artículos de adelanto (RLS).
  await seller.client.from('claim_items').update({ is_preview: true }).in('id', live.itemIds);

  // El HTML inicial ya trae los artículos.
  const html = await (await request.get(`/c/${code}`)).text();
  expect(html).toContain('Carta 1');
  expect(html).toContain('Carta 2');

  await page.goto(`/c/${code}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Claim de prueba' })).toBeVisible();
  await expect(page.getByText('Próximamente').first()).toBeVisible();
  await expect(page.getByText(/Empieza en/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Google Calendar/ })).toHaveAttribute(
    'href',
    /calendar\.google\.com/,
  );
  await expect(page.getByRole('link', { name: /Descargar \.ics/ })).toHaveAttribute(
    'href',
    `/c/${code}/calendar.ics`,
  );
  await expect(page.getByRole('region', { name: '¿Cómo funciona un claim?' })).toBeVisible();

  // El descarte se recuerda.
  await page.getByRole('button', { name: 'Entendido' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '¿Cómo funciona un claim?' })).toBeVisible();
  await expect(page.getByRole('region', { name: '¿Cómo funciona un claim?' })).toHaveCount(0);

  // El .ics es válido y trae la alarma de 10 minutos.
  const ics = await request.get(`/c/${code}/calendar.ics`);
  expect(ics.status()).toBe(200);
  expect(ics.headers()['content-type']).toContain('text/calendar');
  expect(await ics.text()).toContain('TRIGGER:-PT10M');
});

test('un código desconocido muestra la página 404 (con streaming el estado HTTP puede ser 200, con noindex)', async ({
  page,
}) => {
  await page.goto('/c/NOEXISTE');
  await expect(page.getByText('404')).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
});

test('en vivo: artículos, filtros, y un visitante sin sesión va al login con ancla', async ({
  page,
}) => {
  const live = await createLiveSession(seller, { items: 3 });
  const code = await codeOf(live.sessionId);
  await page.goto(`/c/${code}`);

  await expect(page.getByText('En vivo')).toBeVisible();
  await expect(page.locator('li[id^="item-"]')).toHaveCount(3);

  await page.getByLabel('Buscar por nombre').fill('carta 2');
  await expect(page.locator('li[id^="item-"]')).toHaveCount(1);
  await page.getByLabel('Buscar por nombre').fill('zzz');
  await expect(page.getByText('Ninguna coincide con tu búsqueda.')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('li[id^="item-"]')).toHaveCount(3);

  await page.getByRole('button', { name: 'Hacer claim' }).first().click();
  await page.waitForURL(/\/login\?next=/);
  expect(decodeURIComponent(new URL(page.url()).searchParams.get('next') ?? '')).toBe(
    `/c/${code}#item-${live.itemIds[0]}`,
  );
});

test('dos compradores reclaman casi a la vez: uno gana y el otro lo ve sin recargar', async ({
  browser,
}) => {
  test.slow();
  const live = await createLiveSession(seller, { items: 1, autoConfirm: true });
  const code = await codeOf(live.sessionId);
  const path = `/c/${code}`;
  const a = await buyerPage(browser, path);
  const b = await buyerPage(browser, path);

  await expect(a.page.getByRole('button', { name: 'Hacer claim' })).toBeVisible();
  await expect(b.page.getByRole('button', { name: 'Hacer claim' })).toBeVisible();
  // Esperar a que el realtime esté conectado en ambos (el banner solo aparece si no lo está).
  await a.page.waitForTimeout(2_500);

  await Promise.all([
    a.page.getByRole('button', { name: 'Hacer claim' }).click(),
    b.page.getByRole('button', { name: 'Hacer claim' }).click(),
  ]);

  // Cada uno termina con un estado coherente y sin recargar: uno "Es tuya", el otro "Vendida" sin acciones.
  const won = (p: Page) => p.getByRole('status').filter({ hasText: 'Es tuya' });
  await expect
    .poll(async () => (await won(a.page).count()) + (await won(b.page).count()), {
      timeout: 20_000,
    })
    .toBe(1);
  for (const p of [a.page, b.page]) {
    await expect(p.getByText('Vendida', { exact: true })).toBeVisible();
    await expect(p.getByRole('button', { name: 'Hacer claim' })).toHaveCount(0);
  }
  await expect(a.page.getByText(/pasó a|hizo claim/).first()).toBeVisible();

  await a.context.close();
  await b.context.close();
});

test('comprador: claim, oferta inválida/válida y retiro', async ({ browser }) => {
  test.slow();
  const live = await createLiveSession(seller, {
    items: 2,
    autoConfirm: false,
    priceCents: 20_000,
  });
  const code = await codeOf(live.sessionId);
  const { page, context } = await buyerPage(browser, `/c/${code}`);
  await page.waitForTimeout(2_500);

  const first = page.getByRole('listitem').filter({ hasText: 'Carta 1' });
  await first.getByRole('button', { name: 'Hacer claim' }).click();
  await expect(first.getByRole('status')).toContainText('Vas primero');
  await expect(first.getByText('Reclamada')).toBeVisible();

  const second = page.getByRole('listitem').filter({ hasText: 'Carta 2' });
  await second.getByRole('button', { name: 'Ofertar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tu oferta (MXN)').fill('300');
  await dialog.getByRole('button', { name: 'Enviar oferta' }).click();
  await expect(dialog.getByText(/menor al precio publicado/)).toBeVisible();
  await dialog.getByLabel('Tu oferta (MXN)').fill('150');
  await dialog.getByRole('button', { name: 'Enviar oferta' }).click();
  await expect(dialog).toBeHidden();
  await expect(second.getByRole('status')).toContainText('Tu oferta está pendiente');

  await first.getByRole('button', { name: 'Retirar mi claim' }).click();
  await expect(first.getByRole('button', { name: 'Hacer claim' })).toBeVisible();

  await page.getByRole('button', { name: 'Mis intentos' }).click();
  await expect(page.locator('li[id^="item-"]')).toHaveCount(1);
  await context.close();
});

test('el vendedor del evento no ve acciones de compra', async ({ browser }) => {
  const live = await createLiveSession(seller, { items: 1 });
  const code = await codeOf(live.sessionId);
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, seller.user, `/c/${code}`);
  await page.waitForURL(`**/c/${code}`);
  await expect(page.getByText('Es tu claim')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hacer claim' })).toHaveCount(0);
  await context.close();
});

test('terminado: resumen de vendidos y no vendidos, y el estado cambia sin recargar', async ({
  page,
  browser,
}) => {
  test.slow();
  const live = await createLiveSession(seller, { items: 2, autoConfirm: true });
  const code = await codeOf(live.sessionId);
  const buyer = await buyerPage(browser, `/c/${code}`);
  await buyer.page.waitForTimeout(2_500);
  await buyer.page
    .getByRole('listitem')
    .filter({ hasText: 'Carta 1' })
    .getByRole('button', { name: 'Hacer claim' })
    .click();
  await expect(buyer.page.getByRole('status').filter({ hasText: 'Es tuya' })).toBeVisible();

  await page.goto(`/c/${code}`);
  await expect(page.getByText('En vivo')).toBeVisible();

  expect((await rpc(seller.client, 'end_session', { p_session_id: live.sessionId })).ok).toBe(true);

  // Sin recargar, ambos pasan al resumen.
  for (const p of [page, buyer.page]) {
    await expect(p.getByRole('heading', { name: /Vendidas/ })).toBeVisible({ timeout: 20_000 });
    await expect(p.getByRole('heading', { name: 'Sin vender' })).toBeVisible();
  }
  // Lo que se ve en pantalla solo trae nombres públicos: nada de correos ni ids.
  const visible = await page.locator('body').innerText();
  expect(visible).not.toContain(buyer.user.id);
  expect(visible).not.toContain(buyer.user.email);
  expect(await page.content()).not.toContain(buyer.user.email);
  await buyer.context.close();
});

test.describe('accesibilidad', () => {
  for (const viewport of [
    { name: '360 px', width: 360, height: 740 },
    { name: '1280 px', width: 1280, height: 800 },
  ]) {
    test(`axe sin violaciones críticas en programado, en vivo y terminado (${viewport.name})`, async ({
      page,
    }) => {
      test.slow();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const scheduled = await createLiveSession(seller, { items: 2, live: false });
      const live = await createLiveSession(seller, { items: 2 });
      const ended = await createLiveSession(seller, { items: 2 });
      await rpc(seller.client, 'end_session', { p_session_id: ended.sessionId });

      for (const session of [scheduled, live, ended]) {
        await page.goto(`/c/${await codeOf(session.sessionId)}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.waitForTimeout(1_000);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        const serious = results.violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious',
        );
        expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
        // Sin scroll horizontal.
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      }
    });
  }

  test('con teclado se llega al botón de claim y se anuncia el estado', async ({ page }) => {
    const live = await createLiveSession(seller, { items: 1 });
    await page.goto(`/c/${await codeOf(live.sessionId)}`);
    const claim = page.getByRole('button', { name: 'Hacer claim' });
    await expect(claim).toBeVisible();
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      if (await claim.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(claim).toBeFocused();
  });
});
