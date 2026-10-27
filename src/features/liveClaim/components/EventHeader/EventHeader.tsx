import type { ReactNode } from 'react';
import { Badge } from '@/components/atoms/Badge';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import type { ClaimSession } from '@/types/claims';
import { formatDateTime } from '@/utils/dates';
import { liveClaimContent } from '../../content/es-MX';
import type { LiveSeller } from '../../types';
import styles from './EventHeader.module.css';

const c = liveClaimContent;
const tones = { draft: 'neutral', scheduled: 'info', live: 'success', ended: 'neutral', cancelled: 'danger' } as const;

type Props = { session: ClaimSession; seller: LiveSeller; children?: ReactNode };

/** Portada del evento: título, vendedor y horario. Los contadores llegan como hijos. */
export function EventHeader({ session, seller, children }: Props) {
  return (
    <header className={styles.root}>
      <div className={styles.top}>
        <Badge tone={tones[session.status]}>{c.sessionStatus[session.status]}</Badge>
        <Text size="sm" tone="muted">
          {c.cover.seller}:{' '}
          {/* El perfil público llega en S9: hasta entonces el nombre no es un enlace. */}
          <span className={styles.seller} title={c.cover.sellerProfileSoon} aria-disabled="true">
            {seller.shopName}
          </span>
          {seller.city ? ` · ${seller.city}` : ''}
        </Text>
      </div>
      <Heading level={1} size="xl">
        {session.title}
      </Heading>
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
      {children}
    </header>
  );
}
