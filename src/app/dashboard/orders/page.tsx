import type { Metadata } from 'next';
import { SellerOrdersView } from '@/features/fulfillment';
import type { SearchParamsProps } from '@/types/page';

export const metadata: Metadata = { title: 'Cuentas', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { tab } = await searchParams;
  return <SellerOrdersView tab={typeof tab === 'string' ? tab : undefined} />;
}
