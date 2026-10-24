// Handles y slugs que chocan con rutas de la app (docs/spec/auth.md, Validaciones).
export const RESERVED_HANDLES: readonly string[] = [
  'admin',
  'api',
  'login',
  'signup',
  'account',
  'dashboard',
  'c',
  'u',
  'live',
  'orders',
  'terminos',
  'privacidad',
  'verify-email',
  'onboarding',
];

export const isReservedHandle = (value: string): boolean =>
  RESERVED_HANDLES.includes(value.trim().toLowerCase());
