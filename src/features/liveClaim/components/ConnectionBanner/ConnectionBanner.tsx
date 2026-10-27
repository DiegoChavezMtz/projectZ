import type { ConnectionStatus } from '../../types';
import { liveClaimContent } from '../../content/es-MX';
import styles from './ConnectionBanner.module.css';

const c = liveClaimContent.connection;

/** Aviso discreto: no se muestra cuando todo va bien. */
export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === 'online' || status === 'connecting') return <div role="status" />;
  return (
    <div role="status" className={styles.root} data-status={status}>
      {status === 'offline' ? c.offline : c.reconnecting}
    </div>
  );
}
