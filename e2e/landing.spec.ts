import { expect, test } from '@playwright/test';

test('la landing carga con su contenido renderizado en servidor', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('Reclama tus cartas favoritas');
  expect(html).toContain('application/ld+json');

  await page.goto('/');
  await expect(page).toHaveTitle(/Zlotify/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('el CTA primario navega a /signup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Crear cuenta' }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
});

test('el ancla desplaza a "Cómo funciona"', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Ver cómo funciona' }).click();
  await expect(page).toHaveURL(/#como-funciona$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Cómo funciona' })).toBeInViewport();
});

test('el acordeón de preguntas funciona con teclado', async ({ page }) => {
  await page.goto('/');
  const summary = page.locator('summary', { hasText: '¿Qué es un claim?' });
  const answer = page.getByText('Es un evento de venta en vivo');
  await expect(answer).toBeHidden();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(answer).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(answer).toBeHidden();
});

test('el menú móvil abre y cierra con teclado', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Abrir menú' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(page.getByRole('link', { name: 'Para vendedores' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeFocused();
});

test('robots.txt y sitemap.xml responden', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain('Sitemap:');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain('<urlset');
});

for (const [name, width, height] of [
  ['375', 375, 800],
  ['1280', 1280, 900],
] as const) {
  test(`snapshot visual a ${name}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`landing-${name}.png`, {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });
}
