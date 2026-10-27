'use client';

import { useCallback, useMemo, type Dispatch } from 'react';
import { useToast } from '@/context/ToastContext';
import { AppError } from '@/utils/errors';
import { liveConsoleContent } from '../content/es-MX';
import { liveActionsService } from '../services/liveActions.service';
import type { ConsoleAction, ConsoleConnection, ConsoleEntry } from '../types';

type Options = {
  connection: ConsoleConnection;
  dispatch: Dispatch<ConsoleAction>;
  /** Relee el estado autoritativo (corrige cualquier cambio optimista). */
  refresh: () => Promise<void>;
};

const c = liveConsoleContent;

/**
 * Acciones del vendedor con estado "en curso" por clave y cambio optimista de los intentos.
 * Si el motor rechaza la acción, se avisa con el texto del error y se relee el estado.
 */
export function useConsoleActions({ connection, dispatch, refresh }: Options) {
  const toast = useToast();
  const paused = connection === 'offline';

  const run = useCallback(
    async <T>(
      key: string,
      action: () => Promise<T>,
      optimistic?: () => void,
    ): Promise<T | null> => {
      if (paused) {
        toast.show(c.connection.offline, 'info');
        return null;
      }
      dispatch({ type: 'busyStart', key });
      optimistic?.();
      try {
        return await action();
      } catch (error) {
        toast.show(
          error instanceof AppError ? error.message : 'Algo salió mal. Intenta de nuevo.',
          'danger',
        );
        return null;
      } finally {
        dispatch({ type: 'busyDone', key });
        void refresh();
      }
    },
    [paused, dispatch, refresh, toast],
  );

  const setEntry = useCallback(
    (entry: ConsoleEntry, status: ConsoleEntry['status']) => () =>
      dispatch({ type: 'entryStatus', entryId: entry.id, status }),
    [dispatch],
  );

  return useMemo(
    () => ({
      start: (sessionId: string) =>
        run('session', () => liveActionsService.startSession(sessionId)),
      end: (sessionId: string) => run('session', () => liveActionsService.endSession(sessionId)),
      extendClose: (sessionId: string, closesAt: string) =>
        run('session', async () => {
          await liveActionsService.setSessionClose(sessionId, closesAt);
          toast.show(c.close.done, 'success');
          return true;
        }),
      announce: (sessionId: string, text: string) =>
        run('announce', async () => {
          await liveActionsService.postAnnouncement(sessionId, text);
          toast.show(c.announce.done, 'success');
          return true;
        }),
      releaseItem: (itemId: string) =>
        run(`item:${itemId}`, () => liveActionsService.releaseItem(itemId)),
      releaseAll: (sessionId: string) =>
        run('session', () => liveActionsService.releaseAllItems(sessionId)),
      withdrawItem: (itemId: string) =>
        run(`item:${itemId}`, () => liveActionsService.withdrawItem(itemId)),
      featureItem: (itemId: string, featured: boolean) =>
        run(`item:${itemId}`, () => liveActionsService.featureItem(itemId, featured)),
      confirm: (entry: ConsoleEntry) =>
        run(
          `entry:${entry.id}`,
          () => liveActionsService.confirmEntry(entry.id),
          setEntry(entry, 'accepted'),
        ),
      reject: (entry: ConsoleEntry) =>
        run(
          `entry:${entry.id}`,
          () => liveActionsService.rejectEntry(entry.id),
          setEntry(entry, 'rejected'),
        ),
      acceptOffer: (entry: ConsoleEntry) =>
        run(
          `entry:${entry.id}`,
          () => liveActionsService.acceptOffer(entry.id),
          setEntry(entry, 'accepted'),
        ),
      rejectOffer: (entry: ConsoleEntry) =>
        run(
          `entry:${entry.id}`,
          () => liveActionsService.rejectOffer(entry.id),
          setEntry(entry, 'rejected'),
        ),
    }),
    [run, setEntry, toast],
  );
}

export type ConsoleActions = ReturnType<typeof useConsoleActions>;
