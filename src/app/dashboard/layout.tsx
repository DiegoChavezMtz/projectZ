import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/templates/AppShell';
import { AppUserMenu, SellerGate } from '@/features/auth';

// Zona de app, sección «Mi tienda»: exige tienda (el guard vive en la feature) dentro del shell.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      userMenu={
        <Suspense fallback={null}>
          <AppUserMenu />
        </Suspense>
      }
    >
      <SellerGate>{children}</SellerGate>
    </AppShell>
  );
}
