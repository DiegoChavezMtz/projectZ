'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { liveClaimContent } from '../../content/es-MX';
import { readHowItWorksDismissed, writeHowItWorksDismissed } from '../../utils/howItWorks';
import styles from './HowItWorksPanel.module.css';

const c = liveClaimContent.howItWorks;

/**
 * Panel breve y descartable para quien llega por primera vez. Va en el flujo de la página (no
 * flota ni tapa las acciones). El descarte se recuerda en el navegador, si se puede.
 */
export function HowItWorksPanel({ showGuardadito }: { showGuardadito: boolean }) {
  // `null` hasta leer el almacenamiento: así no hay parpadeo ni diferencias con el HTML del servidor.
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    // Lectura única de un dato del navegador al montar (no existe en el servidor).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(!readHowItWorksDismissed());
  }, []);

  function dismiss() {
    writeHowItWorksDismissed();
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') dismiss();
  }

  if (open === null) return null;

  if (!open) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-expanded={false}>
          {c.reopen}
        </Button>
      </div>
    );
  }

  const extra = showGuardadito ? [...c.extra, c.guardadito] : c.extra;
  return (
    <section className={styles.root} aria-labelledby="how-it-works-title" onKeyDown={onKeyDown}>
      <header className={styles.header}>
        <Heading level={2} size="lg" id="how-it-works-title">
          {c.title}
        </Heading>
        <Text tone="muted" size="sm">
          {c.subtitle}
        </Text>
      </header>
      <div className={styles.blocks}>
        {c.blocks.map((block) => (
          <div key={block.title}>
            <Heading level={3} size="sm">
              {block.title}
            </Heading>
            <Text size="sm" tone="muted">
              {block.body}
            </Text>
          </div>
        ))}
      </div>
      <details className={styles.more}>
        <summary>{c.more}</summary>
        <div className={styles.blocks}>
          {extra.map((block) => (
            <div key={block.title}>
              <Heading level={3} size="sm">
                {block.title}
              </Heading>
              <Text size="sm" tone="muted">
                {block.body}
              </Text>
            </div>
          ))}
        </div>
      </details>
      <div>
        <Button size="sm" onClick={dismiss}>
          {c.dismiss}
        </Button>
      </div>
    </section>
  );
}
