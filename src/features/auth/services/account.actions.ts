'use server';

import { redirect } from 'next/navigation';
import { isAppError } from '@/utils/errors';
import type { ActionState } from '../types';
import {
  changeEmailSchema,
  changePasswordSchema,
  codeSchema,
  deleteAccountSchema,
  emailSchema,
} from '../utils/auth.schemas';
import { failure, fieldErrors, text } from '../utils/formData';
import { sanitizeNextPath } from '../utils/nextPath';
import { accountDeletionService } from './accountDeletion.service';
import { accountService } from './account.service';
import { authService } from './auth.service';
import { clientIp } from './requestInfo';

const captcha = (formData: FormData) => text(formData, 'captchaToken') || undefined;

async function currentUser() {
  const user = await authService.getUser();
  if (!user) redirect('/login?next=%2Faccount%2Fsecurity');
  return user;
}

const errorCode = (error: unknown) => (isAppError(error) ? error.code : 'unknown');

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: text(formData, 'currentPassword'),
    password: text(formData, 'password'),
    confirmPassword: text(formData, 'confirmPassword'),
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await accountService.changePassword({
      user,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.password,
      ip: await clientIp(),
      captchaToken: captcha(formData),
    });
  } catch (error) {
    return failure(errorCode(error));
  }
  return { status: 'success' };
}

/** Cambio de correo, paso 1: pide el código al correo nuevo. Respuesta genérica. */
export async function requestEmailChangeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  const parsed = changeEmailSchema.safeParse({
    newEmail: text(formData, 'newEmail'),
    currentPassword: text(formData, 'currentPassword'),
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await accountService.requestEmailChange({
      user,
      newEmail: parsed.data.newEmail,
      currentPassword: parsed.data.currentPassword,
      ip: await clientIp(),
      captchaToken: captcha(formData),
    });
  } catch (error) {
    return failure(errorCode(error));
  }
  return { status: 'success' };
}

/** Paso 2: verifica el código y cambia el correo. */
export async function verifyEmailChangeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  const email = emailSchema.safeParse(text(formData, 'email'));
  const code = codeSchema.safeParse(text(formData, 'code'));
  if (!email.success || !code.success) return failure('validation');
  try {
    await accountService.verifyEmailChange(user, email.data, code.data);
  } catch (error) {
    return failure(errorCode(error));
  }
  redirect('/account/security?email=changed');
}

export async function signOutEverywhereAction(): Promise<void> {
  await accountService.signOutEverywhere();
  redirect('/login?signedOut=1');
}

export async function acceptTermsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  if (formData.get('acceptTerms') !== 'on' && formData.get('acceptTerms') !== 'true')
    return failure('validation', { fieldErrors: { acceptTerms: 'required' } });
  try {
    await authService.acceptTerms(user.id);
  } catch (error) {
    return failure(errorCode(error));
  }
  redirect(sanitizeNextPath(text(formData, 'next')));
}

export async function deleteAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await currentUser();
  const parsed = deleteAccountSchema.safeParse({ handle: text(formData, 'handle') });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await accountDeletionService.deleteAccount({
      userId: user.id,
      handleConfirmation: parsed.data.handle,
    });
  } catch (error) {
    return failure(errorCode(error));
  }
  redirect('/?account=deleted');
}
