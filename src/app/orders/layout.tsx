import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/templates/AppShell';
import { AppUserMenu } from '@/features/auth';

// Zona de app (autenticada): barra superior «Mi tienda | Mis cuentas» y menú lateral.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      userMenu={
        <Suspense fallback={null}>
          <AppUserMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
