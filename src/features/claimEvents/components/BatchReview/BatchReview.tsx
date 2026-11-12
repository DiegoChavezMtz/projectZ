'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { VisuallyHidden } from '@/components/atoms/VisuallyHidden';
import { publicEnv } from '@/lib/env.public';
import type { CategoryDefinition } from '@/types/categories';
import type { ClaimItem } from '@/types/claims';
import { scannerContent } from '../../content/scanner';
import { deleteItemAction, reorderItemsAction } from '../../services/claimEvents.actions';
import { itemImageUrl } from '../../utils/image';
import { isItemComplete, reorderItems } from '../../utils/session.utils';
import { ConfirmDialog } from '../ConfirmDialog';
import { ReviewRow } from '../ReviewRow';
import styles from './BatchReview.module.css';

const c = scannerContent.review;

type Props = {
  sessionId: string;
  category: CategoryDefinition;
  items: ClaimItem[];
  /** Ids de los artículos creados con el escáner en esta sesión. */
  capturedIds: ReadonlySet<string>;
  onRepeat: (item: ClaimItem) => void;
  onBack: () => void;
  onFinish: () => void;
};

/** S11-08: cuadrícula editable de los artículos del evento; los recién capturados van marcados. */
export function BatchReview({
  sessionId,
  category,
  items,
  capturedIds,
  onRepeat,
  onBack,
  onFinish,
}: Props) {
  const [list, setList] = useState(items);
  // Si el servidor trae artículos distintos (altas o bajas), la lista se vuelve a tomar de él. Las ediciones y
  // los reordenamientos no cambian el conjunto de ids, así que no reinician la pantalla ni el foco.
  const signature = items
    .map((i) => i.id)
    .sort()
    .join(',');
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setList(items);
  }
  const [removing, setRemoving] = useState<ClaimItem | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const incomplete = list.filter((item) => !isItemComplete(item)).length;

  const move = (from: number, delta: -1 | 1) => {
    const to = from + delta;
    if (to < 0 || to >= list.length) return;
    const previous = list;
    const next = reorderItems(list, from, to);
    setList(next);
    setError(null);
    const moved = next[to];
    if (moved) setAnnouncement(c.moved(moved.title, to + 1));
    startTransition(async () => {
      const result = await reorderItemsAction(
        sessionId,
        next.map((i) => i.id),
      );
      if (result.status === 'error') {
        setList(previous);
        setError(
          scannerContent.errors[result.code ?? 'unknown'] ?? scannerContent.errors.unknown ?? '',
        );
      }
    });
  };

  const remove = (item: ClaimItem) =>
    startTransition(async () => {
      const result = await deleteItemAction(sessionId, item.id);
      if (result.status === 'error')
        setError(
          scannerContent.errors[result.code ?? 'unknown'] ?? scannerContent.errors.unknown ?? '',
        );
      else {
        setList((l) => l.filter((i) => i.id !== item.id));
        setAnnouncement(`${item.title}: ${c.remove}`);
      }
    });

  return (
    <section className={styles.root} aria-labelledby="review-heading">
      <div className={styles.header}>
        <Heading level={1} size="xl" id="review-heading">
          {c.title}
        </Heading>
        <div className={styles.headerActions}>
          <Button type="button" variant="secondary" onClick={onBack}>
            {scannerContent.pageTitle}
          </Button>
          <Button type="button" onClick={onFinish}>
            {c.finish}
          </Button>
        </div>
      </div>
      <Text role="status" tone={incomplete > 0 ? 'default' : 'muted'}>
        {c.summary(list.length, incomplete)}
      </Text>
      {error ? (
        <Text tone="danger" role="alert">
          {error}
        </Text>
      ) : null}
      <div role="status" aria-live="polite">
        <VisuallyHidden>{announcement}</VisuallyHidden>
      </div>

      {list.length === 0 ? (
        <Text tone="muted">{c.empty}</Text>
      ) : (
        <ol className={styles.list} aria-busy={pending}>
          {list.map((item, index) => (
            <ReviewRow
              key={item.id}
              sessionId={sessionId}
              category={category}
              item={item}
              imageUrl={itemImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, item.image_path)}
              index={index}
              total={list.length}
              isNew={capturedIds.has(item.id)}
              onMove={(delta) => move(index, delta)}
              onRemove={() => setRemoving(item)}
              onRepeat={() => onRepeat(item)}
              onSaved={(message, saved) => {
                setAnnouncement(message);
                setList((current) =>
                  current.map((i) => (i.id === item.id ? { ...i, ...saved } : i)),
                );
              }}
            />
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={c.remove}
        text={scannerContent.review.removeConfirm(removing?.title ?? '')}
        confirmLabel={c.removeYes}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />
    </section>
  );
}
