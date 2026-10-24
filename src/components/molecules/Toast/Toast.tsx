'use client';

import { common } from '@/content/es-MX';
import { Icon } from '../../atoms/Icon';
import styles from './Toast.module.css';

export type ToastTone = 'info' | 'success' | 'danger';
export type ToastItem = { id: string; message: string; tone: ToastTone };

type Props = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

/** Región `aria-live` siempre montada para que los lectores anuncien cada aviso nuevo. */
export function ToastViewport({ toasts, onDismiss }: Props) {
  return (
    <div className={styles.viewport} role="region" aria-label={common.toast.region}>
      <div aria-live="polite" aria-atomic="false" className={styles.list}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`} role="status">
            <span className={styles.message}>{toast.message}</span>
            <button
              type="button"
              className={styles.dismiss}
              onClick={() => onDismiss(toast.id)}
              aria-label={common.a11y.close}
            >
              <Icon name="close" size="1em" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
