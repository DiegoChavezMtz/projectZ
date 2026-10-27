import { Container } from '@/components/atoms/Container';
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

/** `/dashboard/settings`: datos de pago del vendedor (`seller_profiles.payment_instructions`). */
export async function PaymentInstructionsView() {
  const { supabase, userId } = await requireUser('/dashboard/settings');
  const initial = await orderQueries.paymentInstructions(supabase, userId);
  return (
    <ToastProvider>
      <Container size="narrow" className={styles.root}>
        <Panel tone="raised" className={styles.panel}>
          <Heading level={1} size="xl">
            {c.title}
          </Heading>
          <Text tone="muted">{c.subtitle}</Text>
          <PaymentInstructionsForm initial={initial} />
        </Panel>
      </Container>
    </ToastProvider>
  );
}
