import type { Metadata } from 'next';
import { PublicProfileView, publicProfileMetadata } from '@/features/reputation';

// Lee datos públicos en cada petición; ruta que bloquea para responder 404 real a handles inexistentes.
export const instant = false;

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ role?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return publicProfileMetadata(decodeURIComponent((await params).handle));
}

export default async function Page({ params, searchParams }: Props) {
  const { handle } = await params;
  const { role, page } = await searchParams;
  return (
    <PublicProfileView
      handle={decodeURIComponent(handle)}
      role={role === 'buyer' || role === 'seller' ? role : undefined}
      page={Number(page) > 0 ? Math.floor(Number(page)) : 1}
    />
  );
}
