import type { Metadata } from 'next';
import type { SearchParamsProps } from '@/types/page';
import { SecurityView } from '@/features/auth';

export const metadata: Metadata = { title: 'Seguridad', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { email } = await searchParams;
  return <SecurityView emailChanged={email === 'changed'} />;
}
