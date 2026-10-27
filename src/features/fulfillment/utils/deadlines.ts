// Plazos: cálculo puro de estado y texto. Sin tono de urgencia (docs/architecture.md, "UX sin presión"):
// el estado es informativo; el texto nunca grita.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `soon` marca la última ventana (menos de 12 h); solo cambia un matiz visual, no el lenguaje. */
export type DeadlineState = 'none' | 'ok' | 'soon' | 'overdue';

export type DeadlineStatus = { state: DeadlineState; remainingMs: number };

export function deadlineStatus(
  dueAt: string | null | undefined,
  now: Date | number = Date.now(),
): DeadlineStatus {
  if (!dueAt) return { state: 'none', remainingMs: 0 };
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return { state: 'none', remainingMs: 0 };
  const remainingMs = due - (typeof now === 'number' ? now : now.getTime());
  if (remainingMs <= 0) return { state: 'overdue', remainingMs };
  return { state: remainingMs < 12 * HOUR ? 'soon' : 'ok', remainingMs };
}

/** 90_000 → "1 min"; 3 h 20 min → "3 h 20 min"; 2 d 5 h → "2 d 5 h". Vencido → "Vencido". */
export function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return 'Vencido';
  if (remainingMs < MINUTE) return 'Menos de 1 min';
  const days = Math.floor(remainingMs / DAY);
  const hours = Math.floor((remainingMs % DAY) / HOUR);
  const minutes = Math.floor((remainingMs % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  return `${minutes} min`;
}

/** ¿Ya pasó la fecha? (hora del servidor que renderiza; la autoridad es Postgres.) */
export function isPastDue(
  dueAt: string | null | undefined,
  now: Date | number = Date.now(),
): boolean {
  return deadlineStatus(dueAt, now).state === 'overdue';
}
