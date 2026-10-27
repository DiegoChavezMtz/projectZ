/** Diferencia (servidor − dispositivo) en ms. Sumarla a `Date.now()` da la hora del servidor. */
export function clockOffset(serverNowMs: number, clientNowMs: number): number {
  return serverNowMs - clientNowMs;
}

/**
 * Offset a partir de una medición con ida y vuelta: se asume que la respuesta tardó la mitad del
 * viaje, así que la hora del servidor "ahora" es `serverMs + rtt / 2`.
 */
export function clockOffsetFromSample(sample: {
  serverMs: number;
  sentAtMs: number;
  receivedAtMs: number;
}): number {
  const rtt = Math.max(0, sample.receivedAtMs - sample.sentAtMs);
  return sample.serverMs + rtt / 2 - sample.receivedAtMs;
}

/** Milisegundos que faltan para `targetIso` (nunca negativo). */
export function remainingMs(targetIso: string, clientNowMs: number, offsetMs: number): number {
  return Math.max(0, Date.parse(targetIso) - (clientNowMs + offsetMs));
}

export type Remaining = { days: number; hours: number; minutes: number; seconds: number };

export function splitRemaining(ms: number): Remaining {
  // Se redondea hacia arriba: "00:00" solo aparece cuando el tiempo realmente se acabó.
  const total = Math.max(0, Math.ceil(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2 d 03:15:09" / "03:15:09" / "15:09". Tipografía normal, sin tono de alarma. */
export function formatRemaining(ms: number): string {
  const { days, hours, minutes, seconds } = splitRemaining(ms);
  const clock =
    hours > 0 || days > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days} d ${clock}` : clock;
}

/** Texto para lectores de pantalla, sin segundos: "2 días, 3 horas y 15 minutos". */
export function describeRemaining(ms: number): string {
  const { days, hours, minutes } = splitRemaining(ms);
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  if (minutes || parts.length === 0)
    parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  const last = parts.pop();
  return parts.length ? `${parts.join(', ')} y ${last}` : (last ?? '');
}
