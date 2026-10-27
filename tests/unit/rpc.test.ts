// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ENGINE_ERROR_CODES } from '@/types/claims';
import { AppError } from '@/utils/errors';
import { unwrapRpc } from '@/utils/rpc';

const messages = {
  item_not_available: 'Ya no está disponible.',
  rate_limited: 'Demasiados intentos.',
  unknown: 'Algo salió mal.',
};

const failure = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error as AppError;
  }
  throw new Error('no lanzó');
};

describe('unwrapRpc', () => {
  it('devuelve el resultado cuando ok', () => {
    expect(unwrapRpc<{ entry_id: string }>({ ok: true, entry_id: 'e1' }, null, messages)).toEqual({
      ok: true,
      entry_id: 'e1',
    });
  });

  it('mapea el código al texto de la feature', () => {
    const error = failure(() =>
      unwrapRpc({ ok: false, code: 'item_not_available', message: 'x' }, null, messages),
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('item_not_available');
    expect(error.message).toBe('Ya no está disponible.');
  });

  it('un código sin texto cae a unknown conservando el código', () => {
    const error = failure(() => unwrapRpc({ ok: false, code: 'own_session' }, null, messages));
    expect(error.code).toBe('own_session');
    expect(error.message).toBe('Algo salió mal.');
  });

  it('conserva reasons de validation_failed', () => {
    const error = failure(() =>
      unwrapRpc({ ok: false, code: 'validation_failed', reasons: ['no_items'] }, null, messages),
    );
    expect(error.details).toEqual({ reasons: ['no_items'] });
  });

  it('un error de transporte o una forma inesperada son unknown', () => {
    expect(failure(() => unwrapRpc(null, { message: 'red' }, messages)).code).toBe('unknown');
    expect(failure(() => unwrapRpc('texto', null, messages)).code).toBe('unknown');
    expect(failure(() => unwrapRpc({ code: 'x' }, null, messages)).code).toBe('unknown');
  });

  it('un 42501 de PostgREST (anónimo) es unauthenticated', () => {
    const error = failure(() =>
      unwrapRpc(
        null,
        { code: '42501', message: 'permission denied' },
        {
          ...messages,
          unauthenticated: 'Inicia sesión.',
        },
      ),
    );
    expect(error.code).toBe('unauthenticated');
    expect(error.message).toBe('Inicia sesión.');
  });

  it('cubre todos los códigos del motor', () => {
    expect(ENGINE_ERROR_CODES).toContain('already_in_queue');
    expect(new Set(ENGINE_ERROR_CODES).size).toBe(ENGINE_ERROR_CODES.length);
  });
});
