import type { Metadata } from 'next';
import { EditClaimView } from '@/features/claimEvents';
import { getSiteUrl } from '@/utils/site';

export const metadata: Metadata = { title: 'Editar claim', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditClaimView id={id} siteUrl={getSiteUrl()} />;
}
