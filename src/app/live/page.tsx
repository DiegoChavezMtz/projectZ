import type { Metadata } from 'next';
import { LiveListView } from '@/features/liveClaim';

export const metadata: Metadata = {
  title: 'Claims en vivo',
  description: 'Los claims que están pasando ahora en Zlotify.',
};

export default function Page() {
  return <LiveListView />;
}
