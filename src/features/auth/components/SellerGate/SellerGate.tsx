import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { authContent } from '../../content/es-MX';
import { authService } from '../../services/auth.service';
import { ShopProfileForm } from '../ShopProfileForm';
import styles from '../AccountView/AccountView.module.css';

const c = authContent.seller;

/** Guarda de `/dashboard/**`: sin tienda lleva a /onboarding/seller (verificación en el servidor, A13). */
export async function SellerGate({ children }: { children: ReactNode }) {
  // La sesión depende de la petición (y de la hora): se resuelve en cada solicitud, no al prerenderizar.
  await connection();
  await authService.requireSeller();
  return children;
}

/**
 * `/dashboard` (Resumen): encabezado con el nombre de la tienda y su enlace; el contenido (claim activo,
 * pendientes, órdenes) lo componen las pages con componentes de `claimEvents` y `fulfillment`.
 */
export async function SellerDashboardView({ children }: { children?: ReactNode }) {
  await connection();
  const { seller } = await authService.requireSeller();
  return (
    <Container className={styles.root}>
      <header className={styles.panel}>
        <Heading level={1} size="xl">
          {c.summaryTitle}
        </Heading>
        <Text tone="muted" className={styles.sub}>
          {seller.shop_name} · <a href={`/u/${seller.slug}`}>/{seller.slug}</a>
        </Text>
      </header>
      <div className={styles.panel}>{children}</div>
    </Container>
  );
}

/** `/dashboard/settings` (Ajustes de la tienda): perfil de la tienda; los datos de pago los aporta la page. */
export async function ShopSettingsView({ children }: { children?: ReactNode }) {
  await connection();
  const { seller } = await authService.requireSeller('/dashboard/settings');
  return (
    <Container size="narrow" className={styles.root}>
      <div className={styles.panel}>
        <header>
          <Heading level={1} size="xl">
            {c.settingsTitle}
          </Heading>
          <Text tone="muted" className={styles.sub}>
            {c.settingsSubtitle}
          </Text>
        </header>
        <Panel tone="raised" className={styles.panel}>
          <Heading level={2} size="lg">
            {c.shopProfileTitle}
          </Heading>
          <ShopProfileForm
            shopName={seller.shop_name}
            slug={seller.slug}
            bio={seller.bio ?? ''}
            city={seller.city ?? ''}
          />
        </Panel>
        {children}
      </div>
    </Container>
  );
}
