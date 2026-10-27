const KEY = 'zlotify:how-it-works:dismissed';

// El descarte vive solo en el navegador; si el almacenamiento no está disponible (modo privado,
// datos bloqueados) el panel funciona igual y simplemente reaparece en la siguiente visita.
export function readHowItWorksDismissed(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    return (storage ?? window.localStorage).getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function writeHowItWorksDismissed(storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? window.localStorage).setItem(KEY, '1');
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}
