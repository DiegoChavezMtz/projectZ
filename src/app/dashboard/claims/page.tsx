import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClaimsListView } from '@/features/claimEvents';
import type { SearchParamsProps } from '@/types/page';

export const metadata: Metadata = { title: 'Claims', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { status } = await searchParams;
  return (
    <Suspense fallback={null}>
      <ClaimsListView status={typeof status === 'string' ? status : undefined} />
    </Suspense>
  );
}
