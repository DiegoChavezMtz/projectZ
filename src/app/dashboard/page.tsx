import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SellerDashboardView } from '@/features/auth';
import { ClaimSummary } from '@/features/claimEvents';
import { OrdersSummary } from '@/features/fulfillment';

export const metadata: Metadata = { title: 'Resumen', robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SellerDashboardView>
        <Suspense fallback={null}>
          <ClaimSummary />
        </Suspense>
        <Suspense fallback={null}>
          <OrdersSummary />
        </Suspense>
      </SellerDashboardView>
    </Suspense>
  );
}
