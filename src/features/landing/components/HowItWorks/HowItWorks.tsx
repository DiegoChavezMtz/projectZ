import { Heading } from '@/components/atoms/Heading';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import { Band } from '../Band';
import { SectionHeader } from '../SectionHeader';
import styles from './HowItWorks.module.css';

export function HowItWorks() {
  const { id, title, subtitle, steps } = landingContent.howItWorks;
  return (
    <Band id={id} color="orange" labelledBy={`${id}-title`} receives="solo">
      <SectionHeader id={`${id}-title`} title={title} subtitle={subtitle} />
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.number} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
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
    </Band>
  );
}
