'use client';

import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/atoms/Button';
import { Checkbox } from '@/components/atoms/Checkbox';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { Panel } from '@/components/molecules/Panel';
import { formatDate } from '@/utils/dates';
import { ratingTagLabels, reputationContent, reputationErrors } from '../../content/es-MX';
import { submitRatingAction } from '../../services/rating.actions';
import type { RatingTag, RepRole } from '../../types';
import { tagsForRater } from '../../utils/reputation.utils';
import styles from './RatingForm.module.css';

const c = reputationContent.rating;
const COMMENT_MAX = 280;

type Props = {
  orderId: string;
  myRole: RepRole;
  counterpartyName: string;
  sessionTitle: string;
  rateUntil: string;
  /** Ruta a la que vuelve el login si la sesión caducó. */
  next: string;
};

/** Calificación de una cuenta completada: estrellas, etiquetas por rol y comentario ≤ 280. */
export function RatingForm({
  orderId,
  myRole,
  counterpartyName,
  sessionTitle,
  rateUntil,
  next,
}: Props) {
  const groupId = useId();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<RatingTag[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <Panel role="status" className={styles.root}>
        <Text>{c.done}</Text>
      </Panel>
    );
  }

  const toggleTag = (tag: RatingTag) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );

  const submit = () => {
    if (stars === 0) {
      setError(c.chooseStars);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitRatingAction({ orderId, stars, tags, comment }, next);
        if (result.ok) setDone(true);
        else setError(result.message);
      } catch {
        setError(reputationErrors.unknown ?? null);
      }
    });
  };

  return (
    <Panel as="section" aria-label={c.title} className={styles.root}>
      <div>
        <Heading level={3} size="md">
          {c.title}
        </Heading>
        <Text size="sm" tone="muted">
          {sessionTitle} · {c.about(counterpartyName)}
        </Text>
      </div>

      <fieldset className={styles.stars}>
        <legend className={styles.legend}>{c.stars}</legend>
        <div className={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={styles.star} data-on={n <= stars || undefined}>
              <input
                type="radio"
                name={`${groupId}-stars`}
                value={n}
                checked={stars === n}
                onChange={() => setStars(n)}
                className={styles.radio}
                aria-label={c.star(n)}
              />
              <span aria-hidden="true">★</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.tags}>
        <legend className={styles.legend}>{c.tags}</legend>
        {tagsForRater(myRole).map((tag) => (
          <Checkbox
            key={tag}
            label={ratingTagLabels[tag]}
            checked={tags.includes(tag)}
            onChange={() => toggleTag(tag)}
          />
        ))}
      </fieldset>

      <div className={styles.comment}>
        <label htmlFor={`${groupId}-comment`} className={styles.legend}>
          {c.comment}
        </label>
        <Textarea
          id={`${groupId}-comment`}
          rows={3}
          maxLength={COMMENT_MAX}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          aria-describedby={`${groupId}-hint`}
        />
        <span id={`${groupId}-hint`} className={styles.hint}>
          {c.commentHint} ({comment.length}/{COMMENT_MAX})
        </span>
      </div>

      <Text size="sm" tone="muted">
        {c.window(formatDate(rateUntil))}
      </Text>
      {error ? (
        <Text size="sm" tone="danger" role="alert">
          {error}
        </Text>
      ) : null}
      <Button onClick={submit} loading={pending}>
        {pending ? c.submitting : c.submit}
      </Button>
    </Panel>
  );
}
