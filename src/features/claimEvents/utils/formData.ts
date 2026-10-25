import type { ActionState } from '../types';

// Helpers puros de las Server Actions.
export const text = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

/** Primer error por campo de la raíz del path (`attributes.language` → `attributes`). */
export function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Partial<Record<string, string>> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.');
    const root = String(issue.path[0] ?? '');
    for (const k of [key, root]) if (k && !errors[k]) errors[k] = issue.message;
  }
  return errors;
}

export const failure = (code: string, extra: Partial<ActionState> = {}): ActionState => ({
  status: 'error',
  code,
  ...extra,
});

/** Archivo opcional del formulario: vacío (0 bytes) equivale a "sin archivo". */
export function optionalFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}
