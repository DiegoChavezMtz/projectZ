'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AppError } from '@/utils/errors';
import { unwrapRpc } from '@/utils/rpc';
import { fulfillmentErrors } from '../content/es-MX';
import type { ActionResult } from '../types';
import { addressSchema, toAddressSnapshot } from '../utils/address.schemas';
import { notifyService } from './notify.service';

// Acciones de cumplimiento. Cada una llama la RPC con la sesión del usuario (Postgres valida propiedad y
// estado), refresca las vistas y avisa por correo. Un fallo devuelve el texto de UI, nunca el detalle interno.

const uuid = z.string().uuid();
const method = z.enum(['shipping', 'pickup']);
const cents = z.number().int().min(0).max(10_000_000);
const note = z.string().trim().max(300).optional();

const fail = (code: string): ActionResult => ({
  ok: false,
  code,
  message: fulfillmentErrors[code] ?? fulfillmentErrors.unknown!,
});

async function currentUserId(next: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return data.user.id;
}

/** Llama una RPC con la sesión del usuario. Devuelve los datos o un ActionResult de error. */
async function call(
  fn: string,
  args: Record<string, unknown>,
  next: string,
): Promise<{ ok: true; data: Record<string, unknown> } | Extract<ActionResult, { ok: false }>> {
  await currentUserId(next);
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc(fn as 'close_order', args as never);
    return { ok: true, data: unwrapRpc<Record<string, unknown>>(data, error, fulfillmentErrors) };
  } catch (error) {
    return fail(error instanceof AppError ? error.code : 'unknown') as Extract<
      ActionResult,
      { ok: false }
    >;
  }
}

const refresh = () => {
  revalidatePath('/orders', 'layout');
  revalidatePath('/dashboard/orders');
};

const invalid = () => fail('validation_failed');

// --- Vendedor --------------------------------------------------------------------------------

export async function closeOrderAction(input: {
  orderId: string;
  method: 'shipping' | 'pickup';
  shippingCents: number;
}): Promise<ActionResult> {
  const parsed = z.object({ orderId: uuid, method, shippingCents: cents }).safeParse(input);
  if (!parsed.success) return invalid();
  const result = await call(
    'close_order',
    {
      p_order_id: parsed.data.orderId,
      p_delivery_method: parsed.data.method,
      p_shipping_cents: parsed.data.shippingCents,
    },
    '/dashboard/orders',
  );
  if (!result.ok) return result;
  await notifyService.orderReady(parsed.data.orderId);
  refresh();
  return { ok: true };
}

export async function reviewProofAction(input: {
  proofId: string;
  accept: boolean;
  reason?: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ proofId: uuid, accept: z.boolean(), reason: z.string().trim().max(200).optional() })
    .safeParse(input);
  if (!parsed.success || (!parsed.data.accept && !parsed.data.reason)) return invalid();
  const result = await call(
    'review_payment_proof',
    {
      p_proof_id: parsed.data.proofId,
      p_accept: parsed.data.accept,
      ...(parsed.data.reason ? { p_reason: parsed.data.reason } : {}),
    },
    '/dashboard/orders',
  );
  if (!result.ok) return result;
  await notifyService.proofReviewed(parsed.data.proofId, parsed.data.accept);
  refresh();
  return { ok: true };
}

export async function quoteDeliveryAction(input: {
  deliveryId: string;
  shippingCents: number;
}): Promise<ActionResult> {
  const parsed = z.object({ deliveryId: uuid, shippingCents: cents }).safeParse(input);
  if (!parsed.success) return invalid();
  const result = await call(
    'quote_delivery',
    { p_delivery_id: parsed.data.deliveryId, p_shipping_cents: parsed.data.shippingCents },
    '/dashboard/orders',
  );
  if (!result.ok) return result;
  await notifyService.deliveryQuoted(parsed.data.deliveryId);
  refresh();
  return { ok: true };
}

export async function markShippedAction(input: {
  deliveryId: string;
  trackingCode?: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ deliveryId: uuid, trackingCode: z.string().trim().max(80).optional() })
    .safeParse(input);
  if (!parsed.success) return invalid();
  const result = await call(
    'mark_shipped',
    {
      p_delivery_id: parsed.data.deliveryId,
      ...(parsed.data.trackingCode ? { p_tracking_code: parsed.data.trackingCode } : {}),
    },
    '/dashboard/orders',
  );
  if (!result.ok) return result;
  await notifyService.deliveryShipped(parsed.data.deliveryId);
  refresh();
  return { ok: true };
}

export async function savePaymentInstructionsAction(input: {
  text: string;
}): Promise<ActionResult> {
  const parsed = z.object({ text: z.string().trim().max(500) }).safeParse(input);
  if (!parsed.success) return invalid();
  const userId = await currentUserId('/dashboard/settings');
  const supabase = await createClient();
  const { error } = await supabase
    .from('seller_profiles')
    .update({ payment_instructions: parsed.data.text === '' ? null : parsed.data.text })
    .eq('user_id', userId);
  if (error) return fail('unknown');
  revalidatePath('/dashboard/settings');
  return { ok: true };
}

// --- Comprador -------------------------------------------------------------------------------

export async function setAccumulateAction(input: {
  orderId: string;
  value: boolean;
}): Promise<ActionResult> {
  const parsed = z.object({ orderId: uuid, value: z.boolean() }).safeParse(input);
  if (!parsed.success) return invalid();
  const result = await call(
    'set_order_accumulate',
    { p_order_id: parsed.data.orderId, p_value: parsed.data.value },
    `/orders/${parsed.data.orderId}`,
  );
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function submitProofAction(input: {
  target: 'order' | 'delivery';
  targetId: string;
  filePath: string;
  address?: unknown;
  pickupNote?: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      target: z.enum(['order', 'delivery']),
      targetId: uuid,
      filePath: z.string().min(3).max(300),
      pickupNote: note,
    })
    .safeParse(input);
  if (!parsed.success) return invalid();

  let address: ReturnType<typeof toAddressSnapshot> | undefined;
  if (input.address !== undefined && input.address !== null) {
    const checked = addressSchema.safeParse(input.address);
    if (!checked.success) return invalid();
    address = toAddressSnapshot(checked.data);
  }

  const result = await call(
    'submit_payment_proof',
    {
      p_target: parsed.data.target,
      p_target_id: parsed.data.targetId,
      p_file_path: parsed.data.filePath,
      ...(address ? { p_address: address } : {}),
      ...(parsed.data.pickupNote ? { p_pickup_note: parsed.data.pickupNote } : {}),
    },
    `/orders`,
  );
  if (!result.ok) return result;
  await notifyService.proofSubmitted(parsed.data.target, parsed.data.targetId);
  refresh();
  return { ok: true };
}

export async function requestDeliveryAction(input: {
  orderIds: string[];
  method: 'shipping' | 'pickup';
  address?: unknown;
  pickupNote?: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ orderIds: z.array(uuid).min(1).max(20), method, pickupNote: note })
    .safeParse(input);
  if (!parsed.success) return invalid();

  let address: ReturnType<typeof toAddressSnapshot> | undefined;
  if (parsed.data.method === 'shipping') {
    const checked = addressSchema.safeParse(input.address);
    if (!checked.success) return invalid();
    address = toAddressSnapshot(checked.data);
  }

  const result = await call(
    'request_delivery',
    {
      p_order_ids: parsed.data.orderIds,
      p_method: parsed.data.method,
      ...(address ? { p_address: address } : {}),
      ...(parsed.data.pickupNote ? { p_pickup_note: parsed.data.pickupNote } : {}),
    },
    '/orders',
  );
  if (!result.ok) return result;
  const deliveryId = result.data.delivery_id;
  if (typeof deliveryId === 'string') await notifyService.deliveryRequested(deliveryId);
  refresh();
  return { ok: true };
}

export async function confirmDeliveryAction(input: { deliveryId: string }): Promise<ActionResult> {
  const parsed = z.object({ deliveryId: uuid }).safeParse(input);
  if (!parsed.success) return invalid();
  const result = await call(
    'confirm_delivery',
    { p_delivery_id: parsed.data.deliveryId },
    '/orders',
  );
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function objectUnpaidAction(input: {
  orderId: string;
  note: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ orderId: uuid, note: z.string().trim().min(1).max(500) })
    .safeParse(input);
  if (!parsed.success) return invalid();
  const result = await call(
    'object_unpaid',
    { p_order_id: parsed.data.orderId, p_note: parsed.data.note },
    `/orders/${parsed.data.orderId}`,
  );
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function releaseOrderAction(input: { orderId: string }): Promise<ActionResult> {
  const parsed = z.object({ orderId: uuid }).safeParse(input);
  if (!parsed.success) return invalid();
  const result = await call(
    'release_accumulated_order',
    { p_order_id: parsed.data.orderId },
    '/orders',
  );
  if (!result.ok) return result;
  // La base ya encoló los avisos de liberación; se envían ahora en lugar de esperar al sondeo.
  await notifyService.drainQueue(20);
  refresh();
  return { ok: true };
}
