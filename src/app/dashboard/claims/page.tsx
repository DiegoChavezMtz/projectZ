import type { Metadata } from 'next';
import { ClaimsListView } from '@/features/claimEvents';
import type { SearchParamsProps } from '@/types/page';

export const metadata: Metadata = { title: 'Tus claims', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { status } = await searchParams;
  return <ClaimsListView status={typeof status === 'string' ? status : undefined} />;
}
