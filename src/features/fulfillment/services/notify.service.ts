import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailService } from '@/services/email.service';
import type { Json } from '@/types/database.types';
import { AppError } from '@/utils/errors';
import type { ReleaseReason } from '../types';

// Correos de cumplimiento (docs/spec/email.md). Un correo por acción relevante. Un fallo de correo nunca
// rompe la acción del usuario (la RPC ya ocurrió): se registra el código, sin datos personales.
const admin = () => createAdminClient();

type Person = { email: string; name: string };

async function person(userId: string): Promise<Person | null> {
  const db = admin();
  const [{ data: auth }, { data: profile }, { data: shop }] = await Promise.all([
    db.auth.admin.getUserById(userId),
    db.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    db.from('seller_profiles').select('shop_name').eq('user_id', userId).maybeSingle(),
  ]);
  const email = auth.user?.email;
  if (!email) return null;
  return { email, name: shop?.shop_name ?? profile?.display_name ?? '' };
}

const buyerName = async (userId: string) => {
  const { data } = await admin()
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  return data?.display_name ?? '';
};

const sessionTitle = async (sessionId: string) => {
  const { data } = await admin()
    .from('claim_sessions')
    .select('title')
    .eq('id', sessionId)
    .maybeSingle();
  return data?.title ?? '';
};

async function safely(_label: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    console.error('[notify] send_failed', error instanceof AppError ? error.code : 'unknown');
  }
}

async function loadOrder(orderId: string) {
  const { data } = await admin().from('orders').select('*').eq('id', orderId).maybeSingle();
  return data;
}

async function loadDelivery(deliveryId: string) {
  const { data } = await admin().from('deliveries').select('*').eq('id', deliveryId).maybeSingle();
  return data;
}

const orderCount = async (deliveryId: string) => {
  const { count } = await admin()
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('delivery_id', deliveryId);
  return count ?? 1;
};

export const notifyService = {
  /** El vendedor cerró la cuenta: aviso al comprador con el total y el plazo. */
  orderReady: (orderId: string) =>
    safely('orderReady', async () => {
      const order = await loadOrder(orderId);
      if (!order?.pay_due_at) return;
      const [to, shop, title] = await Promise.all([
        person(order.buyer_id),
        person(order.seller_id),
        sessionTitle(order.session_id),
      ]);
      if (!to || !shop) return;
      await emailService.send({
        to: to.email,
        template: 'orderReady',
        data: {
          displayName: to.name,
          shopName: shop.name,
          reference: title,
          totalCents: order.total_cents ?? order.items_total_cents + order.shipping_cents,
          payDueAt: order.pay_due_at,
        },
      });
    }),

  /** El comprador subió un comprobante: aviso al vendedor. */
  proofSubmitted: (target: 'order' | 'delivery', targetId: string) =>
    safely('proofSubmitted', async () => {
      const order = target === 'order' ? await loadOrder(targetId) : null;
      const delivery = target === 'delivery' ? await loadDelivery(targetId) : null;
      const row = order ?? delivery;
      if (!row) return;
      const [seller, buyer] = await Promise.all([person(row.seller_id), buyerName(row.buyer_id)]);
      if (!seller) return;
      const reference = order ? await sessionTitle(order.session_id) : 'Costo de envío';
      await emailService.send({
        to: seller.email,
        template: 'paymentReview',
        data: { displayName: seller.name, buyerName: buyer, reference },
      });
    }),

  /** El vendedor revisó un comprobante: aviso al comprador. */
  proofReviewed: (proofId: string, accepted: boolean) =>
    safely('proofReviewed', async () => {
      const { data: proof } = await admin()
        .from('payment_proofs')
        .select('order_id, delivery_id, reject_reason')
        .eq('id', proofId)
        .maybeSingle();
      if (!proof) return;
      const order = proof.order_id ? await loadOrder(proof.order_id) : null;
      const delivery = proof.delivery_id ? await loadDelivery(proof.delivery_id) : null;
      const row = order ?? delivery;
      if (!row) return;
      const [buyer, shop] = await Promise.all([person(row.buyer_id), person(row.seller_id)]);
      if (!buyer || !shop) return;
      const reference = order ? await sessionTitle(order.session_id) : 'Costo de envío';
      if (accepted) {
        await emailService.send({
          to: buyer.email,
          template: 'paymentConfirmed',
          data: { displayName: buyer.name, shopName: shop.name, reference },
        });
        return;
      }
      const payDueAt = order?.pay_due_at ?? delivery?.pay_due_at;
      if (!payDueAt) return;
      await emailService.send({
        to: buyer.email,
        template: 'paymentRejected',
        data: {
          displayName: buyer.name,
          shopName: shop.name,
          reference,
          reason: proof.reject_reason ?? '',
          payDueAt,
        },
      });
    }),

  /** El comprador solicitó una entrega: aviso al vendedor. */
  deliveryRequested: (deliveryId: string) =>
    safely('deliveryRequested', async () => {
      const delivery = await loadDelivery(deliveryId);
      if (!delivery) return;
      const [seller, buyer, count] = await Promise.all([
        person(delivery.seller_id),
        buyerName(delivery.buyer_id),
        orderCount(deliveryId),
      ]);
      if (!seller) return;
      await emailService.send({
        to: seller.email,
        template: 'deliveryRequested',
        data: {
          displayName: seller.name,
          buyerName: buyer,
          method: delivery.method,
          orderCount: count,
        },
      });
    }),

  /** El vendedor cotizó el envío: aviso al comprador (solo si hay cargo por pagar). */
  deliveryQuoted: (deliveryId: string) =>
    safely('deliveryQuoted', async () => {
      const delivery = await loadDelivery(deliveryId);
      if (!delivery?.pay_due_at || delivery.shipping_cents <= 0) return;
      const [buyer, shop] = await Promise.all([
        person(delivery.buyer_id),
        person(delivery.seller_id),
      ]);
      if (!buyer || !shop) return;
      await emailService.send({
        to: buyer.email,
        template: 'deliveryQuoted',
        data: {
          displayName: buyer.name,
          shopName: shop.name,
          shippingCents: delivery.shipping_cents,
          payDueAt: delivery.pay_due_at,
        },
      });
    }),

  /** El vendedor marcó la entrega como enviada o entregada en mano. */
  deliveryShipped: (deliveryId: string) =>
    safely('deliveryShipped', async () => {
      const delivery = await loadDelivery(deliveryId);
      if (!delivery) return;
      const [buyer, shop] = await Promise.all([
        person(delivery.buyer_id),
        person(delivery.seller_id),
      ]);
      if (!buyer || !shop) return;
      await emailService.send({
        to: buyer.email,
        template: 'deliveryShipped',
        data: {
          displayName: buyer.name,
          shopName: shop.name,
          method: delivery.method,
          ...(delivery.tracking_code ? { trackingCode: delivery.tracking_code } : {}),
        },
      });
    }),

  /**
   * Envía los correos pendientes de `notification_queue` (los que decide la base de datos por plazos).
   * Cada fila se marca enviada al terminar; un fallo suma un intento y se reintenta en la siguiente corrida.
   */
  async drainQueue(limit = 50): Promise<{ sent: number; failed: number }> {
    const db = admin();
    const { data: rows } = await db
      .from('notification_queue')
      .select('id, template, user_id, payload, attempts')
      .is('sent_at', null)
      .lt('attempts', 5)
      .order('created_at')
      .limit(limit);

    let sent = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      try {
        await sendQueued(row.template, row.user_id, row.payload);
        await db
          .from('notification_queue')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', row.id);
        sent += 1;
      } catch (error) {
        failed += 1;
        await db
          .from('notification_queue')
          .update({
            attempts: row.attempts + 1,
            last_error: error instanceof Error ? error.name : 'error',
          })
          .eq('id', row.id);
      }
    }
    return { sent, failed };
  },
};

async function sendReleased(
  buyerId: string,
  sellerId: string,
  reason: ReleaseReason,
  only?: 'buyer' | 'seller',
) {
  const [buyer, seller] = await Promise.all([person(buyerId), person(sellerId)]);
  if (!buyer || !seller) return;
  if (only !== 'seller')
    await emailService.send({
      to: buyer.email,
      template: 'accumulateReleased',
      data: { displayName: buyer.name, role: 'buyer', counterpartName: seller.name, reason },
    });
  if (only !== 'buyer')
    await emailService.send({
      to: seller.email,
      template: 'accumulateReleased',
      data: { displayName: seller.name, role: 'seller', counterpartName: buyer.name, reason },
    });
}

type Payload = Record<string, unknown>;
const asPayload = (value: Json): Payload =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Payload) : {};
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];

/** Arma y envía un correo de la cola. Lanza si falta información o el envío falla (se reintenta). */
async function sendQueued(template: string, userId: string, rawPayload: Json) {
  const payload = asPayload(rawPayload);
  const recipient = await person(userId);
  if (!recipient) return; // usuario eliminado: nada que enviar

  switch (template) {
    case 'unpaidNotice': {
      const order = await loadOrder(str(payload.order_id));
      if (!order) return;
      const role = payload.role === 'seller' ? 'seller' : 'buyer';
      const [other, title] = await Promise.all([
        role === 'buyer'
          ? person(order.seller_id)
          : buyerName(order.buyer_id).then((name) => ({ name })),
        sessionTitle(order.session_id),
      ]);
      await emailService.send({
        to: recipient.email,
        template: 'unpaidNotice',
        data: {
          displayName: recipient.name,
          role,
          counterpartName: other?.name ?? '',
          reference: title,
        },
      });
      return;
    }
    case 'paymentReminder': {
      const order = await loadOrder(str(payload.order_id));
      if (!order?.pay_due_at || order.status !== 'awaiting_payment') return;
      const [shop, title] = await Promise.all([
        person(order.seller_id),
        sessionTitle(order.session_id),
      ]);
      await emailService.send({
        to: recipient.email,
        template: 'paymentReminder',
        data: {
          displayName: recipient.name,
          shopName: shop?.name ?? '',
          reference: title,
          totalCents: order.total_cents ?? order.items_total_cents + order.shipping_cents,
          payDueAt: order.pay_due_at,
        },
      });
      return;
    }
    case 'deliveryReminder': {
      const delivery = await loadDelivery(str(payload.delivery_id));
      if (!delivery?.ship_due_at || delivery.status !== 'preparing') return;
      await emailService.send({
        to: recipient.email,
        template: 'deliveryReminder',
        data: {
          displayName: recipient.name,
          buyerName: await buyerName(delivery.buyer_id),
          shipDueAt: delivery.ship_due_at,
        },
      });
      return;
    }
    case 'accumulateReminder':
    case 'accumulateNotice': {
      const shop = await person(str(payload.seller_id));
      const count = strings(payload.order_ids).length || 1;
      if (template === 'accumulateReminder') {
        await emailService.send({
          to: recipient.email,
          template,
          data: {
            displayName: recipient.name,
            shopName: shop?.name ?? '',
            orderCount: count,
            untilAt: str(payload.accumulate_until),
          },
        });
      } else {
        await emailService.send({
          to: recipient.email,
          template,
          data: {
            displayName: recipient.name,
            shopName: shop?.name ?? '',
            orderCount: count,
            graceUntilAt: str(payload.grace_until),
          },
        });
      }
      return;
    }
    case 'accumulateReleased': {
      const order = await loadOrder(str(payload.order_id));
      if (!order) return;
      const reason = ['grace_expired', 'fee_unpaid', 'buyer_request'].includes(str(payload.reason))
        ? (str(payload.reason) as ReleaseReason)
        : 'grace_expired';
      await sendReleased(
        order.buyer_id,
        order.seller_id,
        reason,
        payload.role === 'seller' ? 'seller' : 'buyer',
      );
      return;
    }
    case 'ratingReminder': {
      const order = await loadOrder(str(payload.order_id));
      if (!order?.completed_at) return;
      const buyer = order.buyer_id === userId;
      const [other, title] = await Promise.all([
        buyer ? person(order.seller_id) : buyerName(order.buyer_id).then((name) => ({ name })),
        sessionTitle(order.session_id),
      ]);
      await emailService.send({
        to: recipient.email,
        template: 'ratingReminder',
        data: {
          displayName: recipient.name,
          role: buyer ? 'buyer' : 'seller',
          counterpartName: other?.name ?? '',
          reference: title,
          rateUntil: new Date(Date.parse(order.completed_at) + 14 * 24 * 3_600_000).toISOString(),
        },
      });
      return;
    }
    default:
      return;
  }
}
