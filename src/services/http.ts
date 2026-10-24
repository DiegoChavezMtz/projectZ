import { AppError } from '@/utils/errors';

type RequestOptions = Omit<RequestInit, 'method' | 'body'> & {
  next?: { revalidate?: number | false; tags?: string[] };
  /** Milisegundos antes de abortar. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

async function toHttpError(res: Response): Promise<AppError> {
  let body: { code?: unknown; message?: unknown } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // respuesta sin cuerpo JSON
  }
  const code = typeof body.code === 'string' ? body.code : `http_${res.status}`;
  const message =
    typeof body.message === 'string' ? body.message : res.statusText || 'Error de red';
  return new AppError(code, message, { status: res.status, body });
}

async function request<T>(
  method: string,
  url: string,
  body: unknown,
  { timeoutMs = DEFAULT_TIMEOUT_MS, headers, signal, ...options }: RequestOptions = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    const timedOut = timeout.aborted;
    throw new AppError(
      timedOut ? 'network_timeout' : 'network_error',
      timedOut ? 'La petición tardó demasiado' : 'No se pudo conectar',
      error,
    );
  }

  if (!res.ok) throw await toHttpError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Wrapper delgado sobre fetch. Solo los services lo usan (regla 5). Errores normalizados a AppError.
export const http = {
  get: <T>(url: string, options?: RequestOptions) => request<T>('GET', url, undefined, options),
  post: <T>(url: string, body: unknown, options?: RequestOptions) =>
    request<T>('POST', url, body, options),
  patch: <T>(url: string, body: unknown, options?: RequestOptions) =>
    request<T>('PATCH', url, body, options),
  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>('DELETE', url, undefined, options),
};
