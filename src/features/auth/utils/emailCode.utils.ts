import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { CodePurpose } from '../types';

// Reglas de docs/spec/auth.md (Reglas del código de verificación). Lógica pura, sin BD.
export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
export const MAX_CODES_PER_IP_PER_HOUR = 20;
export const RATE_WINDOW_MS = 60 * 60 * 1000;

/** 6 dígitos con CSPRNG, con ceros a la izquierda. */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

/** HMAC-SHA256(secret, `email|purpose|code`) en hex. El email se normaliza a minúsculas. */
export function hashCode(
  secret: string,
  email: string,
  purpose: CodePurpose,
  code: string,
): string {
  return createHmac('sha256', secret)
    .update(`${email.trim().toLowerCase()}|${purpose}|${code}`)
    .digest('hex');
}

/** Comparación en tiempo constante de dos hashes hex. */
export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** Hash del IP para límites por IP sin guardarlo en claro. */
export function hashIp(secret: string, ip: string): string {
  return createHmac('sha256', secret).update(`ip|${ip}`).digest('hex');
}

export const toEmailKey = (email: string) => email.trim().toLowerCase();

export type StoredCode = {
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
};

export type CodeCheck =
  | { status: 'ok' }
  | { status: 'invalid' } // sin código vigente o ya consumido
  | { status: 'expired' }
  | { status: 'exhausted' }
  | { status: 'incorrect'; attemptsLeft: number };

/** Estado de un código almacenado frente a una entrada. No muta nada: el service persiste el resultado. */
export function checkCode(
  stored: StoredCode | null,
  expectedHash: string,
  now: Date = new Date(),
): CodeCheck {
  if (!stored || stored.consumed_at) return { status: 'invalid' };
  if (stored.attempts >= MAX_ATTEMPTS) return { status: 'exhausted' };
  if (new Date(stored.expires_at).getTime() <= now.getTime()) return { status: 'expired' };
  if (hashesMatch(stored.code_hash, expectedHash)) return { status: 'ok' };
  const used = stored.attempts + 1;
  return used >= MAX_ATTEMPTS
    ? { status: 'exhausted' }
    : { status: 'incorrect', attemptsLeft: MAX_ATTEMPTS - used };
}

export const expiryFrom = (now: Date = new Date()): Date => new Date(now.getTime() + CODE_TTL_MS);

/** Segundos que faltan para poder reenviar (0 si ya se puede). */
export function cooldownRemaining(lastCreatedAt: string | null, now: Date = new Date()): number {
  if (!lastCreatedAt) return 0;
  const elapsed = (now.getTime() - new Date(lastCreatedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
}

export function isRateLimited(counts: { byEmail: number; byIp: number | null }): boolean {
  return (
    counts.byEmail >= MAX_CODES_PER_EMAIL_PER_HOUR ||
    (counts.byIp !== null && counts.byIp >= MAX_CODES_PER_IP_PER_HOUR)
  );
}
