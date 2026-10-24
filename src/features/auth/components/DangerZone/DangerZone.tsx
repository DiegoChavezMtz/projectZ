'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { Dialog } from '@/components/molecules/Dialog';
import { FormField } from '@/components/molecules/FormField';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { deleteAccountAction } from '../../services/account.actions';
import { deleteAccountSchema } from '../../utils/auth.schemas';
import styles from '../AuthForm.module.css';

const c = authContent.security.danger;

/** A15: eliminar la cuenta escribiendo el handle. */
export function DangerZone({ handle }: { handle: string }) {
  const [open, setOpen] = useState(false);
  const { form, state, pending, onSubmit, errorFor } = useAuthForm<{ handle: string }>(
    deleteAccountSchema,
    deleteAccountAction,
    { handle: '' },
  );
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;

  return (
    <section className={styles.section} aria-labelledby="danger-title">
      <Heading level={2} size="lg" id="danger-title">
        {c.title}
      </Heading>
      <Text tone="muted">{c.description}</Text>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {c.action}
        </Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={c.confirmTitle}>
        <form onSubmit={onSubmit} className={styles.section} noValidate>
          <Text>{c.confirmText(handle)}</Text>
          {formError ? (
            <Text tone="danger" role="alert">
              {authContent.errors[formError] ?? authContent.errors.unknown}
            </Text>
          ) : null}
          <FormField label={c.handle} error={errorFor('handle')}>
            {(control) => (
              <Input
                {...control}
                {...form.register('handle')}
                autoComplete="off"
                autoCapitalize="none"
              />
            )}
          </FormField>
          <div className={styles.actions}>
            <Button type="submit" loading={pending}>
              {c.confirm}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {c.cancel}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
