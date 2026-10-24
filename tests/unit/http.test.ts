import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from '@/services/http';
import { AppError, toAppError } from '@/utils/errors';

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, ...init });

describe('http', () => {
  it('devuelve el JSON parseado y manda el cuerpo serializado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(http.post('https://x.test/a', { n: 1 })).resolves.toEqual({ ok: true });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"n":1}');
  });

  it('204 devuelve undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(http.delete('https://x.test/a')).resolves.toBeUndefined();
  });

  it('normaliza errores HTTP a AppError con el code del cuerpo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ code: 'slot_taken', message: 'Ocupado' }, { status: 409 })),
    );
    const error = await http.get('https://x.test/a').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'slot_taken', message: 'Ocupado' });
  });

  it('usa http_<status> cuando el cuerpo no es JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    await expect(http.get('https://x.test/a')).rejects.toMatchObject({ code: 'http_500' });
  });

  it('normaliza fallos de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(http.get('https://x.test/a')).rejects.toMatchObject({ code: 'network_error' });
  });
});

describe('toAppError', () => {
  it('envuelve cualquier valor en AppError', () => {
    expect(toAppError(new Error('x'), 'boom')).toMatchObject({ code: 'boom', message: 'x' });
    expect(toAppError('texto').message).toBe('texto');
    const app = new AppError('a', 'b');
    expect(toAppError(app)).toBe(app);
  });
});
