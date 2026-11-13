'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Checkbox } from '@/components/atoms/Checkbox';
import { Input } from '@/components/atoms/Input';
import { Select } from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { publicEnv } from '@/lib/env.public';
import { getCategory } from '@/types/categories';
import type { ClaimItem } from '@/types/claims';
import { centsToPesosInput } from '@/utils/money';
import { claimEventsContent } from '../../content/es-MX';
import { useClaimForm } from '../../hooks/useClaimForm';
import { saveItemAction } from '../../services/claimEvents.actions';
import { itemImageUrl } from '../../utils/image';
import { SELLER_NOTE_MAX, itemFormSchema } from '../../utils/item.schemas';
import { ItemImagePicker } from '../ItemImagePicker';
import styles from './ItemForm.module.css';

const c = claimEventsContent.items;

type Props = {
  sessionId: string;
  categoryId: string;
  /** Sin `item` el formulario crea uno nuevo. */
  item?: ClaimItem;
  onDone: () => void;
  onCancel: () => void;
};

type Values = {
  title: string;
  price: string;
  note: string;
  isPreview: boolean;
  attributes: Record<string, string>;
};

/** Formulario de artículo generado desde la definición de la categoría (sin campos de TCG a mano). */
export function ItemForm({ sessionId, categoryId, item, onDone, onCancel }: Props) {
  const category = getCategory(categoryId);
  const imageRef = useRef<Blob | null>(null);
  const [hasImage, setHasImage] = useState(false);

  const saved = (item?.attributes ?? {}) as Record<string, unknown>;
  const defaults: Values = {
    title: item?.title ?? '',
    price: item ? centsToPesosInput(item.price_cents) : '',
    note: item?.seller_note ?? '',
    isPreview: item?.is_preview ?? false,
    attributes: Object.fromEntries(
      category.fields.map((field) => [field.name, String(saved[field.name] ?? '')]),
    ),
  };

  const { form, state, pending, onSubmit, errorFor } = useClaimForm<Values>(
    itemFormSchema(categoryId),
    saveItemAction,
    defaults,
    (data) => {
      if (imageRef.current)
        data.set(
          'image',
          new File([imageRef.current], imageRef.current.type === 'image/jpeg' ? 'item.jpg' : 'item.webp', {
            type: imageRef.current.type,
          }),
        );
    },
  );
  const { register } = form;

  useEffect(() => {
    if (state.status === 'success') onDone();
  }, [state, onDone]);

  const formError =
    state.status === 'error' &&
    !['validation', 'image_type', 'image_size', 'image_failed'].includes(state.code ?? '')
      ? (state.code ?? 'unknown')
      : undefined;
  const imageError =
    state.status === 'error' && state.code?.startsWith('image_') ? state.code : undefined;

  return (
    <form onSubmit={onSubmit} className={styles.form} noValidate>
      <input type="hidden" name="sessionId" value={sessionId} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      {formError ? (
        <Text tone="danger" role="alert">
          {claimEventsContent.errors[formError] ?? claimEventsContent.errors.unknown}
        </Text>
      ) : null}

      <ItemImagePicker
        currentUrl={itemImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, item?.image_path)}
        aspect={category.imageAspect}
        alt={item?.title ?? ''}
        uploading={pending && hasImage}
        serverError={imageError}
        onChange={(blob) => {
          imageRef.current = blob;
          setHasImage(blob !== null);
        }}
      />

      <FormField label={c.itemTitle} error={errorFor('title')}>
        {(control) => (
          <Input {...control} {...register('title')} maxLength={120} autoComplete="off" />
        )}
      </FormField>
      <FormField label={c.price} hint={c.priceHint} error={errorFor('price')}>
        {(control) => (
          <Input {...control} {...register('price')} inputMode="decimal" autoComplete="off" />
        )}
      </FormField>

      {category.fields.map((field) => (
        <FormField
          key={field.name}
          label={field.label}
          error={errorFor(`attributes.${field.name}`)}
        >
          {(control) =>
            field.kind === 'select' ? (
              <Select {...control} {...register(`attributes.${field.name}`)}>
                {field.required ? (
                  <option value="" disabled>
                    —
                  </option>
                ) : (
                  <option value="">—</option>
                )}
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                {...control}
                {...register(`attributes.${field.name}`)}
                maxLength={field.maxLength}
                autoComplete="off"
              />
            )
          }
        </FormField>
      ))}

      <FormField label={c.note} hint={c.noteHint} error={errorFor('note')}>
        {(control) => (
          <Input
            {...control}
            {...register('note')}
            maxLength={SELLER_NOTE_MAX}
            autoComplete="off"
          />
        )}
      </FormField>

      <Checkbox label={c.preview} hint={c.previewHint} {...register('isPreview')} />

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {c.cancel}
        </Button>
        <Button type="submit" loading={pending}>
          {c.save}
        </Button>
      </div>
    </form>
  );
}
