import 'server-only';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/utils/errors';
import type { Seller } from '../types';
import { AVATAR_MAX_UPLOAD_BYTES, avatarPathFor } from '../utils/avatar';

const UNIQUE_VIOLATION = '23505';
const SELLER_COLUMNS = 'user_id, slug, shop_name, bio, city, payment_instructions, created_at';

// Perfil y vendedor del usuario en sesión. Todo pasa por RLS (cliente con cookies): el usuario solo puede
// escribir lo suyo, y las columnas editables las limita el privilegio por columna de la migración.
export const profileService = {
  async update(userId: string, input: { displayName: string; handle: string }): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: input.displayName, handle: input.handle })
      .eq('id', userId);
    if (error?.code === UNIQUE_VIOLATION)
      throw new AppError('handle_taken', 'Ese nombre de usuario ya está en uso', error);
    if (error) throw new AppError('profile_failed', 'No se pudo guardar el perfil', error);
  },

  /** Sube el WebP ya redimensionado a `avatars/<user_id>/<marca>.webp`, apunta el perfil a él y borra el anterior. */
  async setAvatar(userId: string, file: File, previousPath: string | null): Promise<string> {
    if (file.type !== 'image/webp') throw new AppError('avatar_type', 'Formato no permitido');
    if (file.size === 0 || file.size > AVATAR_MAX_UPLOAD_BYTES)
      throw new AppError('avatar_size', 'Imagen demasiado pesada');

    const supabase = await createClient();
    const path = avatarPathFor(userId, Date.now());
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: 'image/webp', upsert: false });
    if (uploadError) throw new AppError('avatar_failed', 'No se pudo subir la foto', uploadError);

    const { error } = await supabase
      .from('profiles')
      .update({ avatar_path: path })
      .eq('id', userId);
    if (error) {
      await supabase.storage.from('avatars').remove([path]);
      throw new AppError('avatar_failed', 'No se pudo guardar la foto', error);
    }
    if (previousPath && previousPath !== path && previousPath.startsWith(`${userId}/`))
      await supabase.storage.from('avatars').remove([previousPath]);
    return path;
  },

  /** Tienda del usuario (incluye `payment_instructions`: es el dueño), o null si aún no es vendedor. */
  async getSeller(user: Pick<User, 'id'>): Promise<Seller | null> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('seller_profiles')
      .select(SELLER_COLUMNS)
      .eq('user_id', user.id)
      .maybeSingle();
    return data ?? null;
  },

  /** Perfil de la tienda (nombre, descripción, ciudad). RLS `seller_profiles_update_own`; el enlace no cambia. */
  async updateSeller(
    userId: string,
    input: { shopName: string; bio: string | null; city: string | null },
  ): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('seller_profiles')
      .update({ shop_name: input.shopName, bio: input.bio, city: input.city })
      .eq('user_id', userId);
    if (error) throw new AppError('seller_failed', 'No se pudo guardar la tienda', error);
  },

  async createSeller(
    userId: string,
    input: {
      shopName: string;
      slug: string;
      bio: string | null;
      city: string | null;
      paymentInstructions: string | null;
    },
  ): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from('seller_profiles').insert({
      user_id: userId,
      slug: input.slug,
      shop_name: input.shopName,
      bio: input.bio,
      city: input.city,
      payment_instructions: input.paymentInstructions,
    });
    if (error?.code === UNIQUE_VIOLATION)
      throw new AppError('slug_taken', 'Ese enlace ya está en uso', error);
    if (error) throw new AppError('seller_failed', 'No se pudo crear la tienda', error);
  },
};
