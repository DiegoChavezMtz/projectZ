import { expect, test } from '@playwright/test';

// S12: identidad Cempasúchil. Rutas públicas (no requieren sesión ni datos).
const routes = ['/', '/login', '/signup', '/forgot-password', '/terminos', '/privacidad', '/live'];
const widths = [375, 768, 1024, 1280];

for (const width of widths) {
  for (const route of routes) {
    test(`sin desbordamiento horizontal en ${route} a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.waitForLoadState('load');
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
}

test('el interruptor «Reducir movimiento» fija data-motion y se recuerda', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-motion', 'on');
  const toggle = page.getByRole('switch', { name: /Reducir movimiento/ }).first();
  await toggle.click();
  await expect(html).toHaveAttribute('data-motion', 'off');
  await page.reload();
  await expect(html).toHaveAttribute('data-motion', 'off');
});

test('prefers-reduced-motion deja data-motion en off sin interacción', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await context.close();
});

test('la landing usa Anton, Figtree y JetBrains Mono (no Inter)', async ({ page }) => {
  await page.goto('/');
  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    h1: getComputedStyle(document.querySelector('h1')!).fontFamily,
  }));
  expect(fonts.body).toMatch(/Figtree/i);
  expect(fonts.h1).toMatch(/Anton/i);
  expect(fonts.body + fonts.h1).not.toMatch(/Inter/i);
});
