import type { Metadata } from 'next';
import { SellerOnboardingPage } from '@/features/auth';

export const metadata: Metadata = { title: 'Empieza a vender', robots: { index: false } };

export default function Page() {
  return <SellerOnboardingPage />;
}
