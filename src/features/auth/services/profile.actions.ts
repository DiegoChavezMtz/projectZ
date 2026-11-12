'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { emailService } from '@/services/email.service';
import { AppError } from '@/utils/errors';
import type { ActionState } from '../types';
import { profileSchema, sellerSchema, shopProfileSchema } from '../utils/auth.schemas';
import { AVATAR_MAX_UPLOAD_BYTES } from '../utils/avatar';
import { failure, fieldErrors, text } from '../utils/formData';
import { authService } from './auth.service';
import { profileService } from './profile.service';

// El header (nombre, foto, "Mi tienda") vive en el layout raíz: hay que invalidarlo tras cada cambio.
const refreshHeader = () => revalidatePath('/', 'layout');

const errorCode = (error: unknown) => (error instanceof AppError ? error.code : 'unknown');

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await authService.requireUser('/account');
  const parsed = profileSchema.safeParse({
    displayName: text(formData, 'displayName'),
    handle: text(formData, 'handle'),
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await profileService.update(user.id, parsed.data);
    refreshHeader();
  } catch (error) {
    const code = errorCode(error);
    return code === 'handle_taken'
      ? failure(code, { fieldErrors: { handle: 'taken' } })
      : failure(code);
  }
  return { status: 'success' };
}

export async function uploadAvatarAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, profile } = await authService.requireUser('/account');
  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size > AVATAR_MAX_UPLOAD_BYTES) return failure('avatar_size');
  try {
    await profileService.setAvatar(user.id, file, profile.avatar_path);
    refreshHeader();
  } catch (error) {
    return failure(errorCode(error));
  }
  return { status: 'success' };
}

/** Ajustes de la tienda: nombre, descripción y ciudad (el enlace no cambia). */
export async function updateShopAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await authService.requireSeller('/dashboard/settings');
  const parsed = shopProfileSchema.safeParse({
    shopName: text(formData, 'shopName'),
    bio: text(formData, 'bio'),
    city: text(formData, 'city'),
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await profileService.updateSeller(user.id, parsed.data);
    refreshHeader();
  } catch (error) {
    return failure(errorCode(error));
  }
  return { status: 'success' };
}

export async function createSellerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, profile } = await authService.requireUser('/onboarding/seller');
  const parsed = sellerSchema.safeParse({
    shopName: text(formData, 'shopName'),
    slug: text(formData, 'slug'),
    bio: text(formData, 'bio'),
    city: text(formData, 'city'),
    paymentInstructions: text(formData, 'paymentInstructions'),
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await profileService.createSeller(user.id, parsed.data);
    refreshHeader();
  } catch (error) {
    const code = errorCode(error);
    return code === 'slug_taken'
      ? failure(code, { fieldErrors: { slug: 'taken' } })
      : failure(code);
  }
  // Bienvenida con la variante de vendedor. Un fallo de correo no deshace la tienda.
  if (user.email) {
    try {
      await emailService.send({
        to: user.email,
        template: 'welcome',
        data: { displayName: profile.display_name, isSeller: true },
      });
    } catch (error) {
      console.error('[auth] welcome_failed', error instanceof AppError ? error.code : 'unknown');
    }
  }
  redirect('/dashboard');
}
