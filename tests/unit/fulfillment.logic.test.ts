import { describe, expect, it } from 'vitest';
import type { DeliveryRow, DeliveryView, OrderRow, OrderView } from '@/features/fulfillment/types';
import { addressSchema, toAddressSnapshot } from '@/features/fulfillment/utils/address.schemas';
import { buyerSection, objectionWindowOpen } from '@/features/fulfillment/utils/orderTiming';
import { checkProofFile, proofExtension, scaleToFit } from '@/features/fulfillment/utils/proofFile';
import {
  bucketSize,
  parseSellerTab,
  sellerBuckets,
} from '@/features/fulfillment/utils/sellerBuckets';

const order = (patch: Partial<OrderRow>): OrderView => ({
  order: {
    id: 'o',
    status: 'pending_close',
    accumulate: false,
    delivery_id: null,
    ...patch,
  } as OrderRow,
  sessionTitle: '',
  sessionCode: '',
  allowAccumulate: false,
  accumulateDays: 60,
  counterpart: '',
  counterpartBadge: null,
  items: [],
  proofs: [],
  dispute: null,
});

const delivery = (patch: Partial<DeliveryRow>): DeliveryView => ({
  delivery: { id: 'd', status: 'requested', method: 'shipping', ...patch } as DeliveryRow,
  counterpart: '',
  counterpartBadge: null,
  orders: [],
  proofs: [],
});

describe('buyerSection', () => {
  it.each([
    [{ status: 'pending_close' }, 'toPay'],
    [{ status: 'awaiting_payment' }, 'toPay'],
    [{ status: 'payment_review' }, 'toPay'],
    [{ status: 'paid', accumulate: true, delivery_id: null }, 'accumulate'],
    [{ status: 'paid', accumulate: true, delivery_id: 'd' }, 'delivery'],
    [{ status: 'paid', accumulate: false, delivery_id: 'd' }, 'delivery'],
    [{ status: 'unpaid' }, 'history'],
    [{ status: 'released' }, 'history'],
    [{ status: 'cancelled' }, 'history'],
  ] as const)('%o → %s', (patch, expected) => {
    expect(buyerSection({ ...order({}).order, ...patch } as OrderRow)).toBe(expected);
  });
});

describe('objectionWindowOpen', () => {
  const now = new Date('2026-11-10T00:00:00Z').getTime();
  it('abierta 7 días desde unpaid_at', () => {
    expect(objectionWindowOpen('2026-11-04T00:00:00Z', now)).toBe(true);
    expect(objectionWindowOpen('2026-11-02T23:59:00Z', now)).toBe(false);
    expect(objectionWindowOpen(null, now)).toBe(false);
  });
});

describe('sellerBuckets', () => {
  it('reparte cuentas y entregas en una sola bandeja', () => {
    const buckets = sellerBuckets({
      orders: [
        order({ id: '1', status: 'pending_close' }),
        order({ id: '2', status: 'awaiting_payment' }),
        order({ id: '3', status: 'payment_review' }),
        order({ id: '4', status: 'unpaid' }),
        order({ id: '5', status: 'released' }),
        order({ id: '6', status: 'paid' }),
      ],
      deliveries: [
        delivery({ status: 'requested', method: 'shipping' }),
        delivery({ status: 'requested', method: 'pickup' }),
        delivery({ status: 'awaiting_payment' }),
        delivery({ status: 'payment_review' }),
        delivery({ status: 'preparing' }),
        delivery({ status: 'shipped' }),
        delivery({ status: 'delivered' }),
      ],
    });
    expect(bucketSize(buckets.toClose)).toBe(1);
    expect(bucketSize(buckets.awaitingPayment)).toBe(2);
    expect(bucketSize(buckets.toReview)).toBe(2);
    expect(bucketSize(buckets.toQuote)).toBe(1);
    expect(bucketSize(buckets.toShip)).toBe(1);
    expect(bucketSize(buckets.shipped)).toBe(1);
    expect(bucketSize(buckets.unpaid)).toBe(1);
    expect(bucketSize(buckets.released)).toBe(1);
  });

  it('parseSellerTab cae en toClose con valores desconocidos', () => {
    expect(parseSellerTab('toShip')).toBe('toShip');
    expect(parseSellerTab('x')).toBe('toClose');
    expect(parseSellerTab(undefined)).toBe('toClose');
  });
});

describe('proofFile', () => {
  it('acepta imágenes y PDF; rechaza otros tipos y PDFs de más de 5 MB', () => {
    expect(checkProofFile({ type: 'image/png', size: 4_000_000 })).toBe('ok');
    expect(checkProofFile({ type: 'application/pdf', size: 1000 })).toBe('ok');
    expect(checkProofFile({ type: 'text/plain', size: 10 })).toBe('file_type');
    expect(checkProofFile({ type: 'application/pdf', size: 6 * 1024 * 1024 })).toBe(
      'file_too_large',
    );
    expect(checkProofFile({ type: 'image/jpeg', size: 40 * 1024 * 1024 })).toBe('file_too_large');
  });

  it('extensión y escalado', () => {
    expect(proofExtension('application/pdf')).toBe('pdf');
    expect(proofExtension('image/jpeg')).toBe('jpg');
    expect(scaleToFit(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(scaleToFit(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('addressSchema', () => {
  const valid = {
    recipient: ' Luis ',
    phone: '55 1234 5678',
    street: 'Calle',
    exterior: '1',
    interior: '',
    neighborhood: 'Centro',
    city: 'CDMX',
    state: 'CDMX',
    postal_code: '06000',
    references: '',
  };

  it('acepta una dirección completa y limpia los opcionales vacíos', () => {
    const parsed = addressSchema.parse(valid);
    const snapshot = toAddressSnapshot(parsed);
    expect(snapshot.recipient).toBe('Luis');
    expect('interior' in snapshot).toBe(false);
    expect('references' in snapshot).toBe(false);
  });

  it('rechaza faltantes, teléfono y código postal inválidos', () => {
    expect(addressSchema.safeParse({ ...valid, street: '' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...valid, phone: 'abc' }).success).toBe(false);
    expect(addressSchema.safeParse({ ...valid, postal_code: '123' }).success).toBe(false);
  });
});
