import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { adminClient } from '../tests/helpers/supabase';
import { getLastCode } from '../tests/helpers/outbox';
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';
import { createTestUser, TEST_EMAIL_DOMAIN } from '../tests/helpers/users';

// e2e del núcleo de auth (S2-13). Correos vía email_outbox; todo con cuentas @test.zlotify.invalid.

test.afterAll(async () => {
  await cleanupTestData(supabaseCleanupStore());
});

const newEmail = () => `e2e-${randomUUID().slice(0, 8)}${TEST_EMAIL_DOMAIN}`;
const PASSWORD = 'Abc12345';

async function signUp(page: Page, email: string, next?: string) {
  await page.goto(next ? `/signup?next=${encodeURIComponent(next)}` : '/signup');
  await page.getByLabel('Nombre para mostrar').fill('Ana E2E');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByLabel(/Acepto los/).check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.waitForURL(/\/verify-email/);
}

async function typeCode(page: Page, code: string) {
  // Teclear antes de la hidratación pierde el auto-envío (el servidor de desarrollo es lento bajo carga).
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Dígito 1 de 6').click();
  await page.keyboard.type(code);
}

const wrongCode = (code: string) => (code === '000000' ? '000001' : '000000');

test('registro + código + sesión + logout', async ({ page }) => {
  const email = newEmail();
  await signUp(page, email);
  await expect(page.getByText(email)).toBeVisible();

  await typeCode(page, await getLastCode(email));
  await page.waitForURL('/');
  await expect(page.getByRole('button', { name: 'Cerrar sesión' }).first()).toBeAttached();
  await expect(page.getByRole('link', { name: 'Ana E2E' }).first()).toBeAttached();

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Tu cuenta' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).last().click();
  await page.waitForURL('/');
  await expect(page.getByRole('link', { name: 'Iniciar sesión' }).first()).toBeAttached();
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
});

test('no se puede registrar sin aceptar términos', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Nombre para mostrar').fill('Ana E2E');
  await page.getByLabel('Correo electrónico').fill(newEmail());
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(
    page.getByText('Debes aceptar los términos y la política de privacidad.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

test('código incorrecto, y se puede corregir', async ({ page }) => {
  const email = newEmail();
  await signUp(page, email);
  const code = await getLastCode(email);
  await typeCode(page, wrongCode(code));
  await expect(page.getByRole('alert').filter({ hasText: 'Código incorrecto' })).toBeVisible();
  await typeCode(page, code);
  await page.waitForURL('/');
});

test('código agotado tras 5 intentos', async ({ page }) => {
  const email = newEmail();
  await signUp(page, email);
  const bad = wrongCode(await getLastCode(email));
  for (let i = 0; i < 5; i++) {
    await typeCode(page, bad);
    await expect(
      page.getByRole('alert').filter({ hasText: /Código incorrecto|Agotaste/ }),
    ).toBeVisible();
  }
  await expect(page.getByRole('alert').filter({ hasText: 'Agotaste los intentos' })).toBeVisible();
});

test('código expirado', async ({ page }) => {
  const email = newEmail();
  await signUp(page, email);
  const code = await getLastCode(email);
  await adminClient()
    .from('email_codes')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('email', email);
  await typeCode(page, code);
  await expect(page.getByRole('alert').filter({ hasText: 'El código venció' })).toBeVisible();
});

test('reenvío con cooldown visible', async ({ page }) => {
  const email = newEmail();
  await signUp(page, email);
  const resend = page.getByRole('button', { name: /Reenviar código/ });
  await expect(resend).toBeDisabled();
  await expect(resend).toContainText(/en \d+ s/);
  // El cooldown del servidor (60 s, 5/hora) se prueba en test:db; aquí se valida que sea visible.
});

test('credenciales inválidas: mismo error para correo inexistente y contraseña incorrecta', async ({
  page,
}) => {
  const user = await createTestUser();
  const messages: string[] = [];
  for (const creds of [
    { email: newEmail(), password: PASSWORD },
    { email: user.email, password: 'Incorrecta1' },
  ]) {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(creds.email);
    await page.getByLabel('Contraseña').fill(creds.password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Correo o contraseña incorrectos' });
    await expect(alert).toBeVisible();
    messages.push((await alert.textContent()) ?? '');
  }
  expect(messages[0]).toBe(messages[1]);
});

test('login correcto respeta un next válido y protege rutas', async ({ page }) => {
  const user = await createTestUser();
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('/account');
  await expect(page.getByRole('heading', { name: 'Tu cuenta' })).toBeVisible();

  // Con sesión, /login redirige a /.
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);
});

test('next inseguro se ignora', async ({ page }) => {
  const user = await createTestUser();
  await page.goto('/login?next=//evil.com');
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
});

test('login de un correo sin verificar redirige a verificación', async ({ page }) => {
  const email = newEmail();
  await signUp(page, email);
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/verify-email\?email=/);
  await typeCode(page, await getLastCode(email));
  await page.waitForURL('/');
});
