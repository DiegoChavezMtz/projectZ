import type { Metadata } from 'next';
import { landingContent } from './content/es-MX';

const { title, description } = landingContent.meta;

/** Metadata de `/`: título, descripción, canonical, Open Graph y Twitter. La imagen OG la aporta `app/opengraph-image`. */
export const landingMetadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    url: '/',
    title,
    description,
    siteName: 'Zlotify',
  },
  twitter: { card: 'summary_large_image', title, description },
};
