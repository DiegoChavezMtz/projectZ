import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/utils/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${getSiteUrl()}/`, changeFrequency: 'weekly', priority: 1 }];
}
