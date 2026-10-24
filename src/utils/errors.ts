// Error normalizado de la app: { code, message }. `code` es estable y apto para mapear a textos de UI.
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;

export function toAppError(value: unknown, fallbackCode = 'unknown'): AppError {
  if (isAppError(value)) return value;
  if (value instanceof Error) return new AppError(fallbackCode, value.message, value);
  return new AppError(fallbackCode, typeof value === 'string' ? value : 'Error desconocido', value);
}
