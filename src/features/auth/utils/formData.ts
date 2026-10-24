import type { ActionState } from '../types';

// Helpers puros de las Server Actions.
export const text = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

export function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Partial<Record<string, string>> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export const failure = (code: string, extra: Partial<ActionState> = {}): ActionState => ({
  status: 'error',
  code,
  ...extra,
});

export const verifyUrl = (email: string, next: string) =>
  `/verify-email?email=${encodeURIComponent(email)}${next === '/' ? '' : `&next=${encodeURIComponent(next)}`}`;
