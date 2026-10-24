'use client';

import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { Turnstile } from '@/components/molecules/Turnstile';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { signInAction } from '../../services/auth.actions';
import { loginSchema, type LoginInput } from '../../utils/auth.schemas';
import styles from '../AuthForm.module.css';

const c = authContent;

type Props = { next?: string; notice?: string; oauthError?: string };

export function LoginForm({ next, notice, oauthError }: Props) {
  const { form, state, pending, onSubmit, errorFor, captcha } = useAuthForm<LoginInput>(
    loginSchema,
    signInAction,
    { email: '', password: '' },
  );
  const { register } = form;
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : '';
  const codeHref = `/login?mode=code${next ? `&next=${encodeURIComponent(next)}` : ''}`;

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {notice ? (
        <Text className={styles.notice} role="status">
          {notice}
        </Text>
      ) : null}
      {formError || oauthError ? (
        <Text tone="danger" role="alert">
          {c.errors[formError ?? ''] ??
            (oauthError ? c.oauthErrors[oauthError] : undefined) ??
            c.errors.unknown}
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
      <Turnstile key={captcha.key} onToken={captcha.onToken} />
      <Button type="submit" fullWidth loading={pending} disabled={!captcha.ready}>
        {c.login.submit}
      </Button>
      <div className={styles.links}>
        <Link href="/forgot-password">{c.login.forgot}</Link>
        <Link href={codeHref}>{c.login.useCode}</Link>
      </div>
      <Text size="sm" tone="muted" className={styles.alt}>
        {c.login.noAccount} <Link href={`/signup${nextQuery}`}>{c.login.signup}</Link>
      </Text>
    </form>
  );
}
