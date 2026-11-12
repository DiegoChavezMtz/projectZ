import { Text } from '@/components/atoms/Text';
import { landingContent } from '../../content/es-MX';
import { Band } from '../Band';
import styles from './Promises.module.css';

export function Promises() {
  const { label, items } = landingContent.promises;
  return (
    <Band color="dark" label={label} receives="hero" className={styles.root}>
      <ul className={styles.list}>
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
    </Band>
  );
}
