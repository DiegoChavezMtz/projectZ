import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import { Band } from '../Band';
import { HeroStack } from '../HeroStack';
import styles from './Hero.module.css';

export function Hero() {
  const { eyebrow, titleLead, titleAccent, subtitle, primaryCta, secondaryCta, proof } =
    landingContent.hero;
  return (
    <Band color="orange" labelledBy="hero-title" className={styles.root}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <Badge tone="accent">{eyebrow}</Badge>
          <h1 id="hero-title" className={styles.title}>
            {titleLead} <span className={styles.accent}>{titleAccent}</span>
          </h1>
          <Text size="lg" className={styles.subtitle}>
            {subtitle}
          </Text>
          <div className={styles.actions}>
            <Button href={primaryCta.href} size="lg">
              {primaryCta.label}
            </Button>
            <Button href={secondaryCta.href} variant="secondary" size="lg">
              {secondaryCta.label}
            </Button>
          </div>
          <ul className={styles.proof}>
            {proof.map((item) => (
              <li key={item} className={styles.proofItem}>
                <Icon name="check" className={styles.check} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <HeroStack />
      </div>
    </Band>
  );
}
