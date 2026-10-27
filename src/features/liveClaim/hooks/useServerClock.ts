'use client';

import { useEffect, useState } from 'react';
import { liveDataClient } from '../services/liveData.client';
import { clockOffset, clockOffsetFromSample } from '../utils/clock';

const SAMPLES = 3;
const RESYNC_MS = 5 * 60_000;

/**
 * Diferencia entre la hora del servidor y la del dispositivo. Mide varias veces y se queda con la
 * muestra de menor ida y vuelta; se repite cada 5 minutos. Si no puede medir, usa la hora del
 * snapshot (menos precisa por el tiempo de carga) para que los contadores no queden en blanco.
 */
export function useServerClock(initialServerNow: string): { offsetMs: number; ready: boolean } {
  const [state, setState] = useState({ offsetMs: 0, ready: false });

  useEffect(() => {
    let cancelled = false;

    async function measure() {
      try {
        let best: { offset: number; rtt: number } | null = null;
        for (let i = 0; i < SAMPLES; i += 1) {
          const sample = await liveDataClient.sampleServerClock();
          const rtt = sample.receivedAtMs - sample.sentAtMs;
          if (!best || rtt < best.rtt) best = { offset: clockOffsetFromSample(sample), rtt };
        }
        if (!cancelled && best) setState({ offsetMs: best.offset, ready: true });
      } catch {
        if (!cancelled)
          setState((current) =>
            current.ready
              ? current
              : { offsetMs: clockOffset(Date.parse(initialServerNow), Date.now()), ready: true },
          );
      }
    }

    void measure();
    const timer = setInterval(() => void measure(), RESYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [initialServerNow]);

  return state;
}
