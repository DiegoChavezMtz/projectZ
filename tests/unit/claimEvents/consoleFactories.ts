import type { ConsoleEntry } from '@/features/claimEvents/types';
export { feedEvent, item, session } from '../liveClaim/factories';

export const consoleEntry = (patch: Partial<ConsoleEntry> = {}): ConsoleEntry => ({
  id: 'entry-1',
  item_id: 'item-1',
  session_id: 'session-1',
  buyer_id: 'buyer-1',
  kind: 'claim',
  amount_cents: 15_000,
  status: 'queued',
  seq: 1,
  created_at: '2026-10-26T10:00:00.000Z',
  resolved_at: null,
  ...patch,
});
