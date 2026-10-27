'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { FormField } from '@/components/molecules/FormField';
import { useToast } from '@/context/ToastContext';
import { parsePesosToCents } from '@/utils/money';
import { fulfillmentContent } from '../../content/es-MX';
import { useRunAction } from '../../hooks/useRunAction';
import {
  closeOrderAction,
  markShippedAction,
  quoteDeliveryAction,
  reviewProofAction,
} from '../../services/fulfillment.actions';
import type { DeliveryMethod, ProofView } from '../../types';
import styles from './SellerActions.module.css';

const c = fulfillmentContent.seller;

/** Pesos escritos por el vendedor → centavos; vacío cuenta como 0. null si no es un monto válido. */
const toCents = (value: string): number | null =>
  value.trim() === '' ? 0 : parsePesosToCents(value);

/** Cierre de cuenta: método de entrega y costo de envío (en persona fuerza 0). */
export function CloseOrderForm({ orderId }: { orderId: string }) {
  const toast = useToast();
  const { pending, run } = useRunAction();
  const [method, setMethod] = useState<DeliveryMethod>('shipping');
  const [cost, setCost] = useState('');

  const submit = () => {
    const cents = method === 'pickup' ? 0 : toCents(cost);
    if (cents === null) {
      toast.show(c.close.invalidCost, 'danger');
      return;
    }
    run(() => closeOrderAction({ orderId, method, shippingCents: cents }), c.close.done);
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Heading level={4} size="sm">
        {c.close.title}
      </Heading>
      <Text size="sm" tone="muted">
        {c.close.hint}
      </Text>
      <FormField label={c.close.method}>
        {(control) => (
          <Select
            {...control}
            value={method}
            onChange={(e) => setMethod(e.target.value as DeliveryMethod)}
          >
            <option value="shipping">{fulfillmentContent.method.shipping}</option>
            <option value="pickup">{fulfillmentContent.method.pickup}</option>
          </Select>
        )}
      </FormField>
      {method === 'shipping' ? (
        <FormField label={c.close.shippingCost} hint={c.close.shippingHint}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              placeholder="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          )}
        </FormField>
      ) : null}
      <Button type="submit" loading={pending}>
        {c.close.submit}
      </Button>
    </form>
  );
}

/** Revisión de un comprobante: abrir, confirmar o rechazar con motivo. */
export function ProofReview({ proof, index }: { proof: ProofView; index: number }) {
  const { pending, run } = useRunAction();
  const reasonId = useId();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <div className={styles.proof}>
      <div className={styles.proofHead}>
        <Text>{c.review.fileLabel(index + 1)}</Text>
        {proof.url ? (
          <a className={styles.link} href={proof.url} target="_blank" rel="noreferrer noopener">
            {proof.isPdf ? c.review.pdf : c.review.open}
          </a>
        ) : null}
      </div>
      {rejecting ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => reviewProofAction({ proofId: proof.id, accept: false, reason }),
              c.review.rejected,
              () => setRejecting(false),
            );
          }}
        >
          <label htmlFor={reasonId} className={styles.label}>
            {c.review.reason}
          </label>
          <Textarea
            id={reasonId}
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <Text size="sm" tone="muted">
            {c.review.reasonHint}
          </Text>
          <div className={styles.row}>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {fulfillmentContent.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="secondary"
              loading={pending}
              disabled={reason.trim() === ''}
            >
              {c.review.rejectSubmit}
            </Button>
          </div>
        </form>
      ) : (
        <div className={styles.row}>
          <Button
            loading={pending}
            onClick={() =>
              run(() => reviewProofAction({ proofId: proof.id, accept: true }), c.review.accepted)
            }
          >
            {c.review.accept}
          </Button>
          <Button variant="secondary" onClick={() => setRejecting(true)}>
            {c.review.reject}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Cotización del envío de una entrega acumulada. */
export function QuoteForm({ deliveryId }: { deliveryId: string }) {
  const toast = useToast();
  const { pending, run } = useRunAction();
  const [cost, setCost] = useState('');
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        const cents = toCents(cost);
        if (cents === null) {
          toast.show(c.close.invalidCost, 'danger');
          return;
        }
        run(() => quoteDeliveryAction({ deliveryId, shippingCents: cents }), c.delivery.quote.done);
      }}
    >
      <Heading level={4} size="sm">
        {c.delivery.quote.title}
      </Heading>
      <FormField label={c.delivery.quote.cost} hint={c.delivery.quote.hint}>
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            placeholder="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        )}
      </FormField>
      <Button type="submit" loading={pending}>
        {c.delivery.quote.submit}
      </Button>
    </form>
  );
}

/** Marcar enviado (o entregado en mano) con guía opcional. */
export function ShipForm({ deliveryId, pickup }: { deliveryId: string; pickup: boolean }) {
  const { pending, run } = useRunAction();
  const [tracking, setTracking] = useState('');
  const s = c.delivery.ship;
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            markShippedAction({
              deliveryId,
              ...(tracking.trim() ? { trackingCode: tracking.trim() } : {}),
            }),
          s.done,
        );
      }}
    >
      <Heading level={4} size="sm">
        {pickup ? s.titlePickup : s.title}
      </Heading>
      {pickup ? null : (
        <FormField label={s.tracking}>
          {(control) => (
            <Input
              {...control}
              maxLength={80}
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          )}
        </FormField>
      )}
      <Button type="submit" loading={pending}>
        {pickup ? s.submitPickup : s.submit}
      </Button>
    </form>
  );
}
