import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ShopSettingsView } from '@/features/auth';
import { PaymentInstructionsView } from '@/features/fulfillment';

export const metadata: Metadata = { title: 'Ajustes de la tienda', robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ShopSettingsView>
        <PaymentInstructionsView />
      </ShopSettingsView>
    </Suspense>
  );
}
