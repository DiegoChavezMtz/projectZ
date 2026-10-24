import type { ReactNode } from 'react';
import { SellerGate } from '@/features/auth';

// Toda la zona de vendedor exige tienda (el guard vive en la feature).
export default function Layout({ children }: { children: ReactNode }) {
  return <SellerGate>{children}</SellerGate>;
}
