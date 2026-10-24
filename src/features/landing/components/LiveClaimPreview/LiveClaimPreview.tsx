import clsx from 'clsx';
import Image from 'next/image';
import { Badge } from '@/components/atoms/Badge';
import { Container } from '@/components/atoms/Container';
import { landingContent } from '../../content/es-MX';
import { SectionHeader } from '../SectionHeader';
import styles from './LiveClaimPreview.module.css';

const tones = { available: 'success', claimed: 'neutral', offer: 'accent', sold: 'info' } as const;

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
  return (
    <section id={id} className={styles.root} aria-labelledby={`${id}-title`}>
      <Container>
        <SectionHeader id={`${id}-title`} title={title} subtitle={subtitle} />
        <div className={styles.room} role="img" aria-label={illustrationLabel}>
          <div className={styles.bar} aria-hidden="true">
            <span className={styles.roomName}>{roomLabel}</span>
            <Badge tone="danger">
              <span className={styles.dot} />
              {liveBadge}
            </Badge>
          </div>
          <div className={styles.body} aria-hidden="true">
            <ul className={styles.grid}>
              {items.map((item) => (
                <li
                  key={item.name}
                  className={clsx(
                    styles.item,
                    (item.status === 'claimed' || item.status === 'sold') && styles.dim,
                  )}
                >
                  <div className={styles.art}>
                    <Image
                      src={item.photo.src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 14rem, 45vw"
                      className={styles.photo}
                    />
                    <Badge tone={tones[item.status]} className={styles.status}>
                      {item.statusLabel}
                    </Badge>
                  </div>
                  <p className={styles.name}>{item.name}</p>
                  <p className={styles.meta}>{item.meta}</p>
                  <p className={styles.price}>{item.price}</p>
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
      </Container>
    </section>
  );
}
