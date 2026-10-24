import { ImageResponse } from 'next/og';
import { OgImage, landingContent } from '@/features/landing';

export const alt = landingContent.meta.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(<OgImage />, size);
}
