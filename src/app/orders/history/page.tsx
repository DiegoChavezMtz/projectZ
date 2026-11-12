import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrdersListView } from '@/features/fulfillment';

export const metadata: Metadata = { title: 'Historial', robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrdersListView view="history" />
    </Suspense>
  );
}
