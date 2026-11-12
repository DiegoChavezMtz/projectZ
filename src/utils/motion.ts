/** Preferencia de movimiento: interruptor guardado > preferencia del sistema. Valores de `data-motion`. */
export type MotionPreference = 'on' | 'off';

export const MOTION_STORAGE_KEY = 'zl-motion';

/** Lee el valor guardado; null si no hay o el almacenamiento no está disponible. */
export function readStoredMotion(
  storage: Pick<Storage, 'getItem'> | null,
): MotionPreference | null {
  try {
    const value = storage?.getItem(MOTION_STORAGE_KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch {
    return null;
  }
}

export function storeMotion(
  storage: Pick<Storage, 'setItem'> | null,
  value: MotionPreference,
): void {
  try {
    storage?.setItem(MOTION_STORAGE_KEY, value);
  } catch {
    // Sin almacenamiento (modo privado): la preferencia vale solo para esta visita.
  }
}

/** Resuelve el valor inicial: guardado > sistema (`prefers-reduced-motion: reduce`) > 'on'. */
export function resolveMotion(
  stored: MotionPreference | null,
  systemReduces: boolean,
): MotionPreference {
  return stored ?? (systemReduces ? 'off' : 'on');
}

/** Script en línea que fija `data-motion` antes de pintar (evita el parpadeo). Misma lógica que `resolveMotion`. */
export const motionInitScript = `(function(){var m='on';try{var s=localStorage.getItem('${MOTION_STORAGE_KEY}');if(s==='on'||s==='off')m=s;else if(matchMedia('(prefers-reduced-motion: reduce)').matches)m='off';}catch(e){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)m='off';}catch(_){}}document.documentElement.setAttribute('data-motion',m);})();`;
