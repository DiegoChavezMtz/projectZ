import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import { Band } from '../Band';
import styles from './FinalCta.module.css';

export function FinalCta() {
  const { title, subtitle, cta, secondaryCta } = landingContent.finalCta;
  return (
    <Band color="pink" labelledBy="final-cta-title" className={styles.root}>
      <div className={styles.content}>
        <h2 id="final-cta-title" className={styles.title}>
          {title}
        </h2>
        <Text size="lg" className={styles.subtitle}>
          {subtitle}
        </Text>
        <div className={styles.actions}>
          <Button href={cta.href} size="lg">
            {cta.label}
          </Button>
          <Button href={secondaryCta.href} variant="secondary" size="lg">
            {secondaryCta.label}
          </Button>
        </div>
      </div>
    </Band>
  );
}
