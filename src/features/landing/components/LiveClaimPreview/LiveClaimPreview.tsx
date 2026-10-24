import { Badge } from '@/components/atoms/Badge';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import styles from './LiveClaimPreview.module.css';

const tones = { available: 'success', claimed: 'neutral', offer: 'accent' } as const;

/** Ilustración estática en HTML/CSS. No consume datos reales. */
export function LiveClaimPreview() {
  const { title, subtitle, roomLabel, liveBadge, illustrationLabel, items } =
    landingContent.preview;
  return (
    <section className={styles.root} aria-labelledby="preview-title">
      <Container>
        <header className={styles.header}>
          <Heading level={2} id="preview-title">
            {title}
          </Heading>
          <Text tone="muted">{subtitle}</Text>
        </header>
        <div className={styles.room} role="img" aria-label={illustrationLabel}>
          <div className={styles.bar} aria-hidden="true">
            <span className={styles.roomName}>{roomLabel}</span>
            <Badge tone="danger">
              <span className={styles.dot} />
              {liveBadge}
            </Badge>
          </div>
          <ul className={styles.grid} aria-hidden="true">
            {items.map((item) => (
              <li
                key={item.name}
                className={`${styles.item} ${item.status === 'claimed' ? styles.dim : ''}`}
              >
                <div className={styles.art} />
                <p className={styles.name}>{item.name}</p>
                <p className={styles.price}>{item.price}</p>
                <Badge tone={tones[item.status]}>{item.statusLabel}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
