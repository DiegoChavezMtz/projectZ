import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyService } from './notify.service';

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * `POST /api/internal/deadlines`: ejecuta `process_deadlines()` (idempotente; también lo agenda pg_cron) y
 * envía los correos pendientes de la cola. Protegido por `CRON_SECRET` (`Authorization: Bearer`).
 */
export async function handleDeadlinesRequest(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, code: 'not_configured' }, { status: 503 });

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !safeEqual(token, secret)) {
    return Response.json({ ok: false, code: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await createAdminClient().rpc('process_deadlines');
  if (error) return Response.json({ ok: false, code: 'process_failed' }, { status: 500 });

  const mail = await notifyService.drainQueue();
  return Response.json({ ok: true, deadlines: data, mail });
}
