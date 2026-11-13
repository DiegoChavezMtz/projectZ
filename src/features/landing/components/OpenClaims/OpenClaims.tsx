import Link from 'next/link';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { InfoTag } from '@/components/atoms/InfoTag';
import { StatePill } from '@/components/atoms/StatePill';
import { Text } from '@/components/atoms/Text';
import { PieceFrame } from '@/components/molecules/PieceFrame';
import { PieceStack } from '@/components/molecules/PieceStack';
import { publicEnv } from '@/lib/env.public';
import { formatDateTime } from '@/utils/dates';
import { itemImageUrl } from '@/utils/image';
import { landingContent } from '../../content/es-MX';
import { openClaimsService } from '../../services/openClaims.service';
import type { OpenClaim } from '../../types';
import { Band } from '../Band';
import { LandingPhoto } from '../LandingPhoto';
import { LiveClaimPreview } from '../LiveClaimPreview';
import { SectionHeader } from '../SectionHeader';
import styles from './OpenClaims.module.css';

const c = landingContent.openClaims;

/** Tarjeta de un claim real: espacio, hora de inicio, número de piezas, muestra y enlace. Sin urgencia. */
export function OpenClaimCard({ claim }: { claim: OpenClaim }) {
  const live = claim.status === 'live';
  const when = formatDateTime(claim.startsAt);
  return (
    <article className={styles.card} aria-labelledby={`open-claim-${claim.id}`}>
      <div className={styles.top}>
        <StatePill state={live ? 'available' : 'offer'}>{live ? c.live : c.scheduled}</StatePill>
        <InfoTag tone="ink">{c.pieces(claim.itemCount)}</InfoTag>
      </div>
      <Heading level={3} size="lg" id={`open-claim-${claim.id}`} className={styles.title}>
        {claim.title}
      </Heading>
      <Text size="sm" className={styles.meta}>
        {claim.handle ? (
          <Link href={`/u/${claim.handle}`} className={styles.link}>
            {c.seller(claim.shopName)}
          </Link>
        ) : (
          c.seller(claim.shopName)
        )}
      </Text>
      <Text size="sm" className={styles.meta}>
        <time dateTime={claim.startsAt}>{live ? c.startedAt(when) : c.startsAt(when)}</time>
      </Text>
      {claim.photos.length > 0 ? (
        <ul className={styles.photos} aria-label={c.photosLabel}>
          {claim.photos.map((path) => (
            <li key={path}>
              <PieceFrame
                size="thumb"
                alt=""
                src={itemImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, path)}
                className={styles.photo}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <Button href={`/c/${claim.code}`} className={styles.cta}>
        {c.open}
      </Button>
    </article>
  );
}

/** Presentación pura (con 0, 1 o N claims): los claims reales o el estado vacío con la muestra de ejemplo. */
export function OpenClaimsView({ claims }: { claims: OpenClaim[] }) {
  if (claims.length === 0) {
    return (
      <>
        <Band id={c.id} color="pink" labelledBy={`${c.id}-title`} className={styles.emptyBand}>
          <SectionHeader id={`${c.id}-title`} title={c.emptyTitle} subtitle={c.emptyText} />
        </Band>
        <LiveClaimPreview example />
      </>
    );
  }
  const sample = landingContent.preview.items;
  return (
    <Band
      id={c.id}
      color="pink"
      labelledBy={`${c.id}-title`}
      emits="stack"
      stack={
        <PieceStack
          left
          front={{ media: <LandingPhoto src={sample[0].photo.src} sizes="190px" /> }}
          back={[
            { media: <LandingPhoto src={sample[1].photo.src} sizes="190px" /> },
            { media: <LandingPhoto src={sample[2].photo.src} sizes="190px" /> },
          ]}
          state={{ kind: 'available', label: sample[0].statusLabel }}
        />
      }
    >
      <SectionHeader id={`${c.id}-title`} title={c.title} subtitle={c.subtitle} />
      <ul className={styles.list}>
        {claims.map((claim) => (
          <li key={claim.id}>
            <OpenClaimCard claim={claim} />
          </li>
        ))}
      </ul>
    </Band>
  );
}

/** Sección de la landing con los claims reales (cacheada ≤ 60 s; no lee la sesión). */
export async function OpenClaims() {
  const claims = await openClaimsService.list();
  return <OpenClaimsView claims={claims} />;
}
