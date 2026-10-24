import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import { HeroPhone } from '../HeroPhone';
import styles from './Hero.module.css';

export function Hero() {
  const { eyebrow, titleLead, titleAccent, subtitle, primaryCta, secondaryCta, proof } =
    landingContent.hero;
  return (
    <section className={styles.root} aria-labelledby="hero-title">
      <Container className={styles.inner}>
        <div className={styles.copy}>
          <Badge tone="accent">{eyebrow}</Badge>
          <Heading level={1} id="hero-title" className={styles.title}>
            {titleLead} <span className={styles.accent}>{titleAccent}</span>
          </Heading>
          <Text size="lg" tone="muted" className={styles.subtitle}>
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
        <HeroPhone />
      </Container>
    </section>
  );
}
