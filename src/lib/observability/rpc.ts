import { reportRpcError } from './client';
import { logger } from './logger';

/** Cuenta un código de error de RPC: en servidor va a logs; en el navegador, a /api/telemetry. */
export function trackRpcError(code: string): void {
  if (typeof window === 'undefined')
    logger.info('rpc_error', { error_code: code, origin: 'server' });
  else reportRpcError(code);
}
