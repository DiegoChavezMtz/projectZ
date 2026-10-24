import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import { SectionHeader } from '../SectionHeader';
import styles from './HowItWorks.module.css';

export function HowItWorks() {
  const { id, title, subtitle, steps } = landingContent.howItWorks;
  return (
    <section id={id} className={styles.root} aria-labelledby={`${id}-title`}>
      <Container>
        <SectionHeader id={`${id}-title`} title={title} subtitle={subtitle} />
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.icon}>
                <Icon name={step.icon} size="1.5rem" />
              </span>
              <Heading level={3} size="md">
                {step.title}
              </Heading>
              <Text tone="muted" size="sm">
                {step.description}
              </Text>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
