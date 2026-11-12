import { Heading } from '@/components/atoms/Heading';
import { Icon } from '@/components/atoms/Icon';
import { landingContent } from '../../content/es-MX';
import { Band } from '../Band';
import styles from './Faq.module.css';

/** Acordeón con `<details>`: teclado y estado expandido nativos, sin JS. */
export function Faq() {
  const { id, title, items } = landingContent.faq;
  return (
    <Band id={id} color="dark" labelledBy={`${id}-title`} size="narrow" receives="stack">
      <Heading level={2} id={`${id}-title`} className={styles.title}>
        {title}
      </Heading>
      <div className={styles.list}>
        {items.map((item) => (
          <details key={item.question} className={styles.item}>
            <summary className={styles.summary}>
              <span>{item.question}</span>
              <Icon name="chevronDown" className={styles.chevron} />
            </summary>
            <p className={styles.answer}>{item.answer}</p>
          </details>
        ))}
      </div>
    </Band>
  );
}
