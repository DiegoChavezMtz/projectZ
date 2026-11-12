import { logger, type LogFields } from './logger';
import { redact, redactString } from './redact';

export type ErrorReport = {
  source: 'server' | 'client';
  message: string;
  name?: string;
  digest?: string;
  route?: string;
  stack?: string;
  context?: LogFields;
};

const TIMEOUT_MS = 3000;

/** Normaliza cualquier valor lanzado a un reporte sin datos personales. */
export function toErrorReport(
  error: unknown,
  source: ErrorReport['source'],
  extra: Pick<ErrorReport, 'route' | 'context'> = {},
): ErrorReport {
  const err = error instanceof Error ? error : undefined;
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest: unknown }).digest)
      : undefined;
  return {
    source,
    message: redactString(
      err?.message ?? (typeof error === 'string' ? error : 'Error desconocido'),
    ),
    name: err?.name,
    digest,
    route: extra.route ? redactString(extra.route.split('?')[0] ?? '') : undefined,
    stack: err?.stack ? redactString(err.stack.split('\n').slice(0, 6).join('\n')) : undefined,
    context: extra.context ? (redact(extra.context) as LogFields) : undefined,
  };
}

/**
 * Registra el error en logs y lo envía al sistema de captura configurado por entorno
 * (ERROR_REPORT_URL, con ERROR_REPORT_TOKEN opcional). Sin URL solo queda en logs. Nunca lanza.
 */
export async function captureReport(report: ErrorReport): Promise<void> {
  logger.error('error_captured', { ...report });
  const url = process.env.ERROR_REPORT_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.ERROR_REPORT_TOKEN
          ? { authorization: `Bearer ${process.env.ERROR_REPORT_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ ...report, env: process.env.APP_ENV, ts: new Date().toISOString() }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    logger.warn('error_report_failed');
  }
}

export const captureException = (
  error: unknown,
  extra?: Pick<ErrorReport, 'route' | 'context'>,
): Promise<void> => captureReport(toErrorReport(error, 'server', extra));
