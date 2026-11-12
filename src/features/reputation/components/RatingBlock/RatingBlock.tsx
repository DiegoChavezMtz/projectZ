import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { reputationContent } from '../../content/es-MX';
import type { RatingSummary } from '../../types';
import { formatRating, groupTags, ratingDistribution } from '../../utils/reputation.utils';
import styles from './RatingBlock.module.css';

const c = reputationContent.page;

/** Calificación promedio con distribución por estrellas y etiquetas más frecuentes. */
export function RatingBlock({ summary }: { summary: RatingSummary }) {
  const id = `ratings-${summary.role}`;
  const heading = `${c.ratingsTitle} · ${summary.role === 'buyer' ? c.buyerStats : c.sellerStats}`;
  if (summary.average === null) {
    return (
      <Panel as="section" aria-labelledby={id}>
        <Heading level={2} size="md" id={id}>
          {heading}
        </Heading>
        <Text tone="muted">{c.noRatings}</Text>
      </Panel>
    );
  }
  const tags = groupTags(summary.topTags);
  return (
    <Panel as="section" aria-labelledby={id}>
      <Heading level={2} size="md" id={id}>
        {heading}
      </Heading>
      <Text className={styles.average}>
        <span aria-hidden="true">★ </span>
        {c.ratingAverage(formatRating(summary.average), summary.count)}
      </Text>
      <ul className={styles.bars}>
        {ratingDistribution(summary.distribution).map((row) => (
          <li key={row.stars} className={styles.bar}>
            <span className={styles.barLabel}>{c.starsRow(row.stars)}</span>
            <meter
              className={styles.meter}
              min={0}
              max={1}
              value={row.share}
              aria-label={`${c.starsRow(row.stars)}: ${row.total}`}
            />
            <span className={styles.barCount}>{row.total}</span>
          </li>
        ))}
      </ul>
      {tags.length > 0 ? (
        <ul className={styles.tags}>
          {tags.map((tag) => (
            <li key={tag.tag} className={styles.tag}>
              {tag.label} · {tag.total}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
