'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAppError } from '@/utils/errors';
import type { ActionState } from '../types';
import { loginSchema, signupSchema, verifyEmailSchema } from '../utils/auth.schemas';
import { sanitizeNextPath } from '../utils/nextPath';
import { authService } from './auth.service';

// Server Actions: validan con Zod, devuelven estado serializable (useActionState) y redirigen con `next` seguro.

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || undefined;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Partial<Record<string, string>> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const failure = (code: string, extra: Partial<ActionState> = {}): ActionState => ({
  status: 'error',
  code,
  ...extra,
});

const verifyUrl = (email: string, next: string) =>
  `/verify-email?email=${encodeURIComponent(email)}${next === '/' ? '' : `&next=${encodeURIComponent(next)}`}`;

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    email: text(formData, 'email'),
    password: text(formData, 'password'),
    displayName: text(formData, 'displayName'),
    acceptTerms: formData.get('acceptTerms') === 'on' || formData.get('acceptTerms') === 'true',
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });

  const next = sanitizeNextPath(text(formData, 'next'));
  try {
    const result = await authService.signUp({ ...parsed.data, ip: await clientIp() });
    if (result.status === 'email_exists') return failure('email_exists');
  } catch (error) {
    return failure(isAppError(error) ? error.code : 'unknown');
  }
  redirect(verifyUrl(parsed.data.email, next));
}

export async function verifyEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = verifyEmailSchema.safeParse({
    email: text(formData, 'email'),
    code: text(formData, 'code'),
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });

  try {
    await authService.verifyEmail(parsed.data.email, parsed.data.code);
  } catch (error) {
    return failure(isAppError(error) ? error.code : 'unknown');
  }
  redirect(sanitizeNextPath(text(formData, 'next')));
}

export async function resendCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = verifyEmailSchema
    .pick({ email: true })
    .safeParse({ email: text(formData, 'email') });
  if (!parsed.success) return failure('validation');
  try {
    await authService.resendCode(parsed.data.email, await clientIp());
  } catch (error) {
    if (isAppError(error) && error.code === 'cooldown') {
      const seconds = (error.details as { seconds?: number } | undefined)?.seconds;
      return failure('cooldown', { retryAfter: seconds });
    }
    return failure(isAppError(error) ? error.code : 'unknown');
  }
  return { status: 'success' };
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: text(formData, 'email'),
    password: text(formData, 'password'),
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });

  const next = sanitizeNextPath(text(formData, 'next'));
  try {
    const result = await authService.signInWithPassword({ ...parsed.data, ip: await clientIp() });
    if (result.status === 'unverified') redirect(verifyUrl(parsed.data.email, next));
  } catch (error) {
    if (!isAppError(error)) throw error; // incluye la señal de redirect de Next
    return failure(error.code);
  }
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  await authService.signOut();
  redirect('/');
}
