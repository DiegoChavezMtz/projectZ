// Reporte desde el navegador hacia /api/telemetry (sendBeacon no puede invocar Server Actions).
// Nunca lanza ni bloquea la interfaz.
export type TelemetryPayload =
  | {
      kind: 'error';
      message: string;
      name?: string;
      digest?: string;
      route?: string;
      stack?: string;
    }
  | { kind: 'rpc'; code: string; rpc?: string };

function send(payload: TelemetryPayload): void {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/telemetry', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/telemetry', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // La telemetría nunca debe romper la app.
  }
}

export function reportClientError(error: unknown): void {
  const err = error instanceof Error ? error : undefined;
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest: unknown }).digest)
      : undefined;
  send({
    kind: 'error',
    message: err?.message ?? 'Error desconocido',
    name: err?.name,
    digest,
    route: typeof location !== 'undefined' ? location.pathname : undefined,
    stack: err?.stack,
  });
}

export function reportRpcError(code: string): void {
  send({ kind: 'rpc', code });
}
