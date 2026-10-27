'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { Dialog } from '@/components/molecules/Dialog';
import { fulfillmentContent } from '../../content/es-MX';
import { useRunAction } from '../../hooks/useRunAction';
import {
  confirmDeliveryAction,
  objectUnpaidAction,
  releaseOrderAction,
} from '../../services/fulfillment.actions';
import styles from './BuyerActions.module.css';

const c = fulfillmentContent.buyer;

/** "Ya lo recibí": el comprador confirma la entrega. */
export function ConfirmReceiptButton({ deliveryId }: { deliveryId: string }) {
  const { pending, run } = useRunAction();
  return (
    <div className={styles.stack}>
      <Text size="sm" tone="muted">
        {c.detail.confirmReceiptHint}
      </Text>
      <Button
        loading={pending}
        onClick={() => run(() => confirmDeliveryAction({ deliveryId }), c.detail.received)}
      >
        {c.detail.confirmReceipt}
      </Button>
    </div>
  );
}

/** Liberar un guardadito: confirmación explícita porque las piezas vuelven al vendedor. */
export function ReleaseOrderButton({ orderId }: { orderId: string }) {
  const { pending, run } = useRunAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {c.release.button}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={c.release.title}>
        <div className={styles.stack}>
          <Text>{c.release.text}</Text>
          <div className={styles.row}>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {fulfillmentContent.common.cancel}
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                run(
                  () => releaseOrderAction({ orderId }),
                  c.release.done,
                  () => setOpen(false),
                )
              }
            >
              {c.release.confirm}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/** Objeción a una marca de "no pagó" (visible públicamente junto a la marca). */
export function ObjectionForm({ orderId }: { orderId: string }) {
  const { pending, run } = useRunAction();
  const id = useId();
  const [note, setNote] = useState('');
  return (
    <form
      className={styles.stack}
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () => objectUnpaidAction({ orderId, note }),
          c.objection.sent,
          () => setNote(''),
        );
      }}
    >
      <Heading level={3} size="md">
        {c.objection.title}
      </Heading>
      <label htmlFor={id} className={styles.label}>
        {c.objection.label}
      </label>
      <Textarea
        id={id}
        rows={3}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        required
      />
      <Text size="sm" tone="muted">
        {c.objection.hint}
      </Text>
      <Button type="submit" loading={pending} disabled={note.trim().length === 0}>
        {c.objection.submit}
      </Button>
    </form>
  );
}
