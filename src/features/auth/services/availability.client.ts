import { createClient } from '@/lib/supabase/client';

// Validación en vivo desde el navegador con las RPC públicas del esquema (docs/spec/auth.md, Validaciones).
export const availabilityClient = {
  async isHandleAvailable(handle: string): Promise<boolean> {
    const { data, error } = await createClient().rpc('is_handle_available', { p_handle: handle });
    if (error) throw error;
    return data === true;
  },

  async isSlugAvailable(slug: string): Promise<boolean> {
    const { data, error } = await createClient().rpc('is_slug_available', { p_slug: slug });
    if (error) throw error;
    return data === true;
  },
};
