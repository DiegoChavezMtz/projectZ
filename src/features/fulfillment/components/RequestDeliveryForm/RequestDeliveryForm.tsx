'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Select } from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { FormField } from '@/components/molecules/FormField';
import { useToast } from '@/context/ToastContext';
import { formatDate } from '@/utils/dates';
import { formatMXN } from '@/utils/money';
import { fulfillmentContent } from '../../content/es-MX';
import { useRunAction } from '../../hooks/useRunAction';
import { requestDeliveryAction } from '../../services/fulfillment.actions';
import { addressSchema, type AddressInput } from '../../utils/address.schemas';
import { AddressFields, EMPTY_ADDRESS } from '../AddressFields';
import styles from './RequestDeliveryForm.module.css';

const c = fulfillmentContent.buyer.request;

export type AccumulableOrder = {
  id: string;
  sessionTitle: string;
  itemsTotalCents: number;
  accumulateUntil: string | null;
  /** Fecha límite para confirmar si el guardadito ya venció. */
  graceUntil: string | null;
};

/** Solicitud de entrega de una o varias cuentas pagadas del mismo vendedor (guardadito). */
export function RequestDeliveryForm({ orders }: { orders: AccumulableOrder[] }) {
  const toast = useToast();
  const { pending, run } = useRunAction();
  const [selected, setSelected] = useState<string[]>(orders.length === 1 ? [orders[0]!.id] : []);
  const [method, setMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [address, setAddress] = useState<AddressInput>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [note, setNote] = useState('');

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const submit = () => {
    if (selected.length === 0) {
      toast.show(c.none, 'info');
      return;
    }
    let parsed: unknown;
    if (method === 'shipping') {
      const checked = addressSchema.safeParse(address);
      if (!checked.success) {
        const next: Partial<Record<string, string>> = {};
        for (const issue of checked.error.issues) next[String(issue.path[0])] ??= issue.message;
        setErrors(next);
        return;
      }
      setErrors({});
      parsed = checked.data;
    }
    run(
      () =>
        requestDeliveryAction({
          orderIds: selected,
          method,
          ...(parsed ? { address: parsed } : {}),
          ...(method === 'pickup' && note.trim() ? { pickupNote: note.trim() } : {}),
        }),
      method === 'pickup' ? c.pickupSent : c.sent,
    );
  };

  return (
    <form
      className={styles.root}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset className={styles.orders}>
        <legend className={styles.legend}>{c.select}</legend>
        {orders.map((order) => (
          <label key={order.id} className={styles.order}>
            <input
              type="checkbox"
              checked={selected.includes(order.id)}
              onChange={() => toggle(order.id)}
            />
            <span className={styles.orderBody}>
              <span className={styles.orderTitle}>
                {order.sessionTitle} · {formatMXN(order.itemsTotalCents)}
              </span>
              <Text size="sm" tone="muted">
                {order.graceUntil
                  ? c.expired(formatDate(order.graceUntil))
                  : order.accumulateUntil
                    ? c.until(formatDate(order.accumulateUntil))
                    : ''}
              </Text>
            </span>
          </label>
        ))}
      </fieldset>

      <FormField label={c.method}>
        {(control) => (
          <Select
            {...control}
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            <option value="shipping">{fulfillmentContent.method.shipping}</option>
            <option value="pickup">{fulfillmentContent.method.pickup}</option>
          </Select>
        )}
      </FormField>

      {method === 'shipping' ? (
        <AddressFields value={address} onChange={setAddress} errors={errors} />
      ) : (
        <FormField label={c.pickupNote}>
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
      )}

      <Button type="submit" loading={pending}>
        {orders.some((o) => o.graceUntil) ? c.confirm : c.submit}
      </Button>
    </form>
  );
}

export function RequestDeliveryTitle() {
  return (
    <Heading level={3} size="md">
      {c.title}
    </Heading>
  );
}
