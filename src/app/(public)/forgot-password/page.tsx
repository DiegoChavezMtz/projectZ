import type { Metadata } from 'next';
import type { SearchParamsProps } from '@/types/page';
import { ForgotPasswordPage } from '@/features/auth';

export const metadata: Metadata = { title: 'Recuperar contraseña', robots: { index: false } };

export default async function Page({ searchParams }: SearchParamsProps) {
  const { error } = await searchParams;
  return <ForgotPasswordPage expired={error === 'expired'} />;
}
