import type { Metadata } from 'next';
import { OrdersListView } from '@/features/fulfillment';

export const metadata: Metadata = { title: 'Mis cuentas', robots: { index: false } };

export default function Page() {
  return <OrdersListView />;
}
