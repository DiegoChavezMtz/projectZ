import { randomUUID } from 'node:crypto';
import { adminClient, type AnyClient } from './supabase';
import { createTestUser, signInAs, type TestUser } from './users';

export type TestSeller = { user: TestUser; client: AnyClient };

/** Vendedor de prueba con seller_profile (alta por service role) y sesión iniciada. */
export async function createTestSeller(): Promise<TestSeller> {
  const user = await createTestUser();
  const { error } = await adminClient()
    .from('seller_profiles')
    .insert({
      user_id: user.id,
      slug: `t-${randomUUID().slice(0, 8)}`,
      shop_name: 'Tienda de prueba',
    });
  if (error) throw new Error(`No se pudo crear el vendedor de prueba: ${error.message}`);
  return { user, client: await signInAs(user) };
}

export const futureIso = (hours = 48) => new Date(Date.now() + hours * 3_600_000).toISOString();

export function sessionRow(sellerId: string, patch: Record<string, unknown> = {}) {
  return { seller_id: sellerId, title: 'Claim de prueba', starts_at: futureIso(), ...patch };
}

export function itemRow(sessionId: string, position: number, patch: Record<string, unknown> = {}) {
  return {
    session_id: sessionId,
    position,
    title: `Carta ${position}`,
    attributes: { language: 'es', condition: 'NM' },
    price_cents: 15_000,
    image_path: 'x/y/z.webp',
    ...patch,
  };
}

// --- Motor de claims (S5) -----------------------------------------------------------------------

export type RpcResult = {
  ok: boolean;
  code?: string;
  message?: string;
  [key: string]: unknown;
};

/** Llama una RPC y devuelve su `{ok, ...}`; una falla de transporte o de permisos lanza. */
export async function rpc(
  client: AnyClient,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<RpcResult> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`rpc ${fn}: ${error.code ?? ''} ${error.message}`);
  return data as RpcResult;
}

export type LiveSession = {
  seller: TestSeller;
  sessionId: string;
  itemIds: string[];
};

/**
 * Evento con N artículos, publicado y en vivo, creado por el propio vendedor (RLS + RPC reales).
 * `live: false` lo deja `scheduled`.
 */
export async function createLiveSession(
  seller: TestSeller,
  options: {
    items?: number;
    autoConfirm?: boolean;
    releaseMode?: 'all_at_start' | 'manual';
    priceCents?: number;
    live?: boolean;
    /** ISO; por defecto 48 h adelante. */
    startsAt?: string;
    /** ISO; cierre programado (S5-12). */
    closesAt?: string;
    /** Campos extra del evento (p. ej. allow_accumulate, plazos de cumplimiento). */
    patch?: Record<string, unknown>;
  } = {},
): Promise<LiveSession> {
  const {
    items = 1,
    autoConfirm = true,
    releaseMode = 'all_at_start',
    priceCents = 15_000,
  } = options;
  const { data: session, error } = await seller.client
    .from('claim_sessions')
    .insert(
      sessionRow(seller.user.id, {
        auto_confirm: autoConfirm,
        release_mode: releaseMode,
        ...(options.startsAt ? { starts_at: options.startsAt } : {}),
        ...(options.closesAt ? { closes_at: options.closesAt } : {}),
        ...options.patch,
      }),
    )
    .select('id')
    .single();
  if (error || !session) throw new Error(`No se pudo crear el evento: ${error?.message}`);

  const rows = Array.from({ length: items }, (_, i) =>
    itemRow(session.id, i + 1, { price_cents: priceCents }),
  );
  const { data: inserted, error: itemsError } = await seller.client
    .from('claim_items')
    .insert(rows)
    .select('id, position');
  if (itemsError || !inserted)
    throw new Error(`No se pudieron crear los artículos: ${itemsError?.message}`);

  const published = await rpc(seller.client, 'publish_session', { p_session_id: session.id });
  if (!published.ok) throw new Error(`publish_session: ${published.code}`);
  if (options.live !== false) {
    const started = await rpc(seller.client, 'start_session', { p_session_id: session.id });
    if (!started.ok) throw new Error(`start_session: ${started.code}`);
  }
  return {
    seller,
    sessionId: session.id,
    itemIds: inserted.sort((a, b) => a.position - b.position).map((row) => row.id),
  };
}

export type TestBuyer = { user: TestUser; client: AnyClient };

const isRateLimit = (message: string) => /rate limit|too many|429/i.test(message);
const isNetworkError = (message: string) =>
  /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|network|timeout|aborted/i.test(message);

/**
 * Crea N compradores con sesión iniciada. Auth limita las verificaciones de token por IP
 * (por defecto 30 cada 5 min): ante un límite espera y reintenta. Ver docs/supabase-setup.md.
 */
export async function createTestBuyers(count: number): Promise<TestBuyer[]> {
  const buyers: TestBuyer[] = [];
  for (let i = 0; i < count; i++) {
    let user: TestUser | undefined;
    for (let attempt = 0; ; attempt++) {
      try {
        user ??= await createTestUser();
        buyers.push({ user, client: await signInAs(user) });
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const rateLimited = isRateLimit(message);
        // Un corte de red momentáneo no debe tumbar una corrida de decenas de usuarios.
        if (!(rateLimited || isNetworkError(message)) || attempt >= 8) throw error;
        await new Promise((resolve) => setTimeout(resolve, rateLimited ? 65_000 : 10_000));
      }
    }
  }
  return buyers;
}

/** Consulta de auditoría (service role): debe devolver vacío en cada escenario. */
export async function auditSession(sessionId: string) {
  const { data, error } = await adminClient().rpc('audit_session', { p_session_id: sessionId });
  if (error) throw new Error(`audit_session: ${error.message}`);
  return data as { violation: string; item_id: string | null; detail: string }[];
}

export async function auditUserStats(userId: string) {
  const { data, error } = await adminClient().rpc('audit_user_stats', { p_user_id: userId });
  if (error) throw new Error(`audit_user_stats: ${error.message}`);
  return data as { metric: string; stored: number; actual: number }[];
}
