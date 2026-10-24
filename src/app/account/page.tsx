import type { Metadata } from 'next';
import { AccountView } from '@/features/auth';

export const metadata: Metadata = { title: 'Tu cuenta', robots: { index: false } };

export default function Page() {
  return <AccountView />;
}
