'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { authContent } from '../../content/es-MX';
import { acceptTermsAction } from '../../services/account.actions';
import { initialActionState } from '../../types';
import styles from '../AuthForm.module.css';

const c = authContent.terms;

/** Aceptación de términos para cuentas creadas con Google o por código sin pasar por el registro. */
export function TermsOnboarding({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(acceptTermsAction, initialActionState);
  const failed = state.status === 'error';
  const message =
    state.code === 'validation'
      ? authContent.validation.termsRequired
      : (authContent.errors[state.code ?? ''] ?? authContent.errors.unknown);

  return (
    <form action={action} className={styles.form} noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className={styles.checkLabel}>
        <input
          type="checkbox"
          name="acceptTerms"
          className={styles.checkbox}
          aria-invalid={failed || undefined}
        />
        <span>
          {c.accept} <Link href="/terminos">{c.termsLink}</Link> {c.and}{' '}
          <Link href="/privacidad">{c.privacyLink}</Link>
        </span>
      </label>
      {failed ? (
        <Text tone="danger" size="sm" role="alert">
          {message}
        </Text>
      ) : null}
      <Button type="submit" fullWidth loading={pending}>
        {c.submit}
      </Button>
    </form>
  );
}
