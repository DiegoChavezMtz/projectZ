import type { Metadata } from 'next';
import { AppEntry } from '@/features/auth';

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } };

// Puerta de la app: redirige a Mi tienda o a Mis cuentas según la persona.
export default function Page() {
  return <AppEntry />;
}
