'use client';

import clsx from 'clsx';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { formatMXN } from '@/utils/money';
import { fulfillmentContent } from '../../content/es-MX';
import { useRunAction } from '../../hooks/useRunAction';
import { setAccumulateAction } from '../../services/fulfillment.actions';
import styles from './AccumulateChoice.module.css';

const c = fulfillmentContent.buyer.choice;

type Props = {
  orderId: string;
  accumulate: boolean;
  itemsTotalCents: number;
  closeShippingCents: number;
  accumulateDays: number;
};

/** Elección tras el cierre: envío al momento o guardadito. Muestra el total de cada opción. */
export function AccumulateChoice({
  orderId,
  accumulate,
  itemsTotalCents,
  closeShippingCents,
  accumulateDays,
}: Props) {
  const { pending, run } = useRunAction();
  const options = [
    {
      value: false,
      label: c.now,
      text: c.nowText(formatMXN(itemsTotalCents + closeShippingCents)),
    },
    {
      value: true,
      label: c.accumulate,
      text: `${c.accumulateText(formatMXN(itemsTotalCents))} ${c.accumulateDays(accumulateDays)}`,
    },
  ];

  return (
    <fieldset className={styles.root} disabled={pending}>
      <legend>
        <Heading level={3} size="md">
          {c.title}
        </Heading>
      </legend>
      <Text size="sm" tone="muted">
        {c.hint}
      </Text>
      <div className={styles.options} role="radiogroup" aria-label={c.title}>
        {options.map((option) => (
          <label
            key={String(option.value)}
            className={clsx(styles.option, accumulate === option.value && styles.selected)}
          >
            <input
              type="radio"
              name={`accumulate-${orderId}`}
              checked={accumulate === option.value}
              onChange={() =>
                run(() => setAccumulateAction({ orderId, value: option.value }), c.saved)
              }
            />
            <span className={styles.body}>
              <span className={styles.name}>{option.label}</span>
              <span className={styles.text}>{option.text}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
