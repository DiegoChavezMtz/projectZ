'use client';

import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { signUpAction } from '../../services/auth.actions';
import { signupSchema, type SignupInput } from '../../utils/auth.schemas';
import styles from '../AuthForm.module.css';

const c = authContent;

export function SignupForm({ next }: { next?: string }) {
  const { form, state, pending, onSubmit, errorFor } = useAuthForm<SignupInput>(
    signupSchema,
    signUpAction,
    { email: '', password: '', displayName: '', acceptTerms: false as unknown as true },
  );
  const { register } = form;
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;
  const termsError = errorFor('acceptTerms');

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {formError ? (
        <Text tone="danger" role="alert">
          {c.errors[formError] ?? c.errors.unknown}{' '}
          {formError === 'email_exists' ? <Link href="/login">{c.signup.login}</Link> : null}
        </Text>
      ) : null}
      <FormField
        label={c.signup.displayName}
        hint={c.signup.displayNameHint}
        error={errorFor('displayName')}
      >
        {(control) => <Input {...control} {...register('displayName')} autoComplete="nickname" />}
      </FormField>
      <FormField label={c.signup.email} error={errorFor('email')}>
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
      <FormField
        label={c.signup.password}
        hint={c.signup.passwordHint}
        error={errorFor('password')}
      >
        {(control) => (
          <Input
            {...control}
            {...register('password')}
            type="password"
            autoComplete="new-password"
          />
        )}
      </FormField>
      <div className={styles.terms}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            className={styles.checkbox}
            aria-invalid={termsError ? true : undefined}
            aria-describedby={termsError ? 'terms-error' : undefined}
            {...register('acceptTerms')}
          />
          <span>
            {c.signup.termsPrefix} <Link href="/terminos">{c.signup.terms}</Link>{' '}
            {c.signup.termsMiddle} <Link href="/privacidad">{c.signup.privacy}</Link>
          </span>
        </label>
        {termsError ? (
          <Text id="terms-error" size="sm" tone="danger" role="alert">
            {termsError}
          </Text>
        ) : null}
      </div>
      <Button type="submit" fullWidth loading={pending}>
        {c.signup.submit}
      </Button>
      <Text size="sm" tone="muted" className={styles.alt}>
        {c.signup.haveAccount}{' '}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>
          {c.signup.login}
        </Link>
      </Text>
    </form>
  );
}
