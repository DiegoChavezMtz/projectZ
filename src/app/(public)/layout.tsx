import { Suspense, type ReactNode } from 'react';
import { PageShell } from '@/components/templates/PageShell';
import { SessionMenu } from '@/features/auth';

// Zona pública (landing, legales, login/signup, vistas públicas de claim y vendedor): header de sitio.
// La zona de app (`dashboard`, `orders`, `account`, `onboarding/seller`) tiene su propio shell.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell
      headerActions={
        <Suspense fallback={null}>
          <SessionMenu />
        </Suspense>
      }
    >
      <Suspense fallback={null}>{children}</Suspense>
    </PageShell>
  );
}
