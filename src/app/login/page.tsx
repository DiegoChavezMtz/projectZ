import type { Metadata } from 'next';
import type { SearchParamsProps } from '@/types/page';
import { LoginPage } from '@/features/auth';

export const metadata: Metadata = { title: 'Iniciar sesión', robots: { index: false } };

const one = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

export default async function Page({ searchParams }: SearchParamsProps) {
  const { next, mode, error, reset, signedOut } = await searchParams;
  return (
    <LoginPage
      next={one(next)}
      mode={one(mode)}
      error={one(error)}
      reset={one(reset)}
      signedOut={one(signedOut)}
    />
  );
}
