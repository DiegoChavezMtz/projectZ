import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { adminClient } from '../tests/helpers/supabase';
import { getLastCode } from '../tests/helpers/outbox';
import { cleanupTestData } from '../tests/helpers/cleanup';
import { supabaseCleanupStore } from '../tests/helpers/cleanup.supabase';
import { typeCode, waitForCaptcha } from '../tests/helpers/e2e';
import { createTestUser, TEST_EMAIL_DOMAIN, type TestUser } from '../tests/helpers/users';

// e2e de la auth completa (S3). Correos vía email_outbox; todo con cuentas @test.zlotify.invalid.
// Turnstile corre con las claves de prueba de Cloudflare (playwright.config.ts).

test.afterAll(async () => {
  await cleanupTestData(supabaseCleanupStore());
});

const newEmail = () => `e2e3-${randomUUID().slice(0, 8)}${TEST_EMAIL_DOMAIN}`;

/** Inicia sesión por la UI (el botón se habilita cuando Turnstile entrega su token). */
async function loginUi(page: Page, user: Pick<TestUser, 'email' | 'password'>, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Correo electrónico').fill(user.email);
  await page.getByLabel('Contraseña').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function newSession(browser: Browser, user: TestUser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginUi(page, user);
  await page.waitForURL('/');
  return { context, page };
}

const profileHandle = async (userId: string) =>
  (await adminClient().from('profiles').select('handle').eq('id', userId).single()).data
    ?.handle as string;

test.describe('acceso por código (A5)', () => {
  test('correo → código → sesión', async ({ page }) => {
    const user = await createTestUser();
    await page.goto('/login');
    await page.getByRole('link', { name: 'Entrar con un código' }).click();
    await waitForCaptcha(page);
    await page.getByLabel('Correo electrónico').fill(user.email);
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByText(`Si hay una cuenta con ${user.email}`)).toBeVisible();

    await typeCode(page, await getLastCode(user.email, 'loginCode'));
    await page.waitForURL('/');
    await expect(page.getByRole('button', { name: 'Cerrar sesión' }).first()).toBeAttached();
  });

  test('correo inexistente: misma respuesta, sin correo y sin rastro', async ({ page }) => {
    const ghost = newEmail();
    await page.goto('/login?mode=code');
    await page.getByLabel('Correo electrónico').fill(ghost);
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByText(`Si hay una cuenta con ${ghost}`)).toBeVisible();

    await typeCode(page, '123456');
    await expect(page.getByRole('alert').filter({ hasText: 'Código incorrecto' })).toBeVisible();

    const admin = adminClient();
    const { count: mails } = await admin
      .from('email_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('to_email', ghost);
    const { count: codes } = await admin
      .from('email_codes')
      .select('id', { count: 'exact', head: true })
      .eq('email', ghost);
    expect([mails, codes]).toEqual([0, 0]);
  });
});

test.describe('recuperar contraseña (A7)', () => {
  test('flujo completo, token de un solo uso y otras sesiones invalidadas', async ({
    page,
    browser,
  }) => {
    const user = await createTestUser();
    const other = await newSession(browser, user);

    await page.goto('/forgot-password');
    await page.getByLabel('Correo electrónico').fill(user.email);
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByText(`Si hay una cuenta con ${user.email}`)).toBeVisible();
    await typeCode(page, await getLastCode(user.email, 'resetPassword'));
    await page.waitForURL('/reset-password');

    const cookies = await page.context().cookies();
    const resetCookie = cookies.find((c) => c.name === 'zl_reset');
    expect(resetCookie?.httpOnly).toBe(true);

    await page.getByLabel('Contraseña nueva').fill('Nueva12345');
    await page.getByLabel('Confirma tu contraseña').fill('Distinta1234');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
    await page.getByLabel('Confirma tu contraseña').fill('Nueva12345');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await page.waitForURL(/\/login\?reset=1/);
    await expect(page.getByText('cambiaste tu contraseña')).toBeVisible();

    // Las demás sesiones quedaron inválidas.
    await other.page.goto('/account');
    await expect(other.page).toHaveURL(/\/login/);
    await other.context.close();

    // La contraseña vieja ya no sirve; la nueva sí.
    await loginUi(page, user);
    await expect(page.getByRole('alert').filter({ hasText: 'incorrectos' })).toBeVisible();
    await loginUi(page, { email: user.email, password: 'Nueva12345' });
    await page.waitForURL('/');

    // Reutilizar el token (la cookie ya consumida) falla.
    const replay = await browser.newContext();
    await replay.addCookies([resetCookie!]);
    const replayPage = await replay.newPage();
    await replayPage.goto('/reset-password');
    await replayPage.getByLabel('Contraseña nueva').fill('Otra123456');
    await replayPage.getByLabel('Confirma tu contraseña').fill('Otra123456');
    await replayPage.getByRole('button', { name: 'Guardar contraseña' }).click();
    await replayPage.waitForURL(/\/forgot-password\?error=expired/);
    await replay.close();
  });

  test('/reset-password sin token redirige a /forgot-password', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('correo inexistente: misma pantalla, sin correo', async ({ page }) => {
    const ghost = newEmail();
    await page.goto('/forgot-password');
    await page.getByLabel('Correo electrónico').fill(ghost);
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect(page.getByText(`Si hay una cuenta con ${ghost}`)).toBeVisible();
    const { count } = await adminClient()
      .from('email_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('to_email', ghost);
    expect(count).toBe(0);
  });
});

test.describe('cuenta y seguridad', () => {
  test('cambiar contraseña: la actual incorrecta rechaza; la correcta cambia', async ({ page }) => {
    const user = await createTestUser();
    await loginUi(page, user, '/account/security');
    await page.waitForURL('/account/security');

    const form = page.locator('form', {
      has: page.getByLabel('Contraseña actual', { exact: true }),
    });
    await form.getByLabel('Contraseña actual', { exact: true }).fill('Equivocada1');
    await form.getByLabel('Contraseña nueva', { exact: true }).fill('Cambiada12345');
    await form.getByLabel('Confirma la contraseña nueva').fill('Cambiada12345');
    await form.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'actual es incorrecta' })).toBeVisible();

    await form.getByLabel('Contraseña actual', { exact: true }).fill(user.password);
    await form.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByText('Tu contraseña se actualizó')).toBeVisible();

    await page.context().clearCookies();
    await loginUi(page, { email: user.email, password: 'Cambiada12345' });
    await page.waitForURL('/');
  });

  test('cambiar correo: código al correo nuevo, el viejo sigue vigente hasta verificar', async ({
    page,
  }) => {
    const user = await createTestUser();
    const newAddress = newEmail();
    await loginUi(page, user, '/account/security');
    await page.waitForURL('/account/security');

    await page.getByLabel('Correo nuevo').fill(newAddress);
    await page.getByLabel('Tu contraseña actual').last().fill(user.password);
    await page.getByRole('button', { name: 'Enviar código al correo nuevo' }).click();
    await expect(page.getByText(`Pendiente de verificación: ${newAddress}`)).toBeVisible();

    // Mientras no se verifica, el correo vigente sigue siendo el viejo.
    await page.goto('/account');
    await expect(page.getByText(user.email)).toBeVisible();
    await page.goto('/account/security');
    await expect(page.getByText(`Pendiente de verificación: ${newAddress}`)).toBeVisible();

    await typeCode(page, await getLastCode(newAddress, 'changeEmail'));
    await page.waitForURL(/email=changed/);
    await expect(page.getByText('tu correo se actualizó')).toBeVisible();
    await page.goto('/account');
    await expect(page.getByText(newAddress)).toBeVisible();
  });

  test('cerrar sesión en todos los dispositivos invalida las demás sesiones', async ({
    page,
    browser,
  }) => {
    const user = await createTestUser();
    const other = await newSession(browser, user);
    await loginUi(page, user, '/account/security');
    await page.waitForURL('/account/security');

    await page.getByRole('button', { name: 'Cerrar en todos los dispositivos' }).click();
    await page.getByRole('button', { name: 'Sí, cerrar todo' }).click();
    await page.waitForURL(/\/login\?signedOut=1/);

    await other.page.goto('/account');
    await expect(other.page).toHaveURL(/\/login/);
    await other.context.close();
  });

  test('eliminar cuenta: pide el handle, cierra la sesión y el correo puede registrarse otra vez', async ({
    page,
  }) => {
    const user = await createTestUser();
    const handle = await profileHandle(user.id);
    await loginUi(page, user, '/account/security');
    await page.waitForURL('/account/security');

    await page.getByRole('button', { name: 'Eliminar mi cuenta' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre de usuario').fill('otro_usuario');
    await dialog.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await expect(dialog.getByRole('alert').filter({ hasText: 'no coincide' })).toBeVisible();

    await dialog.getByLabel('Nombre de usuario').fill(handle);
    await dialog.getByRole('button', { name: 'Eliminar definitivamente' }).click();
    await page.waitForURL(/account=deleted/);

    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
    expect((await adminClient().auth.admin.getUserById(user.id)).data.user).toBeNull();
    const again = await adminClient().auth.admin.createUser({
      email: user.email,
      password: 'Abc12345',
      email_confirm: true,
    });
    expect(again.error).toBeNull();
  });
});

test.describe('términos pendientes (OAuth y acceso por código)', () => {
  test('sin aceptación todo lleva a /onboarding/terms; al aceptar se continúa', async ({
    page,
  }) => {
    test.slow();
    const user = await createTestUser();
    await adminClient().from('profiles').update({ accepted_terms_at: null }).eq('id', user.id);

    await loginUi(page, user, '/account');
    // Tras la acción de login el router puede conservar la URL pedida; lo que importa es la pantalla.
    await expect(page.getByRole('heading', { name: 'Acepta los términos' })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto('/account');
    await expect(page).toHaveURL(/\/onboarding\/terms\?next=%2Faccount/);
    await page.goto('/account/security');
    await expect(page).toHaveURL(/\/onboarding\/terms/);

    // Lo legal sigue accesible.
    await page.goto('/terminos');
    await expect(page.getByRole('heading', { name: 'Términos y condiciones' })).toBeVisible();

    await page.goto('/onboarding/terms?next=%2Faccount');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText('Debes aceptar los términos')).toBeVisible();
    await page.getByLabel(/Acepto los/).check();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.waitForURL('/account');
    const { data } = await adminClient()
      .from('profiles')
      .select('accepted_terms_at')
      .eq('id', user.id)
      .single();
    expect(data?.accepted_terms_at).not.toBeNull();
  });
});

test.describe('legal y protección', () => {
  test('/terminos y /privacidad son públicas y cubren las secciones técnicas', async ({ page }) => {
    await page.goto('/terminos');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Términos y condiciones' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Comprobantes de pago' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Historial de cumplimiento y marcas de impago' }),
    ).toBeVisible();
    await page.goto('/privacidad');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Política de privacidad' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Datos de dirección' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Conservación tras eliminar tu cuenta' }),
    ).toBeVisible();
  });

  test('el signup y el footer enlazan a las páginas legales', async ({ page }) => {
    await page.goto('/signup');
    await expect(
      page.getByRole('link', { name: 'términos y condiciones', exact: true }),
    ).toHaveAttribute('href', '/terminos');
    await expect(
      page.getByRole('link', { name: 'política de privacidad', exact: true }),
    ).toHaveAttribute('href', '/privacidad');
    await expect(
      page.getByRole('link', { name: 'Términos y condiciones', exact: true }),
    ).toHaveAttribute('href', '/terminos');
  });

  test('rutas de cuenta sin sesión llevan a /login', async ({ page }) => {
    await page.goto('/account/security');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fsecurity/);
    await page.goto('/onboarding/terms');
    await expect(page).toHaveURL(/\/login/);
  });

  test('sin la verificación de seguridad no se puede enviar el formulario', async ({ page }) => {
    await page.route('**/challenges.cloudflare.com/**', (route) => route.abort());
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('a@b.co');
    await page.getByLabel('Contraseña').fill('Abc12345');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    await expect(
      page.getByRole('alert').filter({ hasText: 'verificación de seguridad' }),
    ).toBeVisible();
  });

  test('Google: el botón existe en login y signup', async ({ page }) => {
    for (const path of ['/login', '/signup']) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
    }
    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/login\?error=oauth_failed/);
    await page.goto('/auth/callback?error=access_denied');
    await expect(page).toHaveURL(/\/login\?error=oauth_cancelled/);
    await expect(page.getByText('Cancelaste el acceso con Google.')).toBeVisible();
  });
});
