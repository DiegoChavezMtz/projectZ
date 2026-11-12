import { notFound } from 'next/navigation';
import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Picture } from '@/components/atoms/Picture';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { publicEnv } from '@/lib/env.public';
import { getCategory } from '@/types/categories';
import { formatDateTime } from '@/utils/dates';
import { formatMXN } from '@/utils/money';
import { claimEventsContent } from '../../content/es-MX';
import { claimSessionService } from '../../services/claimSession.service';
import { requireSellerId } from '../../services/seller.context';
import { itemImageUrl } from '../../utils/image';
import { StatusBadge } from '../StatusBadge';
import styles from './PreviewClaimView.module.css';

const c = claimEventsContent.publish;

/** Vista previa para el dueño. Placeholder hasta el visor público (S6). */
export async function PreviewClaimView({ id }: { id: string }) {
  const sellerId = await requireSellerId(`/dashboard/claims/${id}/preview`);
  const session = await claimSessionService.getWithItems(sellerId, id);
  if (!session) notFound();
  const category = getCategory(session.category);

  return (
    <Container className={styles.root}>
      <header className={styles.header}>
        <Heading level={1} size="xl">
          {c.previewTitle}: {session.title}
        </Heading>
        <StatusBadge status={session.status} />
        <Text tone="muted">{formatDateTime(session.starts_at)}</Text>
        <Text size="sm" tone="muted">
          {c.previewText}
        </Text>
        <div>
          {session.status === 'draft' || session.status === 'scheduled' ? (
            <Button href={`/dashboard/claims/${session.id}/edit`} variant="secondary" size="sm">
              {c.backToEdit}
            </Button>
          ) : null}
        </div>
      </header>
      <ul className={styles.grid}>
        {session.items.map((item) => (
          <li key={item.id}>
            <Panel as="article" className={styles.card}>
              <Picture
                aspect={category.imageAspect}
                src={itemImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, item.image_path)}
                alt={item.title}
                placeholder={claimEventsContent.items.missingImage}
              />
              <Text className={styles.title}>{item.title}</Text>
              <Text size="sm" tone="accent">
                {formatMXN(item.price_cents)}
              </Text>
              {item.seller_note ? (
                <Text size="sm" tone="muted">
                  {item.seller_note}
                </Text>
              ) : null}
            </Panel>
          </li>
        ))}
      </ul>
    </Container>
  );
}
