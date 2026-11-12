import type { ReactNode } from 'react';
import { ReputationBadge } from '@/components/molecules/ReputationBadge';
import { Badge } from '@/components/atoms/Badge';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import type { ClaimSession } from '@/types/claims';
import { formatDateTime } from '@/utils/dates';
import { liveClaimContent } from '../../content/es-MX';
import type { LiveSeller } from '../../types';
import styles from './EventHeader.module.css';

const c = liveClaimContent;
const tones = {
  draft: 'neutral',
  scheduled: 'info',
  live: 'success',
  ended: 'neutral',
  cancelled: 'danger',
} as const;

type Props = { session: ClaimSession; seller: LiveSeller; children?: ReactNode };

/** Portada del evento: título, vendedor y horario. Los contadores llegan como hijos. */
export function EventHeader({ session, seller, children }: Props) {
  return (
    <ScreenHeader
      contained
      color="orange"
      title={session.title}
      kicker={
        <span className={styles.top}>
          <Badge tone={tones[session.status]}>{c.sessionStatus[session.status]}</Badge>
          <span className={styles.sellerLine}>
            {c.cover.seller}: <span className={styles.seller}>{seller.shopName}</span>
            {seller.city ? ` · ${seller.city}` : ''}
          </span>
          {seller.badge ? (
            <ReputationBadge
              handle={seller.badge.handle}
              name={seller.shopName}
              winsCount={seller.badge.winsCount}
              memberSince={seller.badge.memberSince}
              isSeller
              rating={seller.badge.rating}
              isNew={seller.badge.isNew}
            />
          ) : null}
        </span>
      }
      meta={
        <dl className={styles.dates}>
          <div>
            <dt>{c.cover.starts}</dt>
            <dd>
              <time dateTime={session.starts_at}>{formatDateTime(session.starts_at)}</time>
            </dd>
          </div>
          {session.closes_at ? (
            <div>
              <dt>{c.cover.closes}</dt>
              <dd>
                <time dateTime={session.closes_at}>{formatDateTime(session.closes_at)}</time>
              </dd>
            </div>
          ) : null}
        </dl>
      }
    >
      {children}
    </ScreenHeader>
  );
}
