import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import styles from './BenefitList.module.css';

type Props = { items: ReadonlyArray<{ icon: IconName; title: string; description: string }> };

export function BenefitList({ items }: Props) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.title} className={styles.item}>
          <span className={styles.icon}>
            <Icon name={item.icon} size="1.25rem" />
          </span>
          <div>
            <p className={styles.title}>{item.title}</p>
            <Text tone="muted" size="sm">
              {item.description}
            </Text>
          </div>
        </li>
      ))}
    </ul>
  );
}
