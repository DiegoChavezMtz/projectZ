import type { Metadata } from 'next';
import { LegalDocument, legalContent } from '@/features/legal';

export const metadata: Metadata = {
  title: legalContent.terms.title,
  description: legalContent.terms.description,
};

export default function Page() {
  return <LegalDocument id="terms" />;
}
