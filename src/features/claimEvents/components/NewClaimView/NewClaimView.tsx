import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { claimEventsContent } from '../../content/es-MX';
import { SessionForm } from '../SessionForm';
import styles from '../EditClaimView/EditClaimView.module.css';

export function NewClaimView() {
  return (
    <Container size="narrow" className={styles.root}>
      <header className={styles.header}>
        <Heading level={1} size="xl">
          {claimEventsContent.form.createTitle}
        </Heading>
        <Text tone="muted">{claimEventsContent.list.subtitle}</Text>
      </header>
      <SessionForm />
    </Container>
  );
}
