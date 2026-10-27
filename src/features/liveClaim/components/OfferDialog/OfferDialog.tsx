'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/FormField';
import { Dialog } from '@/components/molecules/Dialog';
import { Text } from '@/components/atoms/Text';
import type { ClaimItem } from '@/types/claims';
import { formatMXN } from '@/utils/money';
import { liveClaimContent } from '../../content/es-MX';
import { validateOffer } from '../../utils/offer';
import styles from './OfferDialog.module.css';

const c = liveClaimContent.offerDialog;

type Props = {
  item: ClaimItem | null;
  onClose: () => void;
  /** Lanza si el servidor la rechaza; el diálogo se queda abierto. */
  onSubmit: (item: ClaimItem, amountCents: number) => Promise<void>;
};

export function OfferDialog({ item, onClose, onSubmit }: Props) {
  return (
    <Dialog open={item !== null} onClose={onClose} title={item ? c.title(item.title) : ''}>
      {item ? <OfferForm key={item.id} item={item} onClose={onClose} onSubmit={onSubmit} /> : null}
    </Dialog>
  );
}

function OfferForm({ item, onClose, onSubmit }: Required<Props> & { item: ClaimItem }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateOffer(value, item.price_cents);
    if (!result.ok) {
      setError(c.errors[result.reason]);
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await onSubmit(item, result.amountCents);
      onClose();
    } catch {
      setBusy(false); // el mensaje ya salió como aviso; se puede corregir y reintentar
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Text tone="muted">{c.price(formatMXN(item.price_cents))}</Text>
      <FormField label={c.amountLabel} hint={c.hint} error={error}>
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}
      </FormField>
      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onClose}>
          {c.cancel}
        </Button>
        <Button type="submit" loading={busy}>
          {c.submit}
        </Button>
      </div>
    </form>
  );
}
