'use client';

import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { FormField } from '@/components/molecules/FormField';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { useAvailability } from '../../hooks/useAvailability';
import { availabilityClient } from '../../services/availability.client';
import { createSellerAction } from '../../services/profile.actions';
import { SLUG_PATTERN, sellerSchema, type SellerInput } from '../../utils/auth.schemas';
import { isReservedHandle } from '../../utils/handle';
import { slugify } from '../../utils/slug';
import styles from '../AuthForm.module.css';

const c = authContent.seller;

/** A11: crea `seller_profiles`. El enlace se sugiere del nombre y se valida en vivo con `is_slug_available`. */
export function SellerOnboardingForm() {
  const { form, state, pending, onSubmit, errorFor } = useAuthForm<SellerInput>(
    sellerSchema,
    createSellerAction,
    { shopName: '', slug: '', bio: '', city: '', paymentInstructions: '' },
  );
  const { register, watch, setValue, getFieldState, formState } = form;
  const slug = watch('slug') ?? '';
  const availability = useAvailability(slug, {
    valid: SLUG_PATTERN.test(slug) && !isReservedHandle(slug),
    check: availabilityClient.isSlugAvailable,
  });

  const shopName = register('shopName');
  const formError =
    state.status === 'error' && state.code !== 'validation' && state.code !== 'slug_taken'
      ? state.code
      : undefined;
  const slugError =
    availability === 'taken' || errorFor('slug') === 'taken' ? c.taken : errorFor('slug');
  const note =
    availability === 'checking'
      ? c.checking
      : availability === 'available'
        ? c.available
        : undefined;

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      {formError ? (
        <Text tone="danger" role="alert">
          {authContent.errors[formError] ?? authContent.errors.unknown}
        </Text>
      ) : null}
      <FormField label={c.shopName} error={errorFor('shopName')}>
        {(control) => (
          <Input
            {...control}
            {...shopName}
            autoComplete="organization"
            onChange={(event) => {
              void shopName.onChange(event);
              // Sugiere el enlace mientras la persona no lo haya tocado.
              if (!getFieldState('slug', formState).isDirty)
                setValue('slug', slugify(event.target.value));
            }}
          />
        )}
      </FormField>
      <FormField label={c.slug} hint={note ?? c.slugHint} error={slugError}>
        {(control) => (
          <Input
            {...control}
            {...register('slug')}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </FormField>
      <FormField label={c.bio} hint={c.bioHint} error={errorFor('bio')}>
        {(control) => <Textarea {...control} {...register('bio')} rows={3} />}
      </FormField>
      <FormField label={c.city} error={errorFor('city')}>
        {(control) => <Input {...control} {...register('city')} autoComplete="address-level2" />}
      </FormField>
      <FormField label={c.payment} hint={c.paymentHint} error={errorFor('paymentInstructions')}>
        {(control) => <Textarea {...control} {...register('paymentInstructions')} rows={3} />}
      </FormField>
      <Button type="submit" fullWidth loading={pending} disabled={availability === 'taken'}>
        {c.submit}
      </Button>
    </form>
  );
}
