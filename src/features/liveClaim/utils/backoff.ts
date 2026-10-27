const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

/** Espera antes del intento número `attempt` (0, 1, 2…): 1 s, 2 s, 4 s… con tope de 30 s. */
export const backoffDelay = (attempt: number) =>
  Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
