import type { Page } from '@playwright/test';

/**
 * Teclea el código de 6 dígitos. Antes de la hidratación el auto-envío se pierde, así que se espera al token de
 * Turnstile (solo aparece cuando React ya hidrató y el widget se resolvió). No se usa `networkidle`: el widget
 * mantiene tráfico abierto.
 */
export async function typeCode(page: Page, code: string) {
  await waitForCaptcha(page);
  await page.getByLabel('Dígito 1 de 6').click();
  await page.keyboard.type(code);
}

/** Espera a que React haya hidratado y algún widget de Turnstile tenga token (escribir antes se pierde). */
export async function waitForCaptcha(page: Page) {
  // Con la navegación del cliente la página anterior puede seguir montada (oculta), así que basta con que
  // algún widget tenga token.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll<HTMLInputElement>('input[name="captchaToken"]')].some(
        (i) => i.value,
      ),
    undefined,
    { timeout: 20_000 },
  );
}
