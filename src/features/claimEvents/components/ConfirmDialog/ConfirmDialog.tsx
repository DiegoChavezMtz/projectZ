'use client';

import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { Dialog } from '@/components/molecules/Dialog';
import { liveConsoleContent } from '../../content/es-MX';
import styles from './ConfirmDialog.module.css';

type Props = {
  open: boolean;
  title: string;
  text: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
};

/** Confirmación rápida de una acción que no se puede deshacer. Botones grandes para usarse con una mano. */
export function ConfirmDialog({ open, title, text, confirmLabel, onConfirm, onClose }: Props) {
  const c = liveConsoleContent.header;
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <Text>{text}</Text>
      <div className={styles.actions}>
        <Button
          onClick={() => {
            onClose();
            onConfirm();
          }}
          fullWidth
        >
          {confirmLabel ?? c.confirm}
        </Button>
        <Button variant="secondary" onClick={onClose} fullWidth>
          {c.cancel}
        </Button>
      </div>
    </Dialog>
  );
}
