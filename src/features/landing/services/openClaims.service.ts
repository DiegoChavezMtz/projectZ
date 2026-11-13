import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { createStatelessClient } from '@/lib/supabase/stateless';
import type { OpenClaim } from '../types';
import { MAX_OPEN_CLAIMS, buildOpenClaims } from '../utils/openClaims';

/**
 * Consulta pública de claims abiertos y próximos (vista `public_open_claims`, migración 29, + fotos de
 * `claim_items` bajo su RLS pública). Sin la vista aplicada, o ante cualquier error de lectura, devuelve
 * `[]`: la landing cae al estado vacío en vez de romperse.
 */
export async function queryOpenClaims(supabase: SupabaseClient): Promise<OpenClaim[]> {
  const claims = await supabase
    .from('public_open_claims')
    .select('id, code, title, status, starts_at, shop_name, handle, item_count')
    .in('status', ['live', 'scheduled'])
    .order('starts_at', { ascending: true })
    .limit(MAX_OPEN_CLAIMS);
  if (claims.error || !claims.data?.length) return [];

  const photos = await supabase
    .from('claim_items')
    .select('session_id, image_path, position')
    .in(
      'session_id',
      claims.data.map((row) => row.id),
    )
    .not('image_path', 'is', null)
    .order('position');
  return buildOpenClaims(claims.data, photos.error ? [] : (photos.data ?? []));
}

/**
 * Lista pública igual para todos: se cachea con revalidación corta (60 s) y un cliente anónimo sin cookies,
 * así la landing no se vuelve dinámica por la sesión de quien la mira.
 */
export async function listOpenClaims(): Promise<OpenClaim[]> {
  'use cache';
  cacheLife({ stale: 30, revalidate: 60, expire: 600 });
  cacheTag('open-claims');
  return queryOpenClaims(createStatelessClient() as unknown as SupabaseClient);
}

export const openClaimsService = { list: listOpenClaims };
