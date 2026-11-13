import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Landing sin sesión: claims reales abiertos/próximos (o el estado vacío con la muestra de ejemplo).
test('la landing muestra claims reales o el estado vacío, sin sesión', async ({ page }) => {
  await page.goto('/');
  const real = page.getByRole('heading', { level: 2, name: 'Claims abiertos y próximos' });
  const empty = page.getByRole('heading', {
    level: 2,
    name: 'Por ahora no hay claims abiertos ni próximos',
  });
  await expect(real.or(empty)).toBeVisible();
  if (await empty.isVisible())
    await expect(page.getByText('Ejemplo', { exact: true })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/personas viendo|\d+ viendo/i);
});

for (const width of [375, 768, 1280]) {
  test(`landing sin desbordamiento horizontal ni scroll interno a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('load');
    const m = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      scrollers: [...document.querySelectorAll('body *')]
        .filter((el) => {
          const s = getComputedStyle(el);
          return (
            ['auto', 'scroll'].includes(s.overflowX) &&
            el.scrollWidth > el.clientWidth + 1 &&
            el.getBoundingClientRect().width > 0
          );
        })
        .map((el) => el.className.toString().slice(0, 40)),
    }));
    expect(m.scrollWidth).toBeLessThanOrEqual(width);
    expect(m.scrollers).toEqual([]);
  });
}

test('axe: sin violaciones críticas ni serias en la landing', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('load');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) =>
    ['critical', 'serious'].includes(v.impact ?? ''),
  );
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
