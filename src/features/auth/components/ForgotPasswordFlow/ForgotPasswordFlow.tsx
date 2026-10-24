'use client';

import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { Turnstile } from '@/components/molecules/Turnstile';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { requestPasswordResetAction, verifyResetCodeAction } from '../../services/recovery.actions';
import { requestCodeSchema, type RequestCodeInput } from '../../utils/auth.schemas';
import { CodeVerifyForm } from '../CodeVerifyForm';
import styles from '../AuthForm.module.css';

const c = authContent;

/** Recuperar contraseña (A7): solicitud genérica → código → /reset-password. */
export function ForgotPasswordFlow({ expired }: { expired?: boolean }) {
  const { form, state, pending, onSubmit, errorFor, captcha } = useAuthForm<RequestCodeInput>(
    requestCodeSchema,
    requestPasswordResetAction,
    { email: '' },
  );
  const { register } = form;
  const sentTo = state.status === 'success' ? form.getValues('email').trim().toLowerCase() : null;
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;

  if (sentTo) {
    return (
      <div className={styles.form}>
        <Text tone="muted">{c.recovery.sent(sentTo)}</Text>
        <CodeVerifyForm
          email={sentTo}
          verifyAction={verifyResetCodeAction}
          resendAction={requestPasswordResetAction}
        />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {expired ? (
        <Text className={styles.notice} role="status">
          {c.recovery.expired}
        </Text>
      ) : null}
      {formError ? (
        <Text tone="danger" role="alert">
          {c.errors[formError] ?? c.errors.unknown}
        </Text>
      ) : null}
      <FormField label={c.login.email} error={errorFor('email')}>
        {(control) => (
          <Input
            {...control}
            {...register('email')}
            type="email"
            autoComplete="email"
            inputMode="email"
          />
        )}
      </FormField>
      <Turnstile key={captcha.key} onToken={captcha.onToken} />
      <Button type="submit" fullWidth loading={pending} disabled={!captcha.ready}>
        {c.recovery.submit}
      </Button>
      <Text size="sm" className={styles.alt}>
        <Link href="/login">{c.recovery.back}</Link>
      </Text>
    </form>
  );
}
