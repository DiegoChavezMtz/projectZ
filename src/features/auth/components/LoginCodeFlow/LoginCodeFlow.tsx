'use client';

import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { Turnstile } from '@/components/molecules/Turnstile';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import {
  requestLoginCodeAction,
  resendLoginCodeAction,
  verifyLoginCodeAction,
} from '../../services/auth.actions';
import { requestCodeSchema, type RequestCodeInput } from '../../utils/auth.schemas';
import { CodeVerifyForm } from '../CodeVerifyForm';
import styles from '../AuthForm.module.css';

const c = authContent;

/** Acceso por código (A5): correo → código de 6 dígitos → sesión. La respuesta nunca revela si el correo existe. */
export function LoginCodeFlow({ next }: { next?: string }) {
  const { form, state, pending, onSubmit, errorFor, captcha } = useAuthForm<RequestCodeInput>(
    requestCodeSchema,
    requestLoginCodeAction,
    { email: '' },
  );
  const { register } = form;
  const sentTo = state.status === 'success' ? form.getValues('email').trim().toLowerCase() : null;
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;
  const passwordHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  if (sentTo) {
    return (
      <div className={styles.form}>
        <Text tone="muted">{c.login.codeSent(sentTo)}</Text>
        <CodeVerifyForm
          email={sentTo}
          next={next}
          verifyAction={verifyLoginCodeAction}
          resendAction={resendLoginCodeAction}
        />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
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
        {c.login.codeSubmit}
      </Button>
      <Text size="sm" className={styles.alt}>
        <Link href={passwordHref}>{c.login.usePassword}</Link>
      </Text>
    </form>
  );
}
