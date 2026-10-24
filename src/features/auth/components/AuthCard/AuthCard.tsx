import type { ReactNode } from 'react';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import styles from './AuthCard.module.css';

type Props = { title: string; subtitle?: string; children: ReactNode };

export function AuthCard({ title, subtitle, children }: Props) {
  return (
    <Container size="narrow" className={styles.root}>
      <Panel tone="raised" className={styles.panel}>
        <header className={styles.header}>
          <Heading level={1} size="xl">
            {title}
          </Heading>
          {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
        </header>
        {children}
      </Panel>
    </Container>
  );
}
