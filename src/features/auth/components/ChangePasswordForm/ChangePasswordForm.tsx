'use client';

import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { Turnstile } from '@/components/molecules/Turnstile';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { changePasswordAction } from '../../services/account.actions';
import { changePasswordSchema, type ChangePasswordInput } from '../../utils/auth.schemas';
import styles from '../AuthForm.module.css';

const c = authContent.security.password;

/** A8. Las cuentas solo-Google (`hasPassword = false`) establecen su primera contraseña sin pedir la actual. */
export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { form, state, pending, onSubmit, errorFor, captcha } = useAuthForm<
    ChangePasswordInput & { confirmPassword: string }
  >(changePasswordSchema, changePasswordAction, {
    currentPassword: '',
    password: '',
    confirmPassword: '',
  });
  const { register } = form;
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;

  return (
    <form
      onSubmit={onSubmit}
      className={styles.section}
      noValidate
      aria-labelledby="password-title"
    >
      <Heading level={2} size="lg" id="password-title">
        {hasPassword ? c.title : c.titleSet}
      </Heading>
      {!hasPassword ? <Text tone="muted">{c.hintSet}</Text> : null}
      {state.status === 'success' ? (
        <Text className={styles.notice} role="status">
          {c.success}
        </Text>
      ) : null}
      {formError ? (
        <Text tone="danger" role="alert">
          {authContent.errors[formError] ?? authContent.errors.unknown}
        </Text>
      ) : null}
      {hasPassword ? (
        <FormField label={c.current} error={errorFor('currentPassword')}>
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
      <FormField label={c.next} hint={authContent.signup.passwordHint} error={errorFor('password')}>
        {(control) => (
          <Input
            {...control}
            {...register('password')}
            type="password"
            autoComplete="new-password"
          />
        )}
      </FormField>
      <FormField label={c.confirm} error={errorFor('confirmPassword')}>
        {(control) => (
          <Input
            {...control}
            {...register('confirmPassword')}
            type="password"
            autoComplete="new-password"
          />
        )}
      </FormField>
      {hasPassword ? <Turnstile key={captcha.key} onToken={captcha.onToken} /> : null}
      <div className={styles.actions}>
        <Button type="submit" loading={pending} disabled={hasPassword && !captcha.ready}>
          {hasPassword ? c.submit : c.submitSet}
        </Button>
      </div>
    </form>
  );
}
