import { Heading } from '@/components/atoms/Heading';
import { Text } from '@/components/atoms/Text';
import { Panel } from '@/components/molecules/Panel';
import { fulfillmentContent } from '../../content/es-MX';
import { orderQueries } from '../../services/orderQueries';
import { requireUser } from '../../services/session.context';
import { PaymentInstructionsForm } from './PaymentInstructionsForm';
import { ToastProvider } from '@/context/ToastContext';
import styles from './PaymentInstructionsView.module.css';

const c = fulfillmentContent.settings;

/** Datos de pago del vendedor (`seller_profiles.payment_instructions`), dentro de «Ajustes de la tienda». */
export async function PaymentInstructionsView() {
  const { supabase, userId } = await requireUser('/dashboard/settings');
  const initial = await orderQueries.paymentInstructions(supabase, userId);
  return (
    <ToastProvider>
      <Panel tone="raised" className={styles.panel}>
        <Heading level={2} size="lg">
          {c.title}
        </Heading>
        <Text tone="muted">{c.subtitle}</Text>
        <PaymentInstructionsForm initial={initial} />
      </Panel>
    </ToastProvider>
  );
}
