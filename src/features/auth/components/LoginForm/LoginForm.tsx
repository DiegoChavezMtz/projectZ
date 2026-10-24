'use client';

import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { signInAction } from '../../services/auth.actions';
import { loginSchema, type LoginInput } from '../../utils/auth.schemas';
import styles from '../AuthForm.module.css';

const c = authContent;

export function LoginForm({ next }: { next?: string }) {
  const { form, state, pending, onSubmit, errorFor } = useAuthForm<LoginInput>(
    loginSchema,
    signInAction,
    { email: '', password: '' },
  );
  const { register } = form;
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
      <FormField label={c.login.password} error={errorFor('password')}>
        {(control) => (
          <Input
            {...control}
            {...register('password')}
            type="password"
            autoComplete="current-password"
          />
        )}
      </FormField>
      <Button type="submit" fullWidth loading={pending}>
        {c.login.submit}
      </Button>
      <Text size="sm" tone="muted" className={styles.alt}>
        {c.login.noAccount}{' '}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}>
          {c.login.signup}
        </Link>
      </Text>
    </form>
  );
}
