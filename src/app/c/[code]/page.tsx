import type { Metadata } from 'next';
import { LiveClaimPage, liveClaimMetadata } from '@/features/liveClaim';

// La página lee la sesión y el snapshot en cada petición; se mantiene como ruta que bloquea para responder
// 404 real a códigos desconocidos (ver docs/sprints/06-live-viewer.md, Notas).
export const instant = false;

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return liveClaimMetadata((await params).code);
}

export default async function Page({ params }: Props) {
  return <LiveClaimPage code={(await params).code} />;
}
