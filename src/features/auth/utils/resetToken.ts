import { createHmac, timingSafeEqual } from 'node:crypto';

// Token de un solo uso para /reset-password (docs/spec/auth.md). Cookie httpOnly firmada de 10 minutos.
// La "única vez" la garantiza el servidor al consumir la fila del código (email_codes); la firma evita falsificarlo.
export const RESET_COOKIE = 'zl_reset';
export const RESET_TTL_SECONDS = 10 * 60;

export type ResetTokenPayload = { codeId: string; userId: string };

const sign = (secret: string, body: string) =>
  createHmac('sha256', secret).update(`reset|${body}`).digest('base64url');

export function signResetToken(
  secret: string,
  payload: ResetTokenPayload,
  now: Date = new Date(),
): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(now.getTime() / 1000) + RESET_TTL_SECONDS }),
  ).toString('base64url');
  return `${body}.${sign(secret, body)}`;
}

/** Devuelve el contenido si la firma es válida y no venció; si no, null. */
export function readResetToken(
  secret: string,
  value: string | undefined,
  now: Date = new Date(),
): ResetTokenPayload | null {
  if (!value) return null;
  const [body, signature, ...rest] = value.split('.');
  if (!body || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<
      ResetTokenPayload & { exp: number }
    >;
    if (
      typeof parsed.codeId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp * 1000 <= now.getTime()
    )
      return null;
    return { codeId: parsed.codeId, userId: parsed.userId };
  } catch {
    return null;
  }
}
