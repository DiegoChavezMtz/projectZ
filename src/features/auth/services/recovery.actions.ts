'use server';

import { redirect } from 'next/navigation';
import { isAppError } from '@/utils/errors';
import type { ActionState } from '../types';
import { requestCodeSchema, resetPasswordSchema, verifyEmailSchema } from '../utils/auth.schemas';
import { failure, fieldErrors, text } from '../utils/formData';
import { clientIp } from './requestInfo';
import { recoveryService } from './recovery.service';

/** Recuperar contraseña, paso 1: respuesta siempre genérica (A7). */
export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestCodeSchema.safeParse({ email: text(formData, 'email') });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await recoveryService.requestReset(
      parsed.data.email,
      await clientIp(),
      text(formData, 'captchaToken') || undefined,
    );
  } catch (error) {
    return failure(isAppError(error) ? error.code : 'unknown');
  }
  return { status: 'success' };
}

/** Paso 2: verifica el código, emite la cookie de un solo uso y lleva a /reset-password. */
export async function verifyResetCodeAction(
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
    await recoveryService.verifyCode(parsed.data.email, parsed.data.code);
  } catch (error) {
    return failure(isAppError(error) ? error.code : 'unknown');
  }
  redirect('/reset-password');
}

/** Paso 3: nueva contraseña. Consume el token; las demás sesiones quedan inválidas. */
export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: text(formData, 'password'),
    confirmPassword: text(formData, 'confirmPassword'),
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await recoveryService.resetPassword(parsed.data.password);
  } catch (error) {
    if (isAppError(error) && error.code === 'invalid_token')
      redirect('/forgot-password?error=expired');
    return failure(isAppError(error) ? error.code : 'unknown');
  }
  redirect('/login?reset=1');
}
