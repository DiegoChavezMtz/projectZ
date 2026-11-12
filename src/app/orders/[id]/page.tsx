import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrderDetailView } from '@/features/fulfillment';
import { PendingRatings } from '@/features/reputation';

export const metadata: Metadata = { title: 'Cuenta', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <OrderDetailView orderId={id} />
      <Suspense fallback={null}>
        <PendingRatings next={`/orders/${id}`} orderId={id} />
      </Suspense>
    </>
  );
}
