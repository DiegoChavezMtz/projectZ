import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/utils/errors';

/** Devuelve el código del motivo si el usuario no puede eliminar su cuenta todavía, o null. */
export type DeletionBlocker = (userId: string) => Promise<string | null>;

/**
 * Bloqueos activos (docs/spec/auth.md, A15): eventos `live`, cuentas `awaiting_payment`/`payment_review`
 * y entregas sin completar, como comprador o vendedor. Esas tablas llegan en S4 (eventos), S5 y S8
 * (cuentas y entregas): cada sprint agrega aquí su consulta. En S3 no hay nada que consultar.
 */
export const deletionBlockers: DeletionBlocker[] = [];

// 42P01 / PGRST205: la tabla aún no existe (antes de la migración correspondiente).
const isMissingTable = (error: { code?: string } | null) =>
  error?.code === '42P01' || error?.code === 'PGRST205';

type Input = { userId: string; handleConfirmation: string };

export const accountDeletionService = {
  async blockersFor(userId: string, blockers: DeletionBlocker[] = deletionBlockers) {
    const reasons: string[] = [];
    for (const blocker of blockers) {
      const reason = await blocker(userId);
      if (reason) reasons.push(reason);
    }
    return reasons;
  },

  /**
   * Verifica la confirmación y los bloqueos, anonimiza el perfil (la referencia se conserva para cuentas y
   * reputación de terceros), borra el avatar, cierra la sesión y elimina el usuario de Auth.
   */
  async deleteAccount(input: Input, blockers: DeletionBlocker[] = deletionBlockers): Promise<void> {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from('profiles' as never)
      .select('handle')
      .eq('id' as never, input.userId as never)
      .maybeSingle();
    if (error || !profile)
      throw new AppError('delete_failed', 'No se pudo eliminar la cuenta', error);
    if ((profile as { handle: string }).handle !== input.handleConfirmation.trim())
      throw new AppError('handle_mismatch', 'El nombre de usuario no coincide');

    const reasons = await this.blockersFor(input.userId, blockers);
    if (reasons.length > 0)
      throw new AppError('deletion_blocked', 'No se puede eliminar todavía', { reasons });

    const { data: authUser } = await admin.auth.admin.getUserById(input.userId);
    const email = authUser.user?.email;

    // Anonimiza primero: si algo falla después, la cuenta no queda a medias con datos personales.
    const shortId = input.userId.replaceAll('-', '').slice(0, 8);
    const { error: anonymizeError } = await admin
      .from('profiles' as never)
      .update({
        display_name: 'Usuario eliminado',
        handle: `deleted_${shortId}`,
        avatar_path: null,
        deleted_at: new Date().toISOString(),
      } as never)
      .eq('id' as never, input.userId as never);
    if (anonymizeError)
      throw new AppError('delete_failed', 'No se pudo eliminar la cuenta', anonymizeError);

    const { error: sellerError } = await admin
      .from('seller_profiles' as never)
      .update({
        shop_name: 'Vendedor eliminado',
        bio: null,
        city: null,
        payment_instructions: null,
      } as never)
      .eq('user_id' as never, input.userId as never);
    if (sellerError && !isMissingTable(sellerError))
      throw new AppError('delete_failed', 'No se pudo eliminar la cuenta', sellerError);

    await this.removeAvatars(input.userId);
    if (email)
      await admin
        .from('email_codes' as never)
        .delete()
        .eq('email' as never, email.toLowerCase() as never);

    // Con la sesión todavía válida: cierra todas las del usuario y limpia las cookies de esta petición.
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: 'global' });

    const { error: deleteError } = await admin.auth.admin.deleteUser(input.userId);
    if (deleteError)
      throw new AppError('delete_failed', 'No se pudo eliminar la cuenta', deleteError);
  },

  /** Borra los archivos de la carpeta del usuario en `avatars`. Si el bucket aún no existe no hay nada que borrar. */
  async removeAvatars(userId: string): Promise<void> {
    const bucket = createAdminClient().storage.from('avatars');
    const { data, error } = await bucket.list(userId);
    if (error || !data?.length) return;
    await bucket.remove(data.map((file) => `${userId}/${file.name}`));
  },
};
