import 'server-only';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppError } from '@/utils/errors';
import type { CodePurpose, EmailCodeRow, VerifyCodeResult } from '../types';
import {
  RATE_WINDOW_MS,
  checkCode,
  cooldownRemaining,
  expiryFrom,
  generateCode,
  hashCode,
  hashIp,
  isRateLimited,
  toEmailKey,
} from '../utils/emailCode.utils';

// Hasta que `pnpm db:types` tipe email_codes, la tabla se referencia con casts mínimos.
const table = () => createAdminClient().from('email_codes' as never);
const rows = <T>(data: unknown) => (data ?? []) as T;

type IssueOptions = { userId?: string; payload?: Record<string, unknown>; ip?: string };

export const emailCodeService = {
  /**
   * Emite un código nuevo e invalida el anterior del mismo (email, purpose).
   * Errores: `cooldown` (details.seconds), `rate_limited`. El llamador envía el correo.
   */
  async issue(
    email: string,
    purpose: CodePurpose,
    options: IssueOptions = {},
  ): Promise<{ code: string }> {
    const key = toEmailKey(email);
    const now = new Date();
    const since = new Date(now.getTime() - RATE_WINDOW_MS).toISOString();
    const ipHash = options.ip ? hashIp(env.EMAIL_CODE_SECRET, options.ip) : null;

    const { data: recent, error } = await table()
      .select('created_at')
      .eq('email' as never, key as never)
      .eq('purpose' as never, purpose as never)
      .gte('created_at' as never, since as never)
      .order('created_at' as never, { ascending: false });
    if (error) throw new AppError('code_issue_failed', 'No se pudo emitir el código', error);
    const recentRows = rows<{ created_at: string }[]>(recent);

    const wait = cooldownRemaining(recentRows[0]?.created_at ?? null, now);
    if (wait > 0)
      throw new AppError('cooldown', 'Espera antes de pedir otro código', { seconds: wait });

    let byIp: number | null = null;
    if (ipHash) {
      const { count, error: ipError } = await table()
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash' as never, ipHash as never)
        .gte('created_at' as never, since as never);
      if (ipError) throw new AppError('code_issue_failed', 'No se pudo emitir el código', ipError);
      byIp = count ?? 0;
    }
    if (isRateLimited({ byEmail: recentRows.length, byIp }))
      throw new AppError('rate_limited', 'Demasiados códigos solicitados');

    // Invalida el anterior vigente.
    const { error: invalidateError } = await table()
      .update({ consumed_at: now.toISOString() } as never)
      .eq('email' as never, key as never)
      .eq('purpose' as never, purpose as never)
      .is('consumed_at' as never, null as never);
    if (invalidateError)
      throw new AppError('code_issue_failed', 'No se pudo emitir el código', invalidateError);

    const code = generateCode();
    const { error: insertError } = await table().insert({
      email: key,
      purpose,
      user_id: options.userId ?? null,
      code_hash: hashCode(env.EMAIL_CODE_SECRET, key, purpose, code),
      payload: options.payload ?? {},
      expires_at: expiryFrom(now).toISOString(),
      ip_hash: ipHash,
    } as never);
    if (insertError)
      throw new AppError('code_issue_failed', 'No se pudo emitir el código', insertError);

    return { code };
  },

  /** Verifica el código más reciente sin consumir. Consume al acertar; cuenta intentos al fallar. */
  async verify(email: string, purpose: CodePurpose, code: string): Promise<VerifyCodeResult> {
    const key = toEmailKey(email);
    const { data, error } = await table()
      .select('*')
      .eq('email' as never, key as never)
      .eq('purpose' as never, purpose as never)
      .is('consumed_at' as never, null as never)
      .order('created_at' as never, { ascending: false })
      .limit(1);
    if (error) throw new AppError('code_verify_failed', 'No se pudo verificar el código', error);

    const row = rows<EmailCodeRow[]>(data)[0] ?? null;
    const expected = hashCode(env.EMAIL_CODE_SECRET, key, purpose, code);
    const result = checkCode(row, expected);
    if (!row) return { ok: false, reason: 'invalid' };

    if (result.status === 'ok') {
      // Consumo atómico: si otra petición ganó la carrera, esta ya no encuentra fila.
      const { data: consumed, error: consumeError } = await table()
        .update({ consumed_at: new Date().toISOString() } as never)
        .eq('id' as never, row.id as never)
        .is('consumed_at' as never, null as never)
        .select('id');
      if (consumeError)
        throw new AppError('code_verify_failed', 'No se pudo verificar el código', consumeError);
      if (rows<unknown[]>(consumed).length === 0) return { ok: false, reason: 'invalid' };
      return { ok: true, userId: row.user_id, payload: row.payload };
    }

    if (result.status === 'incorrect' || result.status === 'exhausted') {
      const attempts = row.attempts + 1;
      await table()
        .update({
          attempts,
          ...(result.status === 'exhausted' ? { consumed_at: new Date().toISOString() } : {}),
        } as never)
        .eq('id' as never, row.id as never);
      return result.status === 'incorrect'
        ? { ok: false, reason: 'incorrect', attemptsLeft: result.attemptsLeft }
        : { ok: false, reason: 'exhausted' };
    }
    return { ok: false, reason: result.status };
  },

  /** Último código emitido para (email, purpose), consumido o no. Para localizar al usuario pendiente. */
  async findLatest(email: string, purpose: CodePurpose): Promise<EmailCodeRow | null> {
    const { data, error } = await table()
      .select('*')
      .eq('email' as never, toEmailKey(email) as never)
      .eq('purpose' as never, purpose as never)
      .order('created_at' as never, { ascending: false })
      .limit(1);
    if (error) throw new AppError('code_verify_failed', 'No se pudo consultar el código', error);
    return rows<EmailCodeRow[]>(data)[0] ?? null;
  },
};
