import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrdersListView } from '@/features/fulfillment';
import { PendingRatings } from '@/features/reputation';

export const metadata: Metadata = { title: 'Por pagar y enviar', robots: { index: false } };

export default function Page() {
  return (
    <>
      <Suspense fallback={null}>
        <OrdersListView />
      </Suspense>
      <Suspense fallback={null}>
        <PendingRatings next="/orders" />
      </Suspense>
    </>
  );
}
