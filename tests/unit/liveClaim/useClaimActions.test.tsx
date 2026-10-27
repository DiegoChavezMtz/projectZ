import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import { AppError } from '@/utils/errors';
import { item } from './factories';

const claimItem = vi.fn();
const makeOffer = vi.fn();
const withdrawEntry = vi.fn();
vi.mock('@/features/liveClaim/services/claimActions.service', () => ({
  claimActionsService: {
    claimItem: (...a: unknown[]) => claimItem(...a),
    makeOffer: (...a: unknown[]) => makeOffer(...a),
    withdrawEntry: (...a: unknown[]) => withdrawEntry(...a),
  },
}));

const { useClaimActions } = await import('@/features/liveClaim/hooks/useClaimActions');

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

function setup(connection: 'online' | 'offline' | 'reconnecting' = 'online') {
  const dispatch = vi.fn();
  const refresh = vi.fn().mockResolvedValue(undefined);
  const refreshEntries = vi.fn().mockResolvedValue(undefined);
  const requireLogin = vi.fn();
  const { result } = renderHook(
    () => useClaimActions({ connection, dispatch, refresh, refreshEntries, requireLogin }),
    { wrapper },
  );
  return { result, dispatch, refresh, refreshEntries, requireLogin };
}

beforeEach(() => {
  claimItem.mockReset();
  makeOffer.mockReset();
  withdrawEntry.mockReset();
});

describe('useClaimActions', () => {
  it('claim: marca pendiente de inmediato y al responder registra el intento', async () => {
    claimItem.mockResolvedValue({
      entryId: 'e1',
      position: 1,
      itemStatus: 'available',
      won: false,
    });
    const { result, dispatch } = setup();
    await act(() => result.current.claim(item({ id: 'a' })));
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: 'pendingStart',
      itemId: 'a',
      action: { kind: 'claim' },
    });
    expect(dispatch.mock.calls[1]?.[0]).toMatchObject({
      type: 'pendingDone',
      itemId: 'a',
      entry: { id: 'e1', kind: 'claim', status: 'queued' },
    });
  });

  it('claim con auto_confirm: el intento queda aceptado', async () => {
    claimItem.mockResolvedValue({ entryId: 'e1', position: 1, itemStatus: 'sold', won: true });
    const { result, dispatch } = setup();
    await act(() => result.current.claim(item({ id: 'a' })));
    expect(dispatch.mock.calls[1]?.[0]).toMatchObject({ entry: { status: 'accepted' } });
  });

  it('"no disponible": revierte lo optimista y actualiza el estado sin recargar', async () => {
    claimItem.mockRejectedValue(
      new AppError('item_not_available', 'Este artículo ya no está disponible.'),
    );
    const { result, dispatch, refresh } = setup();
    await act(() => result.current.claim(item({ id: 'a' })));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'pendingFail', itemId: 'a' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('sin sesión (42501): revierte y lleva al login con el artículo', async () => {
    claimItem.mockRejectedValue(new AppError('unauthenticated', 'Inicia sesión para participar.'));
    const { result, dispatch, requireLogin, refresh } = setup();
    await act(() => result.current.claim(item({ id: 'a' })));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'pendingFail', itemId: 'a' });
    expect(requireLogin).toHaveBeenCalledWith('a');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('sin conexión no se llama al servidor', async () => {
    const { result, dispatch } = setup('offline');
    await act(() => result.current.claim(item({ id: 'a' })));
    expect(claimItem).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('oferta: va en centavos; si falla relanza para que el diálogo siga abierto', async () => {
    makeOffer.mockRejectedValue(
      new AppError('invalid_amount', 'La oferta debe ser mayor a cero y menor al precio.'),
    );
    const { result, dispatch } = setup();
    await expect(act(() => result.current.offer(item({ id: 'a' }), 9_900))).rejects.toThrow();
    expect(makeOffer).toHaveBeenCalledWith('a', 9_900);
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'pendingFail', itemId: 'a' });

    makeOffer.mockResolvedValue({ entryId: 'o1' });
    await act(() => result.current.offer(item({ id: 'a' }), 9_900));
    expect(dispatch.mock.calls.at(-1)?.[0]).toMatchObject({
      type: 'pendingDone',
      entry: { id: 'o1', kind: 'offer', amount_cents: 9_900, status: 'pending' },
    });
  });

  it('retirar marca el intento como retirado', async () => {
    withdrawEntry.mockResolvedValue(undefined);
    const { result, dispatch } = setup();
    await act(() =>
      result.current.withdraw({
        id: 'e1',
        item_id: 'a',
        kind: 'claim',
        amount_cents: 1,
        status: 'queued',
        seq: 1,
      }),
    );
    expect(dispatch).toHaveBeenCalledWith({ type: 'entryWithdrawn', entryId: 'e1' });
  });
});
