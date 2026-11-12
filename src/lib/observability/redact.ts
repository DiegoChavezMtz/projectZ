// Saneo de datos antes de loguear o reportar: nunca salen correos, códigos de verificación, tokens ni secretos.
const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|authorization|cookie|apikey|api_key|service_role|^code$|otp|email|correo|session|jwt|bearer|^key$/i;

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const JWT = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g;
const LONG_SECRET = /\b[A-Za-z0-9_-]{40,}\b/g;
const SIX_DIGITS = /(?<![\d.])\d{6}(?![\d.])/g;

export const REDACTED = '[redactado]';
const MAX_STRING = 500;
const MAX_DEPTH = 4;

export function redactString(value: string): string {
  return value
    .replace(JWT, REDACTED)
    .replace(EMAIL, REDACTED)
    .replace(LONG_SECRET, REDACTED)
    .replace(SIX_DIGITS, REDACTED)
    .slice(0, MAX_STRING);
}

export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncado]';
  if (value instanceof Error) return redactString(value.message);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : redact(item, depth + 1),
    ]),
  );
}
