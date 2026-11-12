import type { Metadata } from 'next';
import type { SearchParamsProps } from '@/types/page';
import { VerifyEmailPage } from '@/features/auth';

export const metadata: Metadata = { title: 'Verifica tu correo', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { email, next } = await searchParams;
  return (
    <VerifyEmailPage
      email={typeof email === 'string' ? email : undefined}
      next={typeof next === 'string' ? next : undefined}
    />
  );
}
