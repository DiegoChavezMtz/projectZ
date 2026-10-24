// Falla al arrancar el servidor (no en la primera petición) si falta alguna variable de entorno.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/env');
  }
}
