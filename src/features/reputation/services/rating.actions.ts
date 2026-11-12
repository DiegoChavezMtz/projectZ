'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/utils/errors';
import { unwrapRpc } from '@/utils/rpc';
import { reputationErrors } from '../content/es-MX';
import type { RatingResult } from '../types';
import { RATING_TAGS } from '../utils/reputation.utils';

const schema = z.object({
  orderId: z.string().uuid(),
  stars: z.number().int().min(1).max(5),
  tags: z.array(z.enum(RATING_TAGS as [string, ...string[]])).max(4),
  comment: z.string().trim().max(280).optional(),
});

/** Califica una cuenta completada. Postgres valida rol, ventana, etiquetas y unicidad. */
export async function submitRatingAction(
  input: z.input<typeof schema>,
  next: string,
): Promise<RatingResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: 'validation_failed', message: reputationErrors.validation_failed! };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(next)}`);

  try {
    const { data, error } = await supabase.rpc('submit_rating', {
      p_order_id: parsed.data.orderId,
      p_stars: parsed.data.stars,
      p_tags: parsed.data.tags,
      p_comment: parsed.data.comment || undefined,
    });
    unwrapRpc(data, error, reputationErrors);
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'unknown';
    return {
      ok: false,
      code,
      message: reputationErrors[code] ?? reputationErrors.unknown!,
    };
  }
  revalidatePath('/orders', 'layout');
  revalidatePath('/dashboard/orders');
  return { ok: true };
}
