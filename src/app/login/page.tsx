import type { Metadata } from 'next';
import type { SearchParamsProps } from '@/types/page';
import { LoginPage } from '@/features/auth';

export const metadata: Metadata = { title: 'Iniciar sesión', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { next } = await searchParams;
  return <LoginPage next={typeof next === 'string' ? next : undefined} />;
}
