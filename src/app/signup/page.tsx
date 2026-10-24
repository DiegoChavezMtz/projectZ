import type { Metadata } from 'next';
import type { SearchParamsProps } from '@/types/page';
import { SignupPage } from '@/features/auth';

export const metadata: Metadata = { title: 'Crear cuenta', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { next } = await searchParams;
  return <SignupPage next={typeof next === 'string' ? next : undefined} />;
}
