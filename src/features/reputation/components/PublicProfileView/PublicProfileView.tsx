import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { publicEnv } from '@/lib/env.public';
import { formatDateTime } from '@/utils/dates';
import { avatarUrl } from '@/utils/image';
import { reputationContent } from '../../content/es-MX';
import { reputationService } from '../../services/reputation.service';
import type { RepRole } from '../../types';
import { formatMemberSince, formatSellerSince, isNewUser } from '../../utils/reputation.utils';
import { HistoryList } from '../HistoryList';
import { RatingBlock } from '../RatingBlock';
import { StatsBlock } from '../StatsBlock';
import styles from './PublicProfileView.module.css';

const c = reputationContent.page;

type Props = { handle: string; role?: RepRole; page?: number };

/** `/u/[handle]`: perfil público con estadísticas, calificaciones, historial y claims del vendedor (SSR). */
export async function PublicProfileView({ handle, role, page }: Props) {
  await connection();
  const data = await reputationService.profilePage(handle, { role, page });
  if (!data) notFound();
  const { profile, history, buyerRatings, sellerRatings, events, showBuyer, showSeller } = data;
  const { header, stats } = profile;

  const name = header.isDeleted ? c.deletedUser : header.displayName;

  return (
    <Container className={styles.root}>
      <header className={styles.header}>
        <Avatar
          name={name}
          size="lg"
          src={
            header.isDeleted
              ? null
              : avatarUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, header.avatarPath)
          }
        />
        <div className={styles.identity}>
          <Heading level={1} size="xl">
            {name}
          </Heading>
          <Text tone="muted">@{header.handle}</Text>
          <Text size="sm" tone="muted">
            {formatMemberSince(header.memberSince)}
          </Text>
          <div className={styles.badges}>
            {header.isSeller && header.shopName ? (
              <Badge tone="accent">{header.shopName}</Badge>
            ) : null}
            {header.isSeller && header.sellerSince ? (
              <Text as="span" size="sm" tone="muted">
                {formatSellerSince(header.sellerSince)}
              </Text>
            ) : null}
            {isNewUser(stats) ? <Badge tone="info">{c.isNew}</Badge> : null}
          </div>
        </div>
      </header>

      {showBuyer || showSeller ? (
        <div className={styles.grid}>
          {showBuyer ? <StatsBlock role="buyer" stats={stats} /> : null}
          {showSeller ? <StatsBlock role="seller" stats={stats} /> : null}
          {buyerRatings && buyerRatings.count > 0 ? <RatingBlock summary={buyerRatings} /> : null}
          {sellerRatings && sellerRatings.count > 0 ? (
            <RatingBlock summary={sellerRatings} />
          ) : null}
        </div>
      ) : null}

      {header.isSeller && !header.isDeleted ? (
        <section aria-labelledby="seller-events" className={styles.events}>
          <Heading level={2} size="lg" id="seller-events">
            {c.eventsTitle}
          </Heading>
          {events.length === 0 ? (
            <Text tone="muted">{c.noEvents}</Text>
          ) : (
            <ul className={styles.list}>
              {events.map((event) => (
                <li key={event.code}>
                  <Panel as="article" className={styles.event}>
                    <Link href={`/c/${event.code}`} className={styles.eventLink}>
                      {event.title}
                    </Link>
                    <Text size="sm" tone="muted">
                      {formatDateTime(event.startsAt)}
                    </Text>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <HistoryList handle={header.handle} history={history} role={role} />
    </Container>
  );
}

export async function publicProfileMetadata(handle: string) {
  const found = await reputationService.displayNameFor(handle);
  const name = found && !found.isDeleted ? found.name : c.deletedUser;
  return {
    title: c.title(found ? name : handle),
    description: c.description(name),
    robots: { index: false, follow: false },
    openGraph: { title: c.title(name), description: c.description(name), type: 'profile' as const },
  };
}
