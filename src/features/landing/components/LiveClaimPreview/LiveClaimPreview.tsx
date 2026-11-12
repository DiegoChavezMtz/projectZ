import Image from 'next/image';
import { Badge } from '@/components/atoms/Badge';
import { PriceCapsule } from '@/components/atoms/PriceCapsule';
import type { PieceState } from '@/components/atoms/StatePill';
import { PieceFrame } from '@/components/molecules/PieceFrame';
import { PieceStack } from '@/components/molecules/PieceStack';
import { landingContent } from '../../content/es-MX';
import { Band } from '../Band';
import { LandingPhoto } from '../LandingPhoto';
import { SectionHeader } from '../SectionHeader';
import styles from './LiveClaimPreview.module.css';

const kinds = {
  available: 'available',
  claimed: 'claimed',
  offer: 'offer',
  sold: 'sold',
} as const satisfies Record<string, PieceState>;

/** Ilustración estática en HTML/CSS. No consume datos reales. */
export function LiveClaimPreview() {
  const {
    id,
    title,
    subtitle,
    roomLabel,
    liveBadge,
    illustrationLabel,
    items,
    activityTitle,
    activity,
  } = landingContent.preview;
  const [first, second, third] = items;
  return (
    <Band
      id={id}
      color="pink"
      labelledBy={`${id}-title`}
      emits="stack"
      stack={
        <PieceStack
          left
          front={{ media: <LandingPhoto src={first.photo.src} sizes="190px" /> }}
          back={[
            { media: <LandingPhoto src={second.photo.src} sizes="190px" /> },
            { media: <LandingPhoto src={third.photo.src} sizes="190px" /> },
          ]}
          state={{ kind: kinds[first.status], label: first.statusLabel }}
        />
      }
    >
      <SectionHeader id={`${id}-title`} title={title} subtitle={subtitle} />
      <div className={styles.room} role="img" aria-label={illustrationLabel} data-theme="dark">
        <div className={styles.bar} aria-hidden="true">
          <span className={styles.roomName}>{roomLabel}</span>
          <Badge tone="accent">{liveBadge}</Badge>
        </div>
        <div className={styles.body} aria-hidden="true">
          <ul className={styles.grid}>
            {items.map((item) => (
              <li key={item.name} className={styles.item}>
                <PieceFrame
                  media={
                    <Image
                      src={item.photo.src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 14rem, 45vw"
                    />
                  }
                  alt=""
                  state={{ kind: kinds[item.status], label: item.statusLabel }}
                />
                <div className={styles.nameRow}>
                  <p className={styles.name}>{item.name}</p>
                  <PriceCapsule>{item.price}</PriceCapsule>
                </div>
                <p className={styles.meta}>{item.meta}</p>
              </li>
            ))}
          </ul>
          <aside className={styles.activity}>
            <p className={styles.activityTitle}>{activityTitle}</p>
            <ul className={styles.feed}>
              {activity.map((entry) => (
                <li key={entry.when} className={styles.entry}>
                  <span className={styles.when}>{entry.when}</span>
                  <span>
                    <strong>{entry.who}</strong> {entry.what}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </Band>
  );
}
