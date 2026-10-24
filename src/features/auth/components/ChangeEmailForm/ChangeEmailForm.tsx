'use client';

import { startTransition, useActionState, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { CodeInput } from '@/components/molecules/CodeInput';
import { FormField } from '@/components/molecules/FormField';
import { Turnstile } from '@/components/molecules/Turnstile';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { requestEmailChangeAction, verifyEmailChangeAction } from '../../services/account.actions';
import { initialActionState } from '../../types';
import { changeEmailSchema } from '../../utils/auth.schemas';
import styles from '../AuthForm.module.css';

const c = authContent.security.email;

type Props = { currentEmail: string; hasPassword: boolean; pendingEmail: string | null };
type FormValues = { newEmail: string; currentPassword: string };

/** A9. El correo viejo sigue vigente hasta verificar el código enviado al nuevo. */
export function ChangeEmailForm({ currentEmail, hasPassword, pendingEmail }: Props) {
  const { form, state, pending, onSubmit, errorFor, captcha } = useAuthForm<FormValues>(
    changeEmailSchema,
    requestEmailChangeAction,
    { newEmail: '', currentPassword: '' },
  );
  const { register } = form;
  const requested =
    state.status === 'success' ? form.getValues('newEmail').trim().toLowerCase() : null;
  const awaiting = requested ?? pendingEmail;

  const [verifyState, runVerify, verifying] = useActionState(
    verifyEmailChangeAction,
    initialActionState,
  );
  const [code, setCode] = useState('');
  const verifyError = verifyState.status === 'error' ? verifyState.code : undefined;
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;

  const confirm = (value: string) => {
    if (!awaiting) return;
    const data = new FormData();
    data.set('email', awaiting);
    data.set('code', value);
    startTransition(() => runVerify(data));
  };

  return (
    <section className={styles.section} aria-labelledby="email-title">
      <Heading level={2} size="lg" id="email-title">
        {c.title}
      </Heading>
      <Text tone="muted">{c.current(currentEmail)}</Text>
      {awaiting ? (
        <div className={styles.section}>
          <Text className={styles.notice} role="status">
            {c.pending(awaiting)}
          </Text>
          <Text tone="muted">{c.pendingHelp(awaiting)}</Text>
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={confirm}
            name="code"
            disabled={verifying}
            invalid={Boolean(verifyError)}
          />
          {verifyError ? (
            <Text tone="danger" role="alert">
              {authContent.errors[verifyError] ?? authContent.errors.unknown}
            </Text>
          ) : null}
          <div className={styles.actions}>
            <Button onClick={() => confirm(code)} loading={verifying} disabled={code.length !== 6}>
              {c.confirm}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className={styles.section} noValidate>
          {formError ? (
            <Text tone="danger" role="alert">
              {authContent.errors[formError] ?? authContent.errors.unknown}
            </Text>
          ) : null}
          <FormField label={c.newEmail} error={errorFor('newEmail')}>
            {(control) => (
              <Input
                {...control}
                {...register('newEmail')}
                type="email"
                autoComplete="email"
                inputMode="email"
              />
            )}
          </FormField>
          {hasPassword ? (
            <FormField label={c.password} error={errorFor('currentPassword')}>
              {(control) => (
                <Input
                  {...control}
                  {...register('currentPassword')}
                  type="password"
                  autoComplete="current-password"
                />
              )}
            </FormField>
          ) : null}
          <Turnstile key={captcha.key} onToken={captcha.onToken} />
          <div className={styles.actions}>
            <Button type="submit" loading={pending} disabled={!captcha.ready}>
              {c.submit}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
