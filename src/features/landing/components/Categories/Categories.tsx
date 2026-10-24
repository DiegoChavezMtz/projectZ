import Image from 'next/image';
import { Badge } from '@/components/atoms/Badge';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import { SectionHeader } from '../SectionHeader';
import styles from './Categories.module.css';

export function Categories() {
  const { id, title, subtitle, tiles, soonLabel, soon } = landingContent.categories;
  return (
    <section id={id} className={styles.root} aria-labelledby={`${id}-title`}>
      <Container>
        <SectionHeader id={`${id}-title`} title={title} subtitle={subtitle} />
        <ul className={styles.tiles}>
          {tiles.map((tile) => (
            <li key={tile.title} className={styles.tile}>
              <Image
                src={tile.photo.src}
                alt={tile.photo.alt}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className={styles.photo}
              />
              <div className={styles.shade} aria-hidden="true" />
              {tile.badge ? (
                <Badge tone="accent" className={styles.badge}>
                  {tile.badge}
                </Badge>
              ) : null}
              <div className={styles.body}>
                <Heading level={3} size="lg">
                  {tile.title}
                </Heading>
                <Text size="sm" tone="muted">
                  {tile.description}
                </Text>
              </div>
            </li>
          ))}
        </ul>
        <div className={styles.soon}>
          <span className={styles.soonLabel}>{soonLabel}</span>
          <ul className={styles.chips}>
            {soon.map((item) => (
              <li key={item} className={styles.chip}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
