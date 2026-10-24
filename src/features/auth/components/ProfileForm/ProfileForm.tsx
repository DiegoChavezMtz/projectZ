'use client';

import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { useAvailability } from '../../hooks/useAvailability';
import { availabilityClient } from '../../services/availability.client';
import { updateProfileAction } from '../../services/profile.actions';
import { HANDLE_PATTERN, profileSchema, type ProfileInput } from '../../utils/auth.schemas';
import { isReservedHandle } from '../../utils/handle';
import styles from '../AuthForm.module.css';

const c = authContent.profile;

type Props = { displayName: string; handle: string };

/** A10: `display_name` y `handle` con validación en vivo (RPC `is_handle_available`, con debounce). */
export function ProfileForm({ displayName, handle }: Props) {
  const { form, state, pending, onSubmit, errorFor } = useAuthForm<ProfileInput>(
    profileSchema,
    updateProfileAction,
    { displayName, handle },
  );
  const { register, watch } = form;
  const typed = watch('handle') ?? '';
  const availability = useAvailability(typed, {
    valid: HANDLE_PATTERN.test(typed) && !isReservedHandle(typed),
    current: handle,
    check: availabilityClient.isHandleAvailable,
  });

  const formError =
    state.status === 'error' && state.code !== 'validation' && state.code !== 'handle_taken'
      ? state.code
      : undefined;
  const handleError =
    availability === 'taken'
      ? c.taken
      : state.code === 'handle_taken' && typed !== handle
        ? authContent.errors.handle_taken
        : errorFor('handle') === 'taken'
          ? c.taken
          : errorFor('handle');
  const note =
    availability === 'checking'
      ? c.checking
      : availability === 'available'
        ? c.available
        : undefined;

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {state.status === 'success' ? (
        <Text className={styles.notice} role="status">
          {c.saved}
        </Text>
      ) : null}
      {formError ? (
        <Text tone="danger" role="alert">
          {authContent.errors[formError] ?? authContent.errors.unknown}
        </Text>
      ) : null}
      <FormField label={c.displayName} error={errorFor('displayName')}>
        {(control) => <Input {...control} {...register('displayName')} autoComplete="nickname" />}
      </FormField>
      <FormField label={c.handle} hint={note ?? c.handleHint} error={handleError}>
        {(control) => (
          <Input
            {...control}
            {...register('handle')}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </FormField>
      <div className={styles.actions}>
        <Button type="submit" loading={pending} disabled={availability === 'taken'}>
          {c.save}
        </Button>
      </div>
    </form>
  );
}
