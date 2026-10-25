import type { Metadata } from 'next';
import { PreviewClaimView } from '@/features/claimEvents';

export const metadata: Metadata = { title: 'Vista previa', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PreviewClaimView id={id} />;
}
