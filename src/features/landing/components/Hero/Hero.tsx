import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import styles from './Hero.module.css';

export function Hero() {
  const { eyebrow, title, subtitle, primaryCta, secondaryCta } = landingContent.hero;
  return (
    <section className={styles.root} aria-labelledby="hero-title">
      <Container size="narrow" className={styles.inner}>
        <Badge tone="accent">{eyebrow}</Badge>
        <Heading level={1} id="hero-title">
          {title}
        </Heading>
        <Text size="lg" tone="muted">
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
      </Container>
    </section>
  );
}
