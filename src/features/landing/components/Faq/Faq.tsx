import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Icon } from '@/components/atoms/Icon';
import { landingContent } from '../../content/es-MX';
import styles from './Faq.module.css';

/** Acordeón con `<details>`: teclado y estado expandido nativos, sin JS. */
export function Faq() {
  const { id, title, items } = landingContent.faq;
  return (
    <section id={id} className={styles.root} aria-labelledby={`${id}-title`}>
      <Container size="narrow">
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
      </Container>
    </section>
  );
}
