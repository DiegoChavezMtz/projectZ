import { expect, test } from '@playwright/test';

test('la app responde en español de México con tema oscuro', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-MX');
  await expect(page).toHaveTitle(/Zlotify/);
});

test('una ruta inexistente muestra el 404 global', async ({ page }) => {
  const response = await page.goto('/esta-ruta-no-existe');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { level: 1, name: 'No encontramos esta página' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir al inicio' })).toBeVisible();
});
