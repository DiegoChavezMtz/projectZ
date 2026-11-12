import type { Metadata } from 'next';
import { ScannerPage } from '@/features/claimEvents';

export const metadata: Metadata = { title: 'Modo escáner', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ScannerPage id={id} />;
}
