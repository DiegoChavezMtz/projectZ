import { Heading } from '@/components/atoms/Heading';
import { Picture } from '@/components/atoms/Picture';
import { Text } from '@/components/atoms/Text';
import { publicEnv } from '@/lib/env.public';
import type { ClaimItem } from '@/types/claims';
import { itemImageUrl } from '@/utils/image';
import { formatMXN } from '@/utils/money';
import { liveClaimContent } from '../../content/es-MX';
import type { LiveSnapshot, CategoryView } from '../../types';
import { summarizeEnded } from '../../utils/ended';
import { EventHeader } from '../EventHeader';
import styles from './EndedView.module.css';

const c = liveClaimContent.ended;

type Props = {
  session: LiveSnapshot['session'];
  seller: LiveSnapshot['seller'];
  items: ClaimItem[];
  category: CategoryView;
};

/** Resumen de solo lectura. Solo muestra datos públicos: título, precio publicado y nombre del comprador. */
export function EndedView({ session, seller, items, category }: Props) {
  const { sold, unsold } = summarizeEnded(items);
  const noun = category.itemLabels.plural;
  const image = (path: string | null) => itemImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, path);

  return (
    <div className={styles.root}>
      <EventHeader session={session} seller={seller} />
      <Text tone="muted">{c.thanks}</Text>

      <section aria-labelledby="sold-title" className={styles.section}>
        <Heading level={2} size="lg" id="sold-title">
          {c.soldHeading} · {c.soldCount(sold.length, noun)}
        </Heading>
        {sold.length === 0 ? (
          <Text tone="muted">{c.nothingSold}</Text>
        ) : (
          <ul className={styles.list}>
            {sold.map((item) => (
              <li key={item.id} className={styles.row}>
                <Picture
                  className={styles.thumb}
                  aspect={category.imageAspect}
                  src={image(item.imagePath)}
                  alt={item.title}
                />
                <div>
                  <p className={styles.title}>{item.title}</p>
                  <Text size="sm" tone="muted">
                    {c.publishedPrice}: {formatMXN(item.priceCents)}
                    {item.buyerName ? ` · ${c.to(item.buyerName)}` : ''}
                  </Text>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="unsold-title" className={styles.section}>
        <Heading level={2} size="lg" id="unsold-title">
          {c.unsoldHeading}
        </Heading>
        {unsold.length === 0 ? (
          <Text tone="muted">{c.nothingUnsold}</Text>
        ) : (
          <ul className={styles.list}>
            {unsold.map((item) => (
              <li key={item.id} className={styles.row}>
                <Picture
                  className={styles.thumb}
                  aspect={category.imageAspect}
                  src={image(item.imagePath)}
                  alt={item.title}
                />
                <div>
                  <p className={styles.title}>{item.title}</p>
                  <Text size="sm" tone="muted">
                    {formatMXN(item.priceCents)}
                  </Text>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
