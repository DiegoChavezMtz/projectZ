'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Textarea } from '@/components/atoms/Textarea';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { liveConsoleContent } from '../../content/es-MX';
import styles from './AnnouncementForm.module.css';

const c = liveConsoleContent.announce;

type Props = {
  enabled: boolean;
  busy: boolean;
  /** Devuelve true si el anuncio se publicó (entonces se limpia el campo). */
  onSubmit: (text: string) => Promise<boolean>;
};

/** Anuncio para los compradores (≤ 200 caracteres), solo mientras el evento está en vivo. */
export function AnnouncementForm({ enabled, busy, onSubmit }: Props) {
  const [text, setText] = useState('');
  const trimmed = text.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!enabled || !trimmed || trimmed.length > c.max) return;
    if (await onSubmit(trimmed)) setText('');
  }

  return (
    <form onSubmit={submit} className={styles.root} noValidate>
      <FormField label={c.label} hint={enabled ? undefined : c.disabled}>
        {(control) => (
          <Textarea
            {...control}
            rows={2}
            value={text}
            maxLength={c.max}
            placeholder={c.placeholder}
            disabled={!enabled}
            onChange={(e) => setText(e.target.value)}
          />
        )}
      </FormField>
      <div className={styles.footer}>
        <Text size="sm" tone="muted" aria-hidden="true">
          {c.counter(text.length, c.max)}
        </Text>
        <Button type="submit" disabled={!enabled || !trimmed} loading={busy}>
          {c.submit}
        </Button>
      </div>
    </form>
  );
}
