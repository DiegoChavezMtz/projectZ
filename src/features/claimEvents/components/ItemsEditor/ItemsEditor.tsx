'use client';

import { useState, useTransition } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Picture } from '@/components/atoms/Picture';
import { Text } from '@/components/atoms/Text';
import { Dialog } from '@/components/molecules/Dialog';
import { publicEnv } from '@/lib/env.public';
import { getCategory } from '@/types/categories';
import type { ClaimItem } from '@/types/claims';
import { formatMXN } from '@/utils/money';
import { claimEventsContent } from '../../content/es-MX';
import {
  deleteItemAction,
  duplicateItemAction,
  reorderItemsAction,
} from '../../services/claimEvents.actions';
import { itemImageUrl } from '../../utils/image';
import { isItemComplete, reorderItems } from '../../utils/session.utils';
import { ItemForm } from '../ItemForm';
import styles from './ItemsEditor.module.css';

const c = claimEventsContent.items;

type Props = {
  sessionId: string;
  categoryId: string;
  items: ClaimItem[];
  /** Falso cuando el evento ya no admite cambios. */
  editable: boolean;
};

type Editing = { kind: 'new' } | { kind: 'edit'; item: ClaimItem } | null;

/**
 * Lista de artículos con reordenamiento (arrastrar y soltar, o botones subir/bajar para teclado y táctil),
 * alta/edición en diálogo, duplicado y borrado con confirmación. La lista se reinicia al llegar datos nuevos
 * del servidor (el padre cambia su `key`).
 */
export function ItemsEditor({ sessionId, categoryId, items, editable }: Props) {
  const category = getCategory(categoryId);
  const { singular, plural } = category.itemLabels;
  const [list, setList] = useState(items);
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<ClaimItem | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const incomplete = list.filter((item) => !isItemComplete(item)).length;

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= list.length) return;
    const previous = list;
    const next = reorderItems(list, from, to);
    setList(next);
    setError(null);
    const moved = next[to];
    if (moved) setAnnouncement(c.moved(moved.title, to + 1));
    startTransition(async () => {
      const result = await reorderItemsAction(
        sessionId,
        next.map((item) => item.id),
      );
      if (result.status === 'error') {
        setList(previous);
        setError(result.code ?? 'reorder_failed');
      }
    });
  };

  const run = (action: () => Promise<{ status: string; code?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (result.status === 'error') setError(result.code ?? 'unknown');
    });

  return (
    <section className={styles.root} aria-labelledby="items-heading">
      <div className={styles.header}>
        <Heading level={2} size="lg" id="items-heading">
          {c.title} ({list.length})
        </Heading>
        {editable ? (
          <Button type="button" onClick={() => setEditing({ kind: 'new' })}>
            {c.add(singular)}
          </Button>
        ) : null}
      </div>

      {incomplete > 0 ? (
        <Text size="sm" tone="muted" role="status">
          {c.incompleteSummary(incomplete)}
        </Text>
      ) : null}
      {editable && list.length > 1 ? (
        <Text size="sm" tone="muted">
          {c.reorderHint}
        </Text>
      ) : null}
      {error ? (
        <Text tone="danger" role="alert">
          {claimEventsContent.errors[error] ?? claimEventsContent.errors.unknown}
        </Text>
      ) : null}
      <div className={styles.live} aria-live="polite" role="status">
        {announcement}
      </div>

      {list.length === 0 ? (
        <Text tone="muted">{c.empty(plural)}</Text>
      ) : (
        <ol className={styles.list}>
          {list.map((item, index) => {
            const complete = isItemComplete(item);
            return (
              <li
                key={item.id}
                className={styles.item}
                data-dragging={dragFrom === index || undefined}
                data-testid="item-row"
                draggable={editable}
                onDragStart={() => setDragFrom(index)}
                onDragOver={(event) => editable && event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragFrom !== null) move(dragFrom, index);
                  setDragFrom(null);
                }}
                onDragEnd={() => setDragFrom(null)}
              >
                <span className={styles.position} aria-label={c.position(index + 1, list.length)}>
                  {index + 1}
                </span>
                <Picture
                  className={styles.thumb}
                  aspect={category.imageAspect}
                  src={itemImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, item.image_path)}
                  alt={item.title}
                  placeholder={c.missingImage}
                />
                <div className={styles.info}>
                  <Text className={styles.itemTitle}>{item.title}</Text>
                  <Text size="sm" tone="muted">
                    {formatMXN(item.price_cents)}
                  </Text>
                  <div className={styles.badges}>
                    {!complete ? <Badge tone="warning">{c.incomplete}</Badge> : null}
                    {item.is_preview ? <Badge tone="accent">{c.preview_badge}</Badge> : null}
                  </div>
                </div>
                {editable ? (
                  <div className={styles.actions}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={index === 0 || pending}
                      aria-label={c.moveUp(item.title)}
                      onClick={() => move(index, index - 1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={index === list.length - 1 || pending}
                      aria-label={c.moveDown(item.title)}
                      onClick={() => move(index, index + 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing({ kind: 'edit', item })}
                    >
                      {c.edit}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => duplicateItemAction(sessionId, item.id))}
                    >
                      {c.duplicate}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoving(item)}
                    >
                      {c.remove}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.kind === 'edit' ? c.editTitle(singular) : c.newTitle(singular)}
      >
        {editing ? (
          <ItemForm
            key={editing.kind === 'edit' ? editing.item.id : 'new'}
            sessionId={sessionId}
            categoryId={categoryId}
            item={editing.kind === 'edit' ? editing.item : undefined}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={c.removeConfirmTitle}
      >
        <div className={styles.confirm}>
          <Text>{removing?.title}</Text>
          <Text tone="muted">{c.removeConfirmText}</Text>
          <div className={styles.confirmActions}>
            <Button type="button" variant="ghost" onClick={() => setRemoving(null)}>
              {c.cancel}
            </Button>
            <Button
              type="button"
              loading={pending}
              onClick={() => {
                const target = removing;
                setRemoving(null);
                if (target) run(() => deleteItemAction(sessionId, target.id));
              }}
            >
              {c.removeConfirm}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
