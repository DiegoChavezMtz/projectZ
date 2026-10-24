'use client';

import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { resetPasswordAction } from '../../services/recovery.actions';
import { resetPasswordSchema, type ResetPasswordInput } from '../../utils/auth.schemas';
import styles from '../AuthForm.module.css';

const c = authContent;

export function ResetPasswordForm() {
  const { form, state, pending, onSubmit, errorFor } = useAuthForm<ResetPasswordInput>(
    resetPasswordSchema,
    resetPasswordAction,
    { password: '', confirmPassword: '' },
  );
  const { register } = form;
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {formError ? (
        <Text tone="danger" role="alert">
          {c.errors[formError] ?? c.errors.unknown}
        </Text>
      ) : null}
      <FormField
        label={c.recovery.newPassword}
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
      <FormField label={c.recovery.confirmPassword} error={errorFor('confirmPassword')}>
        {(control) => (
          <Input
            {...control}
            {...register('confirmPassword')}
            type="password"
            autoComplete="new-password"
          />
        )}
      </FormField>
      <Button type="submit" fullWidth loading={pending}>
        {c.recovery.resetSubmit}
      </Button>
    </form>
  );
}
