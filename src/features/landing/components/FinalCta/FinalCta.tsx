import Image from 'next/image';
import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import styles from './FinalCta.module.css';

export function FinalCta() {
  const { title, subtitle, cta, secondaryCta, photo } = landingContent.finalCta;
  return (
    <section className={styles.root} aria-labelledby="final-cta-title">
      <Container>
        <div className={styles.inner}>
          <Image src={photo.src} alt="" fill sizes="100vw" className={styles.photo} />
          <div className={styles.shade} aria-hidden="true" />
          <div className={styles.content}>
            <Heading level={2} id="final-cta-title" className={styles.title}>
              {title}
            </Heading>
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
        </div>
      </Container>
    </section>
  );
}
