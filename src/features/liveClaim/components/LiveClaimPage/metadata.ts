import 'server-only';
import type { Metadata } from 'next';
import { publicEnv } from '@/lib/env.public';
import { formatDateTime } from '@/utils/dates';
import { itemImageUrl } from '@/utils/image';
import { liveClaimContent } from '../../content/es-MX';
import { sessionPath } from '../../utils/session';
import { loadLive } from './loadLive';

const m = liveClaimContent.meta;

/** Título, descripción e imagen OG (primer artículo con foto) del evento. */
export async function liveClaimMetadata(code: string): Promise<Metadata> {
  const { snapshot } = await loadLive(code);
  if (!snapshot) return { title: m.notFoundTitle, robots: { index: false } };

  const { session, items, seller } = snapshot;
  const description =
    session.status === 'live'
      ? m.liveDescription(seller.shopName)
      : session.status === 'ended'
        ? m.endedDescription(seller.shopName)
        : m.description(seller.shopName, formatDateTime(session.starts_at));
  const image = items
    .map((item) => itemImageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, item.image_path))
    .find((url): url is string => url !== null);

  return {
    title: session.title,
    description,
    alternates: { canonical: sessionPath(session.code) },
    robots: session.status === 'draft' ? { index: false } : undefined,
    openGraph: {
      title: session.title,
      description,
      type: 'website',
      url: sessionPath(session.code),
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: session.title, description },
  };
}
