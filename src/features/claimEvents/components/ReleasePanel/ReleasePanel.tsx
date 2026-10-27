'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import type { ClaimItem } from '@/types/claims';
import { liveConsoleContent } from '../../content/es-MX';
import { ConfirmDialog } from '../ConfirmDialog';
import styles from './ReleasePanel.module.css';

const c = liveConsoleContent.release;

type Props = {
  hiddenCount: number;
  next: ClaimItem | null;
  noun: { singular: string; plural: string };
  busy: boolean;
  onReleaseNext: (item: ClaimItem) => void;
  onReleaseAll: () => void;
};

/** Liberación manual (`release_mode = 'manual'`): una por una, con sugerencia de la siguiente, o todas. */
export function ReleasePanel({
  hiddenCount,
  next,
  noun,
  busy,
  onReleaseNext,
  onReleaseAll,
}: Props) {
  const [confirmAll, setConfirmAll] = useState(false);
  return (
    <Panel className={styles.root}>
      <Heading level={2} size="md">
        {c.heading}
      </Heading>
      <Text size="sm" tone="muted">
        {c.hiddenCount(hiddenCount, noun.plural)}
      </Text>
      {next ? (
        <>
          <Text size="sm">{c.next(next.title)}</Text>
          <div className={styles.buttons}>
            <Button loading={busy} onClick={() => onReleaseNext(next)}>
              {c.releaseNext}
            </Button>
            {hiddenCount > 1 ? (
              <Button variant="secondary" disabled={busy} onClick={() => setConfirmAll(true)}>
                {c.releaseAll}
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
      <ConfirmDialog
        open={confirmAll}
        title={c.confirmAllTitle}
        text={c.confirmAllText(hiddenCount, noun.plural)}
        onConfirm={onReleaseAll}
        onClose={() => setConfirmAll(false)}
      />
    </Panel>
  );
}
