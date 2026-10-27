import type { Metadata } from 'next';
import { LiveConsolePage } from '@/features/claimEvents';

export const metadata: Metadata = { title: 'Consola en vivo', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveConsolePage id={id} />;
}
