import { trackRpcError } from '@/lib/observability/rpc';
import { AppError } from './errors';

// Respuesta uniforme de las RPC del motor: {ok:true, ...} o {ok:false, code, message}.
export type RpcFailure = { ok: false; code: string; message: string; reasons?: string[] };
export type RpcSuccess<T extends object = object> = { ok: true } & T;
export type RpcResult<T extends object = object> = RpcSuccess<T> | RpcFailure;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Convierte el resultado crudo de `supabase.rpc` en datos o en un `AppError` con texto de UI.
 * `messages` es el diccionario de la feature (código → texto en español); si el código no está,
 * se usa `messages.unknown`. Un 42501 de PostgREST (anónimo sin permiso) es `unauthenticated`. Un error de transporte o una forma inesperada se reportan como `unknown`.
 */
export function unwrapRpc<T extends object = object>(
  data: unknown,
  error: unknown,
  messages: Record<string, string>,
): RpcSuccess<T> {
  const fallback = messages.unknown ?? 'Algo salió mal. Intenta de nuevo.';
  // `anon` no tiene execute sobre las RPC de acción: PostgREST responde 42501 (sin sesión).
  if (isRecord(error) && error.code === '42501') {
    throw new AppError('unauthenticated', messages.unauthenticated ?? fallback, error);
  }
  if (error || !isRecord(data) || typeof data.ok !== 'boolean') {
    trackRpcError('transport_error');
    throw new AppError('unknown', fallback, error ?? data);
  }
  if (data.ok) return data as RpcSuccess<T>;

  const code = typeof data.code === 'string' ? data.code : 'unknown';
  trackRpcError(code);
  const reasons = Array.isArray(data.reasons) ? (data.reasons as string[]) : undefined;
  throw new AppError(code, messages[code] ?? fallback, { reasons });
}
