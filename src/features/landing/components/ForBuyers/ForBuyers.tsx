import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { landingContent } from '../../content/es-MX';
import { BenefitList } from '../BenefitList';
import styles from './ForBuyers.module.css';

export function ForBuyers() {
  const { id, title, subtitle, benefits, cta } = landingContent.forBuyers;
  return (
    <Panel as="article" id={id} className={styles.root} aria-labelledby={`${id}-title`}>
      <Heading level={2} size="lg" id={`${id}-title`}>
        {title}
      </Heading>
      <Text tone="muted" className={styles.subtitle}>
        {subtitle}
      </Text>
      <BenefitList items={benefits} />
      <Button href={cta.href} variant="secondary" className={styles.cta}>
        {cta.label}
      </Button>
    </Panel>
  );
}
