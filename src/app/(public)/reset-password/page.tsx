import type { Metadata } from 'next';
import { ResetPasswordPage } from '@/features/auth';

export const metadata: Metadata = { title: 'Nueva contraseña', robots: { index: false } };

export default function Page() {
  return <ResetPasswordPage />;
}
