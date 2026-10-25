'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import type { ClaimItem, ClaimSession } from '@/types/claims';
import { formatDateTime } from '@/utils/dates';
import { claimEventsContent } from '../../content/es-MX';
import { publishSessionAction } from '../../services/claimEvents.actions';
import { initialActionState } from '../../types';
import { canPublish, publicSessionPath } from '../../utils/session.utils';
import styles from './PublishPanel.module.css';

const c = claimEventsContent.publish;

type Props = {
  session: Pick<ClaimSession, 'id' | 'status' | 'starts_at' | 'code'>;
  items: Pick<ClaimItem, 'price_cents' | 'image_path'>[];
  /** Origen del sitio (para mostrar el enlace completo). */
  siteUrl: string;
};

/** S4-12: botón "Publicar" gobernado por `canPublish`; tras publicar, enlace público con botón de copiar. */
export function PublishPanel({ session, items, siteUrl }: Props) {
  const [state, action, pending] = useActionState(publishSessionAction, initialActionState);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);

  const code = state.publicCode ?? (session.status === 'draft' ? null : session.code);
  const check = canPublish(session, items);
  const reasons = state.status === 'error' && state.reasons?.length ? state.reasons : check.reasons;

  if (code) {
    const path = publicSessionPath(code);
    const url = `${siteUrl.replace(/\/$/, '')}${path}`;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied('ok');
      } catch {
        setCopied('failed');
      }
    };
    return (
      <Panel tone="raised" className={styles.root} aria-labelledby="publish-heading">
        <Heading level={2} size="lg" id="publish-heading">
          {c.publishedTitle}
        </Heading>
        <Text tone="muted">{c.scheduledOn(formatDateTime(session.starts_at))}</Text>
        <div className={styles.share}>
          <label className={styles.label} htmlFor="public-url">
            {c.shareLabel}
          </label>
          <div className={styles.copyRow}>
            <Input id="public-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="secondary" onClick={copy}>
              {c.copy}
            </Button>
          </div>
          <div aria-live="polite">
            {copied === 'ok' ? (
              <Text size="sm" role="status">
                {c.copied}
              </Text>
            ) : null}
            {copied === 'failed' ? (
              <Text size="sm" tone="danger" role="alert">
                {c.copyFailed}
              </Text>
            ) : null}
          </div>
        </div>
        <Button href={`/dashboard/claims/${session.id}/preview`} variant="ghost" size="sm">
          {c.previewLink}
        </Button>
      </Panel>
    );
  }

  return (
    <Panel tone="raised" className={styles.root} aria-labelledby="publish-heading">
      <Heading level={2} size="lg" id="publish-heading">
        {c.title}
      </Heading>
      <Text tone="muted">{c.intro}</Text>
      {reasons.length > 0 ? (
        <div role={state.status === 'error' ? 'alert' : 'status'}>
          <Text size="sm">{c.blocked}</Text>
          <ul className={styles.reasons}>
            {reasons.map((reason) => (
              <li key={reason}>{claimEventsContent.publishReasons[reason] ?? reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.status === 'error' && !state.reasons?.length ? (
        <Text tone="danger" role="alert">
          {claimEventsContent.errors[state.code ?? 'unknown'] ?? claimEventsContent.errors.unknown}
        </Text>
      ) : null}
      <form action={action} className={styles.actions}>
        <input type="hidden" name="id" value={session.id} />
        <Button type="submit" loading={pending} disabled={!check.ok}>
          {c.button}
        </Button>
        <Button href={`/dashboard/claims/${session.id}/preview`} variant="ghost">
          {c.previewLink}
        </Button>
      </form>
    </Panel>
  );
}
