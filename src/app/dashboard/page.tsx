import type { Metadata } from 'next';
import { SellerDashboardView } from '@/features/auth';

export const metadata: Metadata = { title: 'Tu tienda', robots: { index: false } };

export default function Page() {
  return <SellerDashboardView />;
}
