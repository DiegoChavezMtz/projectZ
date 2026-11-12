import type { Metadata } from 'next';
import type { SearchParamsProps } from '@/types/page';
import { TermsPage } from '@/features/auth';

export const metadata: Metadata = { title: 'Acepta los términos', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { next } = await searchParams;
  return <TermsPage next={typeof next === 'string' ? next : undefined} />;
}
