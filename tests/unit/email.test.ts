// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { renderEmail, sampleData, templateNames } from '@/lib/email/render';
import { isTestRecipient, sendEmail, type SendDeps } from '@/lib/email/send';
import { AppError } from '@/utils/errors';

const appUrl = 'https://zlotify.test';

function makeDeps(overrides: Partial<SendDeps> = {}) {
  const send = vi.fn().mockResolvedValue(undefined);
  const outbox = vi.fn().mockResolvedValue(undefined);
  const deps: SendDeps = {
    appUrl,
    transport: { send },
    outbox,
    sleep: () => Promise.resolve(),
    ...overrides,
  };
  return { deps, send, outbox };
}

describe('plantillas', () => {
  it.each(templateNames)(
    '%s: html y texto bien formados, sin variables sin resolver',
    (template) => {
      const { subject, html, text } = renderEmail(
        { template, data: sampleData[template] },
        { appUrl },
      );
      expect(subject.length).toBeGreaterThan(0);
      for (const output of [subject, html, text]) {
        expect(output).not.toMatch(/undefined|\[object|\$\{|\{\{|null/);
      }
      expect(html).toContain('max-width:600px');
      expect(html).toContain(`${appUrl}/privacidad`);
      expect(html).toContain('lang="es-MX"');
      expect(html).not.toMatch(/<script/i);
      expect(text).toContain('Si no solicitaste esto, ignora este correo.');
    },
  );

  it('welcome: asunto y texto', () => {
    const seller = renderEmail(
      { template: 'welcome', data: { displayName: 'Ana', isSeller: true } },
      { appUrl },
    );
    expect(seller.subject).toBe('Bienvenido a Zlotify');
    expect(seller.text).toContain('¡Hola, Ana!');
    expect(seller.text).toContain('cuenta de vendedor');

    const buyer = renderEmail(
      { template: 'welcome', data: { displayName: 'Ana', isSeller: false } },
      { appUrl },
    );
    expect(buyer.text).not.toContain('vendedor');
  });

  it('escapa HTML del contenido dinámico', () => {
    const { html } = renderEmail(
      { template: 'welcome', data: { displayName: '<img src=x onerror=1>', isSeller: false } },
      { appUrl },
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});

describe('enrutamiento de envío', () => {
  const message = (to: string) => ({
    to,
    template: 'welcome' as const,
    data: { displayName: 'Test', isSeller: false },
  });

  it('detecta el dominio reservado de pruebas', () => {
    expect(isTestRecipient('a@test.zlotify.invalid')).toBe(true);
    expect(isTestRecipient(' A@TEST.ZLOTIFY.INVALID ')).toBe(true);
    expect(isTestRecipient('a@zlotify.com')).toBe(false);
    expect(isTestRecipient('a@test.zlotify.invalid.evil.com')).toBe(false);
  });

  it('destinatarios @test.zlotify.invalid van al outbox y nunca al transporte', async () => {
    const { deps, send, outbox } = makeDeps();
    await sendEmail(message('qa@test.zlotify.invalid'), deps);
    expect(send).not.toHaveBeenCalled();
    expect(outbox).toHaveBeenCalledOnce();
    expect(outbox.mock.calls[0]?.[0]).toMatchObject({
      to_email: 'qa@test.zlotify.invalid',
      template: 'welcome',
      subject: 'Bienvenido a Zlotify',
      payload: { displayName: 'Test', isSeller: false },
    });
  });

  it('destinatarios reales van al transporte y nunca al outbox', async () => {
    const { deps, send, outbox } = makeDeps();
    await sendEmail(message('persona@gmail.com'), deps);
    expect(outbox).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: 'persona@gmail.com',
      subject: 'Bienvenido a Zlotify',
    });
  });

  it('reintenta hasta 3 veces y se recupera', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('smtp 1'))
      .mockRejectedValueOnce(new Error('smtp 2'))
      .mockResolvedValue(undefined);
    const { deps } = makeDeps({ transport: { send } });
    await sendEmail(message('persona@gmail.com'), deps);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('tras 3 fallos lanza email_failed sin exponer el detalle interno en el mensaje', async () => {
    const send = vi.fn().mockRejectedValue(new Error('auth failed for user secret@x.com'));
    const { deps } = makeDeps({ transport: { send } });
    const error = await sendEmail(message('persona@gmail.com'), deps).catch((e: unknown) => e);
    expect(send).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'email_failed', message: 'No se pudo enviar el correo' });
    expect((error as AppError).message).not.toContain('secret');
  });
});

describe('plantillas de código (S2-05)', () => {
  const data = { displayName: 'Ana', code: '482913' };

  it('verifyEmail: snapshot de asunto y texto', () => {
    const { subject, text } = renderEmail({ template: 'verifyEmail', data }, { appUrl });
    expect({ subject, text }).toMatchInlineSnapshot(`
      {
        "subject": "Tu código para verificar tu correo",
        "text": "¡Hola, Ana!

      Usa este código para verificar tu correo y terminar de crear tu cuenta en Zlotify.

      482913

      Este código vence en 10 minutos.

      --
      Si no solicitaste esto, ignora este correo.
      Aviso de privacidad: https://zlotify.test/privacidad",
      }
    `);
  });

  it('loginCode: snapshot de asunto y texto', () => {
    const { subject, text } = renderEmail(
      { template: 'loginCode', data: { code: '482913' } },
      { appUrl },
    );
    expect({ subject, text }).toMatchInlineSnapshot(`
      {
        "subject": "Tu código para entrar",
        "text": "¡Hola!

      Usa este código para entrar a tu cuenta de Zlotify.

      482913

      Este código vence en 10 minutos.

      --
      Si no solicitaste esto, ignora este correo.
      Aviso de privacidad: https://zlotify.test/privacidad",
      }
    `);
  });

  it.each(['verifyEmail', 'loginCode'] as const)(
    '%s: el html y el texto traen el código, el asunto no',
    (template) => {
      const message = { template, data } as Parameters<typeof renderEmail>[0];
      const { subject, html, text } = renderEmail(message, { appUrl });
      expect(html).toContain('482913');
      expect(text).toContain('482913');
      expect(subject).not.toContain('482913');
      expect(html).toContain('10 minutos');
    },
  );

  it('un destinatario de prueba guarda el código en claro en el outbox', async () => {
    const { deps, outbox, send } = makeDeps();
    await sendEmail({ to: 'a@test.zlotify.invalid', template: 'verifyEmail', data }, deps);
    expect(send).not.toHaveBeenCalled();
    expect(outbox.mock.calls[0]?.[0]).toMatchObject({
      template: 'verifyEmail',
      payload: { code: '482913' },
    });
  });
});
