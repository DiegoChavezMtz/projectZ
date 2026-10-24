import { Container } from '@/components/atoms/Container';
import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import styles from './Promises.module.css';

export function Promises() {
  const { label, items } = landingContent.promises;
  return (
    <section className={styles.root} aria-label={label}>
      <Container>
        <ul className={styles.band}>
          {items.map((item) => (
            <li key={item.title} className={styles.item}>
              <p className={styles.value}>{item.value}</p>
              <p className={styles.title}>{item.title}</p>
              <Text size="sm" tone="muted">
                {item.description}
              </Text>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
