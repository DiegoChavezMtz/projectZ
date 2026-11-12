import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SellerOrdersView } from '@/features/fulfillment';
import { PendingRatings } from '@/features/reputation';
import type { SearchParamsProps } from '@/types/page';

export const metadata: Metadata = { title: 'Órdenes', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { tab } = await searchParams;
  return (
    <>
      <Suspense fallback={null}>
        <SellerOrdersView tab={typeof tab === 'string' ? tab : undefined} />
      </Suspense>
      <Suspense fallback={null}>
        <PendingRatings next="/dashboard/orders" />
      </Suspense>
    </>
  );
}
