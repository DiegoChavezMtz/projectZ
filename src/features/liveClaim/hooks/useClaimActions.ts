'use client';

import { useCallback, useMemo, type Dispatch } from 'react';
import { useToast } from '@/context/ToastContext';
import type { ClaimItem } from '@/types/claims';
import { isAppError } from '@/utils/errors';
import { liveClaimContent } from '../content/es-MX';
import { claimActionsService } from '../services/claimActions.service';
import type { ConnectionStatus, LiveAction, ViewerEntry } from '../types';

const a = liveClaimContent.actions;

type Options = {
  connection: ConnectionStatus;
  dispatch: Dispatch<LiveAction>;
  refresh: () => Promise<void>;
  refreshEntries: () => Promise<void>;
  /** Lleva a iniciar sesión conservando la posición del artículo. */
  requireLogin: (itemId: string) => void;
};

const UNAVAILABLE = new Set(['item_not_available', 'invalid_state', 'session_not_live']);

/** Acciones del comprador con respuesta optimista y reversión si el servidor las rechaza. */
export function useClaimActions({ connection, dispatch, refresh, refreshEntries, requireLogin }: Options) {
  const toast = useToast();

  const fail = useCallback(
    (itemId: string, error: unknown) => {
      dispatch({ type: 'pendingFail', itemId });
      if (isAppError(error) && error.code === 'unauthenticated') {
        requireLogin(itemId);
        return;
      }
      toast.show(
        isAppError(error) ? error.message : liveClaimContent.errors.unknown ?? '',
        'danger',
      );
      // "No disponible": otra persona llegó primero. Se actualiza sin recargar la página.
      if (isAppError(error) && UNAVAILABLE.has(error.code)) void refresh();
    },
    [dispatch, refresh, requireLogin, toast],
  );

  const claim = useCallback(
    async (item: ClaimItem) => {
      if (connection !== 'online') {
        toast.show(a.offline, 'info');
        return;
      }
      dispatch({ type: 'pendingStart', itemId: item.id, action: { kind: 'claim' } });
      try {
        const result = await claimActionsService.claimItem(item.id);
        const entry: ViewerEntry = {
          id: result.entryId,
          item_id: item.id,
          kind: 'claim',
          amount_cents: item.price_cents,
          status: result.won ? 'accepted' : 'queued',
          seq: Number.MAX_SAFE_INTEGER,
        };
        dispatch({ type: 'pendingDone', itemId: item.id, entry });
        toast.show(result.won ? a.wonOk(item.title) : a.claimedOk(item.title), 'success');
        void refreshEntries();
      } catch (error) {
        fail(item.id, error);
      }
    },
    [connection, dispatch, fail, refreshEntries, toast],
  );

  const offer = useCallback(
    async (item: ClaimItem, amountCents: number) => {
      if (connection !== 'online') {
        toast.show(a.offline, 'info');
        return;
      }
      dispatch({ type: 'pendingStart', itemId: item.id, action: { kind: 'offer', amountCents } });
      try {
        const result = await claimActionsService.makeOffer(item.id, amountCents);
        dispatch({
          type: 'pendingDone',
          itemId: item.id,
          entry: {
            id: result.entryId,
            item_id: item.id,
            kind: 'offer',
            amount_cents: amountCents,
            status: 'pending',
            seq: Number.MAX_SAFE_INTEGER,
          },
        });
        toast.show(a.offerOk, 'success');
        void refreshEntries();
      } catch (error) {
        fail(item.id, error);
        throw error;
      }
    },
    [connection, dispatch, fail, refreshEntries, toast],
  );

  const withdraw = useCallback(
    async (entry: ViewerEntry) => {
      if (connection !== 'online') {
        toast.show(a.offline, 'info');
        return;
      }
      try {
        await claimActionsService.withdrawEntry(entry.id);
        dispatch({ type: 'entryWithdrawn', entryId: entry.id });
        toast.show(a.withdrawnOk, 'info');
        void refreshEntries();
      } catch (error) {
        toast.show(isAppError(error) ? error.message : liveClaimContent.errors.unknown ?? '', 'danger');
        void refresh();
      }
    },
    [connection, dispatch, refresh, refreshEntries, toast],
  );

  return useMemo(() => ({ claim, offer, withdraw }), [claim, offer, withdraw]);
}
