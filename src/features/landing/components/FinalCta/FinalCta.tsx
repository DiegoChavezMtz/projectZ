import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import styles from './FinalCta.module.css';

export function FinalCta() {
  const { title, subtitle, cta } = landingContent.finalCta;
  return (
    <section className={styles.root} aria-labelledby="final-cta-title">
      <Container size="narrow" className={styles.inner}>
        <Heading level={2} id="final-cta-title">
          {title}
        </Heading>
        <Text tone="muted" size="lg">
          {subtitle}
        </Text>
        <Button href={cta.href} size="lg">
          {cta.label}
        </Button>
      </Container>
    </section>
  );
}
