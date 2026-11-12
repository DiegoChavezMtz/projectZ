// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureException, toErrorReport } from '@/lib/observability/capture';
import { log } from '@/lib/observability/logger';
import { redact, redactString } from '@/lib/observability/redact';
import { handleTelemetryRequest } from '@/lib/observability/telemetry';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('redact', () => {
  it('oculta correos, códigos de 6 dígitos y tokens en cadenas', () => {
    const out = redactString(
      'fallo para ana@correo.com con código 123456 y eyJhbGciOi.eyJzdWIiOi.abcdefghijk',
    );
    expect(out).not.toMatch(/ana@|123456|eyJ/);
  });

  it('oculta valores de llaves sensibles aunque estén anidados', () => {
    const out = redact({
      a: { password: 'x', token: 'y', email: 'a@b.co', code: '123456', ok: 'visible' },
    });
    expect(JSON.stringify(out)).not.toMatch(/"x"|"y"|a@b|123456/);
    expect(JSON.stringify(out)).toContain('visible');
  });
});

describe('logger', () => {
  it('emite una línea JSON con ts, level y event, sin secretos', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'prueba', { password: 'secreta', code: '654321', n: 1 });
    const line = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(line).toMatchObject({ level: 'info', event: 'prueba', n: 1 });
    expect(JSON.stringify(line)).not.toMatch(/secreta|654321/);
  });
});

describe('captura de errores', () => {
  it('un error forzado se envía al sistema configurado, sin datos personales', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('ERROR_REPORT_URL', 'https://captura.example/ingest');
    vi.stubEnv('ERROR_REPORT_TOKEN', 'tok');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await captureException(new Error('falló para ana@correo.com'), { route: '/c/ABC?x=1' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://captura.example/ingest');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(String(init.body)).not.toMatch(/ana@correo|x=1/);
  });

  it('sin URL configurada solo registra en logs y no lanza', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await captureException(new Error('boom'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(String(spy.mock.calls[0]?.[0])).toContain('error_captured');
  });

  it('un fallo del sistema de captura no se propaga', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('ERROR_REPORT_URL', 'https://captura.example/ingest');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red')));
    await expect(captureException(new Error('x'))).resolves.toBeUndefined();
  });

  it('conserva el digest', () => {
    const report = toErrorReport(Object.assign(new Error('x'), { digest: 'd123' }), 'client');
    expect(report.digest).toBe('d123');
  });
});

describe('POST /api/telemetry', () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    handleTelemetryRequest(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
        headers,
      }),
    );

  it('cuenta códigos de error de RPC en logs consultables', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await post({ kind: 'rpc', code: 'item_not_available' });
    expect(res.status).toBe(204);
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).toMatchObject({
      event: 'rpc_error',
      error_code: 'item_not_available',
      origin: 'client',
    });
  });

  it('acepta errores de cliente', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await post({ kind: 'error', message: 'x', route: '/c/A' })).status).toBe(204);
  });

  it('rechaza cargas inválidas o excesivas', async () => {
    expect((await post('no-json')).status).toBe(400);
    expect((await post({ kind: 'rpc', code: 'Código Raro!' })).status).toBe(400);
    expect((await post({ kind: 'error', message: 'x'.repeat(20_000) })).status).toBe(413);
  });
});
