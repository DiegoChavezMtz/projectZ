'use server';

import { redirect } from 'next/navigation';
import { isAppError } from '@/utils/errors';
import type { ActionState } from '../types';
import {
  loginSchema,
  requestCodeSchema,
  signupSchema,
  verifyEmailSchema,
} from '../utils/auth.schemas';
import { failure, fieldErrors, text, verifyUrl } from '../utils/formData';
import { sanitizeNextPath } from '../utils/nextPath';
import { authService } from './auth.service';
import { clientIp } from './requestInfo';

// Server Actions: validan con Zod, devuelven estado serializable (useActionState) y redirigen con `next` seguro.
const captcha = (formData: FormData) => text(formData, 'captchaToken') || undefined;

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
    const result = await authService.signUp({
      ...parsed.data,
      ip: await clientIp(),
      captchaToken: captcha(formData),
    });
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
  const parsed = requestCodeSchema.safeParse({ email: text(formData, 'email') });
  if (!parsed.success) return failure('validation');
  try {
    await authService.requestResend(parsed.data.email, await clientIp(), captcha(formData));
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
    const result = await authService.signInWithPassword({
      ...parsed.data,
      ip: await clientIp(),
      captchaToken: captcha(formData),
    });
    if (result.status === 'unverified') redirect(verifyUrl(parsed.data.email, next));
  } catch (error) {
    if (!isAppError(error)) throw error; // incluye la señal de redirect de Next
    return failure(error.code);
  }
  redirect(next);
}

/** Acceso por código, paso 1: respuesta genérica (A5). */
export async function requestLoginCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestCodeSchema.safeParse({ email: text(formData, 'email') });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await authService.requestLoginCode(parsed.data.email, await clientIp(), captcha(formData));
  } catch (error) {
    return failure(isAppError(error) ? error.code : 'unknown');
  }
  return { status: 'success' };
}

/** Acceso por código, paso 2. */
export async function verifyLoginCodeAction(
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
    await authService.verifyLoginCode(parsed.data.email, parsed.data.code);
  } catch (error) {
    return failure(isAppError(error) ? error.code : 'unknown');
  }
  redirect(sanitizeNextPath(text(formData, 'next')));
}

/** Reenvío del código de acceso (misma respuesta genérica; el cooldown es del cliente). */
export async function resendLoginCodeAction(
  prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return requestLoginCodeAction(prev, formData);
}

export async function signOutAction(): Promise<void> {
  await authService.signOut();
  redirect('/');
}
