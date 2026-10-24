import type { Metadata } from 'next';
import { LegalDocument, legalContent } from '@/features/legal';

export const metadata: Metadata = {
  title: legalContent.privacy.title,
  description: legalContent.privacy.description,
};

export default function Page() {
  return <LegalDocument id="privacy" />;
}
