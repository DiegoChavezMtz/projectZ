import { Button } from '@/components/atoms/Button';
import { PieceStack } from '@/components/molecules/PieceStack';
import { landingContent } from '../../content/es-MX';
import { Band } from '../Band';
import { BenefitList } from '../BenefitList';
import { LandingPhoto } from '../LandingPhoto';
import { SectionHeader } from '../SectionHeader';
import styles from './ForBuyers.module.css';

export function ForBuyers() {
  const { id, title, subtitle, benefits, cta } = landingContent.forBuyers;
  const piece = landingContent.preview.items[3];
  return (
    <Band
      id={id}
      color="jade"
      labelledBy={`${id}-title`}
      emits="solo"
      stack={
        <PieceStack
          front={{ media: <LandingPhoto src={piece.photo.src} sizes="190px" /> }}
          state={{ kind: 'sold', label: piece.statusLabel }}
        />
      }
    >
      <SectionHeader id={`${id}-title`} title={title} subtitle={subtitle} />
      <BenefitList items={benefits} />
      <Button href={cta.href} variant="secondary" className={styles.cta}>
        {cta.label}
      </Button>
    </Band>
  );
}
