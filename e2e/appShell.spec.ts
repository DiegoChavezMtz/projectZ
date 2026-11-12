import { expect, test, type Page } from '@playwright/test';
import { createLiveSession, createTestSeller, type TestSeller } from '../tests/helpers/claims';
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';
import { waitForCaptcha } from '../tests/helpers/e2e';
import { adminClient } from '../tests/helpers/supabase';
import { createTestUser, type TestUser } from '../tests/helpers/users';

// S13: shell de la app. Cuentas is_test (se borran al terminar). Capturas opcionales con SHOTS_DIR.
const SHOTS = process.env.SHOTS_DIR;
const widths = [360, 375, 414, 768, 1280];
const publicRoutes = ['/', '/login', '/signup'];
const sellerRoutes = [
  '/dashboard',
  '/dashboard/claims',
  '/dashboard/orders',
  '/dashboard/settings',
  '/orders',
  '/orders/history',
  '/account',
  '/account/security',
];

let seller: TestSeller;
let buyer: TestUser;

test.beforeAll(async () => {
  seller = await createTestSeller();
  // Datos largos sin espacios: lo que más suele romper el ancho en móvil.
  const long = 'Tienda'.padEnd(58, 'W');
  await adminClient()
    .from('seller_profiles')
    .update({ shop_name: long, bio: 'B'.repeat(200), city: 'C'.repeat(60) })
    .eq('user_id', seller.user.id);
  await createLiveSession(seller, { items: 4, patch: { title: 'T'.repeat(70) } });
  buyer = await createTestUser();
});
test.afterAll(async () => {
  await cleanupTestData(supabaseCleanupStore());
});

async function login(page: Page, user: TestUser, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await waitForCaptcha(page).catch(() => undefined);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`**${next}`);
}

/**
 * `body` usa `overflow-x: clip`, que oculta el desbordamiento en vez de eliminarlo: además de `scrollWidth`
 * se buscan elementos que se salen del viewport sin estar dentro de un contenedor con scroll propio.
 */
/** `expected` es el ancho del dispositivo: en emulación móvil, un desbordamiento agranda `innerWidth` y lo oculta. */
const overflow = (page: Page, expected: number) =>
  page.evaluate((width) => {
    const innerWidth = window.innerWidth;
    const scrollsOrClips = (el: Element | null): boolean => {
      for (
        let node = el?.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        const x = getComputedStyle(node).overflowX;
        if (x !== 'visible') return true;
      }
      return false;
    };
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (r.width === 0 || style.position === 'fixed' || style.clip !== 'auto') return false;
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return (r.right > width + 1 || r.left < -1) && !scrollsOrClips(el);
      })
      .slice(0, 5)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}→${Math.round(el.getBoundingClientRect().right)}`,
      );
    // Contenedores con scroll horizontal interno visibles (filas de filtros, tablas…): tampoco se permiten.
    const scrollers = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const style = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || style.display === 'none') return false;
        if (style.visibility === 'hidden' || style.position === 'fixed') return false;
        return ['auto', 'scroll'].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
      })
      .slice(0, 5)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} ${el.scrollWidth}>${el.clientWidth}`,
      );
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth, offenders, scrollers };
  }, expected);

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

for (const width of widths) {
  test.describe(`${width}px`, () => {
    // Emulación de teléfono real (viewport meta, táctil) por debajo de 768 px.
    test.use({ isMobile: width < 768, hasTouch: width < 768 });

    test(`sin scroll horizontal a ${width}px (pública y app)`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width, height: 800 });
      const rows: string[] = [];
      const check = async (route: string, label = route) => {
        await page.goto(route);
        await page.waitForLoadState('load');
        await page.waitForTimeout(600);
        const m = await overflow(page, width);
        rows.push(
          `${width}\t${label}\t${m.scrollWidth}\t${m.innerWidth}\t${m.offenders.join(' | ')}\t${m.scrollers.join(' | ')}`,
        );
        await shot(page, `${width}${label.replaceAll('/', '_')}`);
        expect.soft(m.scrollers, `${label} a ${width}px: scroll horizontal interno`).toEqual([]);
        expect.soft(m.offenders, `${label} a ${width}px: elementos fuera del viewport`).toEqual([]);
        expect
          .soft(Math.max(m.scrollWidth, m.innerWidth), `${label} a ${width}px`)
          .toBeLessThanOrEqual(width);
      };

      for (const route of publicRoutes) await check(route);
      await login(page, seller.user, '/dashboard');
      for (const route of sellerRoutes) await check(route);
      // Sin tienda: el onboarding vive en el shell, con el menú bloqueado.
      await page.context().clearCookies();
      await login(page, buyer, '/orders');
      await check('/onboarding/seller');
      console.log(
        `\nancho\truta\tscrollWidth\tinnerWidth\toffenders\tscrollers\n${rows.join('\n')}`,
      );
    });
  });
}

test.use({ isMobile: true, hasTouch: true });
test('móvil: el menú es un riel pegado al borde izquierdo y se expande sobre el contenido', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await login(page, seller.user, '/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible();
  const side = page.getByRole('complementary', { name: /Menú lateral/ });
  await expect(side).toBeVisible();
  const box = (await side.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBeLessThanOrEqual(64);
  for (const link of await side.getByRole('link').all()) {
    const b = (await link.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  // El contenido no queda tapado por el riel
  const main = (await page.getByRole('main').boundingBox())!;
  const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
  expect(h1.x).toBeGreaterThanOrEqual(box.x + box.width);
  expect(main.x).toBe(0);
  await shot(page, '375_rail');

  const toggle = side.locator('button').first(); // «Expandir el menú» / «Contraer el menú»
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => (await side.boundingBox())!.width).toBeGreaterThan(180);
  await expect(side.getByRole('link', { name: 'Resumen' })).toHaveAttribute('aria-current', 'page');
  await shot(page, '375_expanded');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();

  await toggle.click();
  await page.mouse.click(360, 600); // toque fuera: sobre el velo
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('el detector encuentra un scroll horizontal interno (autoprueba)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/login');
  await page.evaluate(() => {
    const row = document.createElement('div');
    row.style.cssText = 'overflow-x:auto;width:200px';
    row.innerHTML = '<div style="width:600px;height:20px">fila ancha</div>';
    document.body.prepend(row);
  });
  const m = await overflow(page, 375);
  expect(m.scrollers.length).toBeGreaterThan(0);
});
