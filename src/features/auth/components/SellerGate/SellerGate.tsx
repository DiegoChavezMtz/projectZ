import type { ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { authContent } from '../../content/es-MX';
import { authService } from '../../services/auth.service';
import styles from '../AccountView/AccountView.module.css';

const c = authContent.seller;

/** Guarda de `/dashboard/**`: sin tienda lleva a /onboarding/seller (verificación en el servidor, A13). */
export async function SellerGate({ children }: { children: ReactNode }) {
  await authService.requireSeller();
  return children;
}

/** Marcador de la consola de vendedor (S4 en adelante). */
export async function SellerDashboardView() {
  const { seller } = await authService.requireSeller();
  return (
    <Container size="narrow" className={styles.root}>
      <Panel tone="raised" className={styles.panel}>
        <Heading level={1} size="xl">
          {c.dashboardTitle}: {seller.shop_name}
        </Heading>
        <Text tone="muted">/{seller.slug}</Text>
        <Text>{c.dashboardText}</Text>
        <div className={styles.actions}>
          <Button href="/account" variant="secondary">
            {c.dashboardEdit}
          </Button>
        </div>
      </Panel>
    </Container>
  );
}
