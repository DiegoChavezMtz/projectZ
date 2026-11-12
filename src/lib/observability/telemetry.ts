import { z } from 'zod';
import { captureReport, toErrorReport } from './capture';
import { logger } from './logger';

const MAX_BYTES = 8 * 1024;

const payloadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('error'),
    message: z.string().max(2000),
    name: z.string().max(100).optional(),
    digest: z.string().max(100).optional(),
    route: z.string().max(300).optional(),
    stack: z.string().max(4000).optional(),
  }),
  z.object({
    kind: z.literal('rpc'),
    code: z.string().regex(/^[a-z0-9_]{1,60}$/),
    rpc: z.string().max(80).optional(),
  }),
]);

/** POST /api/telemetry: errores del navegador y códigos de error de RPC. Payload mínimo, sin sesión requerida. */
export async function handleTelemetryRequest(request: Request): Promise<Response> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) return new Response(null, { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 });

  let parsed: z.infer<typeof payloadSchema>;
  try {
    parsed = payloadSchema.parse(JSON.parse(text));
  } catch {
    return new Response(null, { status: 400 });
  }

  if (parsed.kind === 'rpc') {
    // Conteo consultable: filtrar por event = "rpc_error" y agrupar por code.
    logger.info('rpc_error', { error_code: parsed.code, rpc: parsed.rpc, origin: 'client' });
  } else {
    const error = Object.assign(new Error(parsed.message), { name: parsed.name ?? 'Error' });
    error.stack = parsed.stack;
    await captureReport(
      toErrorReport(Object.assign(error, { digest: parsed.digest }), 'client', {
        route: parsed.route,
      }),
    );
  }
  return new Response(null, { status: 204 });
}
