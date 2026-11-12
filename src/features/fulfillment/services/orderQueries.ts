import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { reputationBadgeService } from '@/services/reputation.service';
import type { Database } from '@/types/database.types';
import { AppError } from '@/utils/errors';
import type {
  BuyerOrders,
  DeliveryRow,
  DeliveryView,
  DisputeView,
  OrderItemLine,
  OrderRow,
  OrderView,
  ProofView,
  SellerInbox,
} from '../types';

type Client = SupabaseClient<Database>;
type Role = 'buyer' | 'seller';

export const LIST_LIMIT = 200;
const SIGNED_URL_SECONDS = 600;

const fail = (what: string, error: unknown) =>
  new AppError('load_failed', `No se pudo cargar ${what}`, error);

async function loadSessions(supabase: Client, ids: string[]) {
  if (ids.length === 0)
    return new Map<string, { title: string; code: string; allow: boolean; days: number }>();
  const { data, error } = await supabase
    .from('claim_sessions')
    .select('id, title, code, allow_accumulate, accumulate_days')
    .in('id', ids);
  if (error) throw fail('los eventos', error);
  return new Map(
    data.map((s) => [
      s.id,
      { title: s.title, code: s.code, allow: s.allow_accumulate, days: s.accumulate_days },
    ]),
  );
}

/** Nombre de la contraparte: tienda (vista del comprador) o nombre público del comprador (vista del vendedor). */
async function loadNames(supabase: Client, role: Role, ids: string[]) {
  const unique = [...new Set(ids)];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  if (role === 'buyer') {
    const { data, error } = await supabase
      .from('public_seller_profiles')
      .select('user_id, shop_name')
      .in('user_id', unique);
    if (error) throw fail('las tiendas', error);
    for (const row of data) if (row.user_id) names.set(row.user_id, row.shop_name ?? '');
  } else {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, display_name, handle')
      .in('id', unique);
    if (error) throw fail('a los compradores', error);
    for (const row of data) if (row.id) names.set(row.id, row.display_name ?? row.handle ?? '');
  }
  return names;
}

async function loadItems(supabase: Client, orderIds: string[]) {
  const byOrder = new Map<string, OrderItemLine[]>();
  if (orderIds.length === 0) return byOrder;
  const { data: wins, error } = await supabase
    .from('claim_wins')
    .select('order_id, item_id, price_cents, won_at')
    .in('order_id', orderIds)
    .order('won_at');
  if (error) throw fail('los artículos', error);
  const itemIds = wins.map((w) => w.item_id);
  const { data: items, error: itemsError } = await supabase
    .from('claim_items')
    .select('id, title, image_path')
    .in('id', itemIds);
  if (itemsError) throw fail('los artículos', itemsError);
  const info = new Map(items.map((i) => [i.id, i]));
  for (const win of wins) {
    if (!win.order_id) continue;
    const item = info.get(win.item_id);
    const list = byOrder.get(win.order_id) ?? [];
    list.push({
      id: win.item_id,
      title: item?.title ?? '',
      priceCents: win.price_cents,
      imagePath: item?.image_path ?? null,
    });
    byOrder.set(win.order_id, list);
  }
  return byOrder;
}

async function loadDisputes(supabase: Client, orderIds: string[]) {
  const map = new Map<string, DisputeView>();
  if (orderIds.length === 0) return map;
  const { data, error } = await supabase
    .from('order_disputes')
    .select('order_id, note, status, resolution_note')
    .in('order_id', orderIds);
  if (error) throw fail('las objeciones', error);
  for (const row of data)
    map.set(row.order_id, {
      note: row.note,
      status: row.status,
      resolutionNote: row.resolution_note,
    });
  return map;
}

/**
 * Comprobantes de cuentas y entregas. Solo los pendientes de revisión llevan URL firmada (la vista
 * del vendedor los abre; el comprador ve el estado de los suyos sin descargar nada).
 */
async function loadProofs(
  supabase: Client,
  orderIds: string[],
  deliveryIds: string[],
  withUrls: boolean,
) {
  const byTarget = new Map<string, ProofView[]>();
  const rows: {
    id: string;
    order_id: string | null;
    delivery_id: string | null;
    file_path: string;
    status: ProofView['status'];
    reject_reason: string | null;
    created_at: string;
  }[] = [];
  for (const [column, ids] of [
    ['order_id', orderIds],
    ['delivery_id', deliveryIds],
  ] as const) {
    if (ids.length === 0) continue;
    const { data, error } = await supabase
      .from('payment_proofs')
      .select('id, order_id, delivery_id, file_path, status, reject_reason, created_at')
      .in(column, ids)
      .order('created_at');
    if (error) throw fail('los comprobantes', error);
    rows.push(...data);
  }

  const urls = new Map<string, string>();
  if (withUrls) {
    const pending = rows.filter((r) => r.status === 'submitted');
    if (pending.length > 0) {
      const { data } = await supabase.storage.from('payment-proofs').createSignedUrls(
        pending.map((r) => r.file_path),
        SIGNED_URL_SECONDS,
      );
      for (const entry of data ?? [])
        if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
    }
  }

  for (const row of rows) {
    const key = row.order_id ?? row.delivery_id;
    if (!key) continue;
    const list = byTarget.get(key) ?? [];
    list.push({
      id: row.id,
      status: row.status,
      rejectReason: row.reject_reason,
      createdAt: row.created_at,
      url: urls.get(row.file_path) ?? null,
      isPdf: row.file_path.toLowerCase().endsWith('.pdf'),
    });
    byTarget.set(key, list);
  }
  return byTarget;
}

async function hydrate(
  supabase: Client,
  role: Role,
  orders: OrderRow[],
  deliveries: DeliveryRow[],
): Promise<{ orders: OrderView[]; deliveries: DeliveryView[] }> {
  const counterpartOf = (row: { seller_id: string; buyer_id: string }) =>
    role === 'buyer' ? row.seller_id : row.buyer_id;
  const [sessions, names, badges, items, disputes, proofs] = await Promise.all([
    loadSessions(supabase, [...new Set(orders.map((o) => o.session_id))]),
    loadNames(supabase, role, [...orders, ...deliveries].map(counterpartOf)),
    reputationBadgeService.forUsers(supabase, [...orders, ...deliveries].map(counterpartOf), {
      asRole: role === 'buyer' ? 'seller' : 'buyer',
    }),
    loadItems(
      supabase,
      orders.map((o) => o.id),
    ),
    loadDisputes(
      supabase,
      orders.map((o) => o.id),
    ),
    loadProofs(
      supabase,
      orders.map((o) => o.id),
      deliveries.map((d) => d.id),
      role === 'seller',
    ),
  ]);

  const orderViews = orders.map<OrderView>((order) => {
    const session = sessions.get(order.session_id);
    return {
      order,
      sessionTitle: session?.title ?? '',
      sessionCode: session?.code ?? '',
      allowAccumulate: session?.allow ?? false,
      accumulateDays: session?.days ?? 60,
      counterpart: names.get(counterpartOf(order)) ?? '',
      counterpartBadge: badges.get(counterpartOf(order)) ?? null,
      items: items.get(order.id) ?? [],
      proofs: proofs.get(order.id) ?? [],
      dispute: disputes.get(order.id) ?? null,
    };
  });

  const deliveryViews = deliveries.map<DeliveryView>((delivery) => ({
    delivery,
    counterpart: names.get(counterpartOf(delivery)) ?? '',
    counterpartBadge: badges.get(counterpartOf(delivery)) ?? null,
    orders: orderViews.filter((o) => o.order.delivery_id === delivery.id),
    proofs: proofs.get(delivery.id) ?? [],
  }));

  return { orders: orderViews, deliveries: deliveryViews };
}

async function fetchRows(supabase: Client, column: 'buyer_id' | 'seller_id', userId: string) {
  const [orders, deliveries] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq(column, userId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from('deliveries')
      .select('*')
      .eq(column, userId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
  ]);
  if (orders.error) throw fail('las cuentas', orders.error);
  if (deliveries.error) throw fail('las entregas', deliveries.error);
  return { orders: orders.data, deliveries: deliveries.data };
}

export const orderQueries = {
  /** Cuentas y entregas del comprador (RLS: solo las suyas). */
  async forBuyer(supabase: Client, buyerId: string): Promise<BuyerOrders> {
    const rows = await fetchRows(supabase, 'buyer_id', buyerId);
    return hydrate(supabase, 'buyer', rows.orders, rows.deliveries);
  },

  /** Una cuenta del comprador con su entrega (si tiene) o null. */
  async buyerOrder(
    supabase: Client,
    buyerId: string,
    orderId: string,
  ): Promise<{ view: OrderView; delivery: DeliveryView | null } | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('buyer_id', buyerId)
      .maybeSingle();
    if (error) throw fail('la cuenta', error);
    if (!data) return null;
    let delivery: DeliveryRow[] = [];
    if (data.delivery_id) {
      const res = await supabase.from('deliveries').select('*').eq('id', data.delivery_id);
      if (res.error) throw fail('la entrega', res.error);
      delivery = res.data;
    }
    const hydrated = await hydrate(supabase, 'buyer', [data], delivery);
    return { view: hydrated.orders[0]!, delivery: hydrated.deliveries[0] ?? null };
  },

  /** Bandejas del vendedor: sus cuentas y entregas (RLS) con comprobantes por revisar firmados. */
  async forSeller(supabase: Client, sellerId: string): Promise<SellerInbox> {
    const rows = await fetchRows(supabase, 'seller_id', sellerId);
    const hydrated = await hydrate(supabase, 'seller', rows.orders, rows.deliveries);
    // Las entregas muestran sus cuentas aunque ya estén fuera de la ventana de carga de cuentas.
    return hydrated;
  },

  /** Instrucciones de pago del vendedor (propias) para editar. */
  async paymentInstructions(supabase: Client, sellerId: string): Promise<string> {
    const { data, error } = await supabase
      .from('seller_profiles')
      .select('payment_instructions')
      .eq('user_id', sellerId)
      .maybeSingle();
    if (error) throw fail('tus datos de pago', error);
    return data?.payment_instructions ?? '';
  },

  /** Instrucciones de pago del vendedor para una cuenta cerrada del comprador (RPC; nunca por select público). */
  async instructionsFor(supabase: Client, orderId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_payment_instructions', { p_order_id: orderId });
    if (error) throw fail('las instrucciones de pago', error);
    const result = data as { ok?: boolean; instructions?: string | null } | null;
    return result?.ok ? (result.instructions ?? null) : null;
  },
};
