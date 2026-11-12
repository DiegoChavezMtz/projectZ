'use client';

import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { FormField } from '@/components/molecules/FormField';
import { authContent } from '../../content/es-MX';
import { useAuthForm } from '../../hooks/useAuthForm';
import { updateShopAction } from '../../services/profile.actions';
import { shopProfileSchema, type ShopProfileInput } from '../../utils/auth.schemas';
import styles from '../AuthForm.module.css';

const c = authContent.seller;

type Props = { shopName: string; slug: string; bio: string; city: string };

/** Ajustes de la tienda: nombre, descripción y ciudad. El enlace se muestra y no se edita. */
export function ShopProfileForm({ shopName, slug, bio, city }: Props) {
  const { form, state, pending, onSubmit, errorFor } = useAuthForm<ShopProfileInput>(
    shopProfileSchema,
    updateShopAction,
    { shopName, bio, city },
  );
  const { register } = form;
  const formError =
    state.status === 'error' && state.code !== 'validation' ? state.code : undefined;
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
      <FormField label={c.shopName} error={errorFor('shopName')}>
        {(control) => <Input {...control} {...register('shopName')} autoComplete="organization" />}
      </FormField>
      <FormField label={c.slug} hint={c.slugFixed}>
        {(control) => <Input {...control} value={`/${slug}`} readOnly />}
      </FormField>
      <FormField label={c.bio} hint={c.bioHint} error={errorFor('bio')}>
        {(control) => <Textarea {...control} {...register('bio')} rows={3} />}
      </FormField>
      <FormField label={c.city} error={errorFor('city')}>
        {(control) => <Input {...control} {...register('city')} autoComplete="address-level2" />}
      </FormField>
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {c.save}
        </Button>
      </div>
    </form>
  );
}
