'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { fulfillmentContent } from '../../content/es-MX';
import { useRunAction } from '../../hooks/useRunAction';
import { savePaymentInstructionsAction } from '../../services/fulfillment.actions';
import styles from './PaymentInstructionsView.module.css';

const c = fulfillmentContent.settings;
const MAX = 500;

/** Edición de las instrucciones de pago con vista previa tal como las verá el comprador. */
export function PaymentInstructionsForm({ initial }: { initial: string }) {
  const { pending, run } = useRunAction();
  const id = useId();
  const [text, setText] = useState(initial);
  const trimmed = text.trim();

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        run(() => savePaymentInstructionsAction({ text }), c.saved);
      }}
    >
      <label htmlFor={id} className={styles.label}>
        {c.label}
      </label>
      <Textarea
        id={id}
        rows={6}
        maxLength={MAX}
        placeholder={c.placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <div className={styles.meta}>
        <Text id={`${id}-hint`} size="sm" tone="muted">
          {c.hint}
        </Text>
        <Text size="sm" tone="muted">
          {c.count(text.length)}
        </Text>
      </div>

      <section aria-label={c.preview} className={styles.preview}>
        <Heading level={3} size="sm">
          {c.preview}
        </Heading>
        {trimmed ? (
          <pre className={styles.pre}>{trimmed}</pre>
        ) : (
          <Text tone="muted">{c.previewEmpty}</Text>
        )}
      </section>

      <Button type="submit" loading={pending} disabled={trimmed === initial.trim()}>
        {c.save()}
      </Button>
    </form>
  );
}
