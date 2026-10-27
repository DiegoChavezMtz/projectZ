import type { Metadata } from 'next';
import { PaymentInstructionsView } from '@/features/fulfillment';

export const metadata: Metadata = { title: 'Datos de pago', robots: { index: false } };

export default function Page() {
  return <PaymentInstructionsView />;
}
