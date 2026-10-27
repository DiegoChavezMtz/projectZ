'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { useToast } from '@/context/ToastContext';
import type { ActionResult } from '../types';

/**
 * Ejecuta una Server Action de cumplimiento: estado "en curso", aviso con el texto de UI del resultado y
 * relectura de la página al terminar bien. `onDone` corre solo si la acción salió bien.
 */
export function useRunAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (action: () => Promise<ActionResult>, successMessage?: string, onDone?: () => void) => {
      startTransition(async () => {
        let result: ActionResult;
        try {
          result = await action();
        } catch {
          toast.show('Algo salió mal. Intenta de nuevo.', 'danger');
          return;
        }
        if (result.ok) {
          if (successMessage) toast.show(successMessage, 'success');
          onDone?.();
          router.refresh();
        } else {
          toast.show(result.message, 'danger');
        }
      });
    },
    [router, toast],
  );

  return { pending, run };
}
