import type { Metadata } from 'next';
import { OrderDetailView } from '@/features/fulfillment';

export const metadata: Metadata = { title: 'Cuenta', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailView orderId={id} />;
}
