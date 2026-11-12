import Image from 'next/image';
import { Badge } from '@/components/atoms/Badge';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { PieceStack } from '@/components/molecules/PieceStack';
import { landingContent } from '../../content/es-MX';
import { Band } from '../Band';
import { LandingPhoto } from '../LandingPhoto';
import { SectionHeader } from '../SectionHeader';
import styles from './Categories.module.css';

export function Categories() {
  const { id, title, subtitle, tiles, soonLabel, soon } = landingContent.categories;
  const sold = landingContent.preview.items[3];
  return (
    <Band
      id={id}
      color="jade"
      labelledBy={`${id}-title`}
      emits="solo"
      stack={
        <PieceStack
          left
          front={{ media: <LandingPhoto src={sold.photo.src} sizes="190px" /> }}
          state={{ kind: 'sold', label: sold.statusLabel }}
        />
      }
    >
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
              <Heading level={3} size="lg" className={styles.tileTitle}>
                {tile.title}
              </Heading>
              <Text size="sm" className={styles.tileText}>
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
    </Band>
  );
}
