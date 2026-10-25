import { Badge } from '@/components/atoms/Badge';
import type { SessionStatus } from '@/types/claims';
import { claimEventsContent } from '../content/es-MX';

const tones = {
  draft: 'neutral',
  scheduled: 'info',
  live: 'success',
  ended: 'neutral',
  cancelled: 'danger',
} as const;

export function StatusBadge({ status }: { status: SessionStatus }) {
  return <Badge tone={tones[status]}>{claimEventsContent.status[status] ?? status}</Badge>;
}
