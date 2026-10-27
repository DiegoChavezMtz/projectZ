'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { FormField } from '@/components/molecules/FormField';
import { Panel } from '@/components/molecules/Panel';
import type { ClaimSession } from '@/types/claims';
import { formatDateTime, isoToMexicoLocal, mexicoLocalToIso } from '@/utils/dates';
import { liveConsoleContent } from '../../content/es-MX';
import { ConfirmDialog } from '../ConfirmDialog';
import { StatusBadge } from '../StatusBadge';
import styles from './ConsoleHeader.module.css';

const c = liveConsoleContent;

type Props = {
  session: ClaimSession;
  itemCount: number;
  nounPlural: string;
  busy: boolean;
  /** Hora del servidor aproximada, para validar el cierre antes de enviarlo. */
  now: () => number;
  onStart: () => void;
  onEnd: () => void;
  onExtend: (closesAtIso: string) => void;
};

/** Estado del evento, iniciar/terminar con confirmación y extensión del cierre (S7-02, S7-09). */
export function ConsoleHeader({
  session,
  itemCount,
  nounPlural,
  busy,
  now,
  onStart,
  onEnd,
  onExtend,
}: Props) {
  const [dialog, setDialog] = useState<'start' | 'end' | 'extend' | null>(null);
  const [closeLocal, setCloseLocal] = useState('');
  const [closeError, setCloseError] = useState<string | undefined>();
  const { status } = session;

  const when =
    status === 'live' && session.started_at
      ? c.header.startedAt(formatDateTime(session.started_at))
      : c.header.startsAt(formatDateTime(session.starts_at));

  function submitClose(event: FormEvent) {
    event.preventDefault();
    const iso = mexicoLocalToIso(closeLocal);
    if (!iso) return setCloseError(c.close.invalid);
    const earliest = Math.max(now(), session.closes_at ? Date.parse(session.closes_at) : 0);
    if (Date.parse(iso) <= earliest) return setCloseError(c.close.notLater);
    setCloseError(undefined);
    setDialog('extend');
  }

  const closeIso = mexicoLocalToIso(closeLocal);

  return (
    <header className={styles.root}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <Heading level={1} size="xl">
            {session.title}
          </Heading>
          <Text size="sm" tone="muted">
            {when}
          </Text>
          <Text size="sm" tone="muted">
            {session.closes_at
              ? c.header.closesAt(formatDateTime(session.closes_at))
              : c.header.noClose}
          </Text>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className={styles.actions}>
        {status === 'scheduled' ? (
          <Button onClick={() => setDialog('start')} loading={busy} disabled={itemCount === 0}>
            {c.header.start}
          </Button>
        ) : null}
        {status === 'live' ? (
          <Button variant="secondary" onClick={() => setDialog('end')} loading={busy}>
            {c.header.end}
          </Button>
        ) : null}
        <Button
          href={`/c/${session.code}`}
          variant="ghost"
          size="sm"
          target="_blank"
          rel="noreferrer"
        >
          {c.viewPublic}
        </Button>
      </div>

      {status === 'live' || status === 'scheduled' ? (
        <Panel className={styles.extend}>
          <form onSubmit={submitClose} className={styles.form} noValidate>
            <FormField label={c.close.label} hint={c.close.hint} error={closeError}>
              {(control) => (
                <Input
                  {...control}
                  type="datetime-local"
                  value={closeLocal}
                  min={session.closes_at ? isoToMexicoLocal(session.closes_at) : undefined}
                  onChange={(e) => setCloseLocal(e.target.value)}
                />
              )}
            </FormField>
            <Button type="submit" variant="secondary" disabled={!closeLocal || busy}>
              {c.close.submit}
            </Button>
          </form>
        </Panel>
      ) : null}

      <ConfirmDialog
        open={dialog === 'start'}
        title={c.header.confirmStartTitle}
        text={c.header.confirmStartText(itemCount, nounPlural, session.release_mode === 'manual')}
        onConfirm={onStart}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'end'}
        title={c.header.confirmEndTitle}
        text={c.header.confirmEndText}
        onConfirm={onEnd}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'extend'}
        title={c.close.confirmTitle}
        text={closeIso ? c.close.confirmText(formatDateTime(closeIso)) : ''}
        onConfirm={() => {
          if (closeIso) onExtend(closeIso);
          setCloseLocal('');
        }}
        onClose={() => setDialog(null)}
      />
    </header>
  );
}
