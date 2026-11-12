'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Picture } from '@/components/atoms/Picture';
import { Select } from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import type { CategoryDefinition } from '@/types/categories';
import type { ClaimItem } from '@/types/claims';
import { centsToPesosInput, parsePesosToCents } from '@/utils/money';
import { claimEventsContent } from '../../content/es-MX';
import { scannerContent } from '../../content/scanner';
import { SELLER_NOTE_MAX } from '../../utils/item.schemas';
import { updateDraftItemAction } from '../../services/scanner/scanner.actions';
import { isItemComplete } from '../../utils/session.utils';
import styles from './ReviewRow.module.css';

const c = scannerContent.review;

type Props = {
  sessionId: string;
  category: CategoryDefinition;
  item: ClaimItem;
  imageUrl: string | null;
  index: number;
  total: number;
  isNew: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onRepeat: () => void;
  /** Avisa del guardado con los valores ya persistidos, para que la lista y el resumen se actualicen. */
  onSaved: (
    message: string,
    saved: Pick<ClaimItem, 'title' | 'price_cents' | 'seller_note'>,
  ) => void;
};

/** Fila editable de la revisión por lotes: Enter en cualquier campo guarda la fila. */
export function ReviewRow({
  sessionId,
  category,
  item,
  imageUrl,
  index,
  total,
  isNew,
  onMove,
  onRemove,
  onRepeat,
  onSaved,
}: Props) {
  const saved = item.attributes as Record<string, unknown>;
  const [title, setTitle] = useState(item.title);
  const [price, setPrice] = useState(
    item.price_cents > 0 ? centsToPesosInput(item.price_cents) : '',
  );
  const [note, setNote] = useState(item.seller_note ?? '');
  const [attributes, setAttributes] = useState<Record<string, string>>(
    Object.fromEntries(category.fields.map((f) => [f.name, String(saved[f.name] ?? '')])),
  );
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [pending, startTransition] = useTransition();
  const complete = isItemComplete(item);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateDraftItemAction({
        sessionId,
        itemId: item.id,
        title,
        price,
        note,
        attributes,
      });
      if (result.status === 'success') {
        setErrors({});
        onSaved(`${c.saved}: ${title.trim()}`, {
          title: title.trim(),
          price_cents: parsePesosToCents(price) ?? 0,
          seller_note: note.trim() === '' ? null : note.trim(),
        });
      } else
        setErrors(
          result.fieldErrors ?? {
            form:
              scannerContent.errors[result.code ?? 'unknown'] ??
              scannerContent.errors.unknown ??
              '',
          },
        );
    });
  };

  return (
    <li className={styles.row} data-testid="review-row">
      <Picture
        className={styles.thumb}
        aspect={category.imageAspect}
        src={imageUrl}
        alt={item.title}
        placeholder="—"
      />
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.badges}>
          <span className={styles.position}>{index + 1}</span>
          {isNew ? <Badge tone="accent">{c.new}</Badge> : null}
          {!complete ? <Badge tone="warning">{c.incomplete}</Badge> : null}
        </div>
        <div className={styles.fields}>
          <FormField label={c.titleLabel} error={errors.title}>
            {(control) => (
              <Input
                {...control}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField label={c.priceLabel} error={errors.price}>
            {(control) => (
              <Input
                {...control}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField
            label={claimEventsContent.items.note}
            hint={claimEventsContent.items.noteHint}
            error={errors.note}
          >
            {(control) => (
              <Input
                {...control}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={SELLER_NOTE_MAX}
                autoComplete="off"
              />
            )}
          </FormField>
          {category.fields.map((field) => (
            <FormField
              key={field.name}
              label={field.label}
              error={errors[`attributes.${field.name}`]}
            >
              {(control) =>
                field.kind === 'select' ? (
                  <Select
                    {...control}
                    value={attributes[field.name] ?? ''}
                    onChange={(e) => setAttributes((a) => ({ ...a, [field.name]: e.target.value }))}
                  >
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    {...control}
                    value={attributes[field.name] ?? ''}
                    onChange={(e) => setAttributes((a) => ({ ...a, [field.name]: e.target.value }))}
                    maxLength={field.maxLength}
                    autoComplete="off"
                  />
                )
              }
            </FormField>
          ))}
        </div>
        {errors.form ? (
          <Text tone="danger" role="alert" size="sm">
            {errors.form}
          </Text>
        ) : null}
        <div className={styles.actions}>
          <Button type="submit" size="sm" loading={pending}>
            {c.save}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label={c.moveUp(item.title)}
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label={c.moveDown(item.title)}
          >
            ↓
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onRepeat}>
            {c.repeat}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            {c.remove}
          </Button>
        </div>
      </form>
    </li>
  );
}
