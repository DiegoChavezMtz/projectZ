import clsx from 'clsx';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import { SectionHeader } from '../SectionHeader';
import styles from './Pricing.module.css';

export function Pricing() {
  const { id, title, subtitle, trial, plans, buyerNote, footnote } = landingContent.pricing;
  return (
    <section id={id} className={styles.root} aria-labelledby={`${id}-title`}>
      <Container>
        <SectionHeader id={`${id}-title`} title={title} subtitle={subtitle} />
        <p className={styles.trial}>
          <Badge tone="success">{trial.title}</Badge>
          <span>{trial.description}</span>
        </p>
        <div className={styles.plans}>
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={clsx(styles.plan, plan.highlighted && styles.highlighted)}
              aria-labelledby={`plan-${plan.id}`}
            >
              {plan.badge ? (
                <Badge tone="accent" className={styles.planBadge}>
                  {plan.badge}
                </Badge>
              ) : null}
              <Heading level={3} size="lg" id={`plan-${plan.id}`}>
                {plan.name}
              </Heading>
              <Text tone="muted" size="sm">
                {plan.tagline}
              </Text>
              <p className={styles.priceRow}>
                <span className={styles.price}>{plan.price}</span>
                <span className={styles.period}>{plan.period}</span>
              </p>
              <ul className={styles.features}>
                {plan.features.map((feature) => (
                  <li key={feature} className={styles.feature}>
                    <Icon name="check" className={styles.check} />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                href={plan.cta.href}
                variant={plan.highlighted ? 'primary' : 'secondary'}
                size="lg"
                fullWidth
              >
                {plan.cta.label}
              </Button>
            </article>
          ))}
        </div>
        <div className={styles.buyer}>
          <Heading level={3} size="md">
            {buyerNote.title}
          </Heading>
          <Text tone="muted" size="sm">
            {buyerNote.description}
          </Text>
        </div>
        <Text size="sm" tone="muted" className={styles.footnote}>
          {footnote}
        </Text>
      </Container>
    </section>
  );
}
