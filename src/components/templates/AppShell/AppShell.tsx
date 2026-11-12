import { Suspense, type ReactNode } from 'react';
import { AppNav } from './AppNav';

type Props = {
  /** Menú de usuario. Lo inyecta `app/`: el shell no conoce la sesión. */
  userMenu: ReactNode;
  /** Mi tienda sin configurar: el menú lateral solo deja activa la configuración (el resto, con candado). */
  shopLocked?: boolean;
  children: ReactNode;
};

/** Shell de la zona de app: barra superior «Mi tienda | Mis cuentas» + menú lateral flotante por sección. */
export function AppShell({ userMenu, shopLocked = false, children }: Props) {
  return (
    <AppNav userMenu={userMenu} shopLocked={shopLocked}>
      <Suspense fallback={null}>{children}</Suspense>
    </AppNav>
  );
}
