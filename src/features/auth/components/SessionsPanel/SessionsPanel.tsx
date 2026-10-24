'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Dialog } from '@/components/molecules/Dialog';
import { authContent } from '../../content/es-MX';
import { signOutEverywhereAction } from '../../services/account.actions';
import styles from '../AuthForm.module.css';

const c = authContent.security.sessions;

/** A6: cerrar sesión en todos los dispositivos, con confirmación. */
export function SessionsPanel() {
  const [open, setOpen] = useState(false);
  return (
    <section className={styles.section} aria-labelledby="sessions-title">
      <Heading level={2} size="lg" id="sessions-title">
        {c.title}
      </Heading>
      <Text tone="muted">{c.description}</Text>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {c.action}
        </Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={c.confirmTitle}>
        <form action={signOutEverywhereAction} className={styles.section}>
          <Text>{c.confirmText}</Text>
          <div className={styles.actions}>
            <Button type="submit">{c.confirm}</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {c.cancel}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
