import { Badge } from '@/components/atoms/Badge';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import styles from './SectionHeader.module.css';

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  eyebrow?: string;
};

export function SectionHeader({ id, title, subtitle, eyebrow }: Props) {
  return (
    <header className={styles.root}>
      {eyebrow ? <Badge tone="accent">{eyebrow}</Badge> : null}
      <Heading level={2} size="display" id={id} className={styles.title}>
        {title}
      </Heading>
      {subtitle ? (
        <Text tone="muted" size="lg" className={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
    </header>
  );
}
