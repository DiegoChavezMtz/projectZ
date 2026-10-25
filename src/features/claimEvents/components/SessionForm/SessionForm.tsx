'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Checkbox } from '@/components/atoms/Checkbox';
import { Heading } from '@/components/atoms/Heading';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { Dialog } from '@/components/molecules/Dialog';
import { FormField } from '@/components/molecules/FormField';
import type { ClaimSession } from '@/types/claims';
import { isoToMexicoLocal } from '@/utils/dates';
import { claimEventsContent } from '../../content/es-MX';
import { useClaimForm } from '../../hooks/useClaimForm';
import {
  cancelSessionAction,
  createSessionAction,
  updateSessionAction,
} from '../../services/claimEvents.actions';
import { initialActionState } from '../../types';
import { lockedSessionFormSchema, sessionFormSchema } from '../../utils/session.schemas';
import { areRulesLocked } from '../../utils/session.utils';
import styles from './SessionForm.module.css';

const c = claimEventsContent.form;

type Values = {
  title: string;
  description: string;
  rules: string;
  startsAt: string;
  expectedDurationMinutes: string;
  releaseMode: string;
  autoConfirm: boolean;
  closeDeadlineHours: string;
  paymentDeadlineHours: string;
  shippingDeadlineHours: string;
  allowAccumulate: boolean;
};

const defaultsFor = (session?: ClaimSession): Values => ({
  title: session?.title ?? '',
  description: session?.description ?? '',
  rules: session?.rules ?? '',
  startsAt: session ? isoToMexicoLocal(session.starts_at) : '',
  expectedDurationMinutes: session?.expected_duration_minutes?.toString() ?? '',
  releaseMode: session?.release_mode ?? 'all_at_start',
  autoConfirm: session?.auto_confirm ?? true,
  closeDeadlineHours: String(session?.close_deadline_hours ?? 24),
  paymentDeadlineHours: String(session?.payment_deadline_hours ?? 48),
  shippingDeadlineHours: String(session?.shipping_deadline_hours ?? 120),
  allowAccumulate: session?.allow_accumulate ?? false,
});

type Props = { session?: ClaimSession };

/** S4-09: crear/editar evento. Tras publicar, las reglas y plazos se muestran deshabilitados con su explicación. */
export function SessionForm({ session }: Props) {
  const locked = session ? areRulesLocked(session.status) : false;
  const { form, state, pending, onSubmit, errorFor } = useClaimForm<Values>(
    locked ? lockedSessionFormSchema : sessionFormSchema,
    session ? updateSessionAction : createSessionAction,
    defaultsFor(session),
  );
  const { register } = form;
  const [confirmCancel, setConfirmCancel] = useState(false);

  const formError =
    state.status === 'error' && state.code !== 'validation' ? (state.code ?? 'unknown') : undefined;
  const lockHint = locked ? c.lockedField : undefined;

  return (
    <>
      <form onSubmit={onSubmit} className={styles.form} noValidate>
        {session ? <input type="hidden" name="id" value={session.id} /> : null}
        {formError ? (
          <Text tone="danger" role="alert">
            {claimEventsContent.errors[formError] ?? claimEventsContent.errors.unknown}
          </Text>
        ) : null}

        <fieldset className={styles.group}>
          <legend>
            <Heading level={2} size="lg">
              {c.details}
            </Heading>
          </legend>
          <FormField label={c.title} hint={c.titleHint} error={errorFor('title')}>
            {(control) => (
              <Input {...control} {...register('title')} maxLength={80} autoComplete="off" />
            )}
          </FormField>
          <FormField label={c.description} error={errorFor('description')}>
            {(control) => (
              <Textarea {...control} {...register('description')} rows={3} maxLength={1000} />
            )}
          </FormField>
          <FormField label={c.rules} hint={c.rulesHint} error={errorFor('rules')}>
            {(control) => (
              <Textarea {...control} {...register('rules')} rows={4} maxLength={1000} />
            )}
          </FormField>
          <div className={styles.row}>
            <FormField label={c.startsAt} hint={c.startsAtHint} error={errorFor('startsAt')}>
              {(control) => <Input {...control} {...register('startsAt')} type="datetime-local" />}
            </FormField>
            <FormField label={c.duration} error={errorFor('expectedDurationMinutes')}>
              {(control) => (
                <Input {...control} {...register('expectedDurationMinutes')} inputMode="numeric" />
              )}
            </FormField>
          </div>
        </fieldset>

        <fieldset className={styles.group} disabled={locked}>
          <legend>
            <Heading level={2} size="lg">
              {c.settings}
            </Heading>
          </legend>
          {locked ? (
            <Text size="sm" tone="muted" role="note">
              {c.lockedNotice}
            </Text>
          ) : null}
          <FormField label={c.releaseMode} hint={lockHint} error={errorFor('releaseMode')}>
            {(control) => (
              <Select {...control} {...register('releaseMode')}>
                <option value="all_at_start">{c.releaseAll}</option>
                <option value="manual">{c.releaseManual}</option>
              </Select>
            )}
          </FormField>
          <Checkbox
            label={c.autoConfirm}
            hint={locked ? c.lockedField : c.autoConfirmHint}
            {...register('autoConfirm')}
          />
          <div className={styles.row}>
            <FormField
              label={c.closeDeadline}
              hint={lockHint ?? c.closeDeadlineHint}
              error={errorFor('closeDeadlineHours')}
            >
              {(control) => (
                <Input {...control} {...register('closeDeadlineHours')} inputMode="numeric" />
              )}
            </FormField>
            <FormField
              label={c.paymentDeadline}
              hint={lockHint ?? c.paymentDeadlineHint}
              error={errorFor('paymentDeadlineHours')}
            >
              {(control) => (
                <Input {...control} {...register('paymentDeadlineHours')} inputMode="numeric" />
              )}
            </FormField>
            <FormField
              label={c.shippingDeadline}
              hint={lockHint ?? c.shippingDeadlineHint}
              error={errorFor('shippingDeadlineHours')}
            >
              {(control) => (
                <Input {...control} {...register('shippingDeadlineHours')} inputMode="numeric" />
              )}
            </FormField>
          </div>
          <Checkbox label={c.allowAccumulate} hint={lockHint} {...register('allowAccumulate')} />
        </fieldset>

        <div className={styles.actions}>
          {session && session.status !== 'live' ? (
            <Button type="button" variant="ghost" onClick={() => setConfirmCancel(true)}>
              {c.cancelEvent}
            </Button>
          ) : null}
          <Button type="submit" loading={pending}>
            {session ? c.submitEdit : c.submitCreate}
          </Button>
        </div>
        <div aria-live="polite">
          {state.status === 'success' ? <Text role="status">{c.saved}</Text> : null}
        </div>
      </form>
      {session ? (
        <Dialog
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          title={c.cancelConfirmTitle}
        >
          <CancelForm id={session.id} onKeep={() => setConfirmCancel(false)} />
        </Dialog>
      ) : null}
    </>
  );
}

// Formulario propio fuera del principal (los formularios anidados no son válidos).
function CancelForm({ id, onKeep }: { id: string; onKeep: () => void }) {
  return (
    <div className={styles.confirm}>
      <Text tone="muted">{c.cancelConfirmText}</Text>
      <form
        className={styles.confirmActions}
        action={async (formData) => {
          await cancelSessionAction(initialActionState, formData);
        }}
      >
        <input type="hidden" name="id" value={id} />
        <Button type="button" variant="ghost" onClick={onKeep}>
          {c.cancelKeep}
        </Button>
        <Button type="submit">{c.cancelConfirm}</Button>
      </form>
    </div>
  );
}
