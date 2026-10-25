import type { Metadata } from 'next';
import { NewClaimView } from '@/features/claimEvents';

export const metadata: Metadata = { title: 'Nuevo claim', robots: { index: false } };

export default function Page() {
  return <NewClaimView />;
}
