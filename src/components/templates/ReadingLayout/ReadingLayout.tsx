import type { ReactNode } from 'react';
import { Container } from '../../atoms/Container';
import { Heading } from '../../atoms/Heading';
import { Text } from '../../atoms/Text';
import styles from './ReadingLayout.module.css';

type Props = { title: string; updated?: string; children: ReactNode };

/** Layout de lectura: columna angosta, tipografía cómoda y jerarquía clara (páginas legales y similares). */
export function ReadingLayout({ title, updated, children }: Props) {
  return (
    <Container size="narrow" className={styles.root}>
      <article className={styles.article}>
        <header className={styles.header}>
          <Heading level={1} size="xl">
            {title}
          </Heading>
          {updated ? (
            <Text size="sm" tone="muted">
              {updated}
            </Text>
          ) : null}
        </header>
        <div className={styles.body}>{children}</div>
      </article>
    </Container>
  );
}
