import { connection } from 'next/server';
import { Button } from '@/components/atoms/Button';
import { Heading } from '@/components/atoms/Heading';
import { KpiTile } from '@/components/molecules/KpiTile';
import { fulfillmentContent } from '../../content/es-MX';
import { orderQueries } from '../../services/orderQueries';
import { requireUser } from '../../services/session.context';
import { bucketSize, sellerBuckets } from '../../utils/sellerBuckets';
import styles from './OrdersSummary.module.css';

const c = fulfillmentContent.shopSummary;

/** Resumen de Mi tienda, parte de órdenes: por cerrar, pagos por confirmar y envíos pendientes. */
export async function OrdersSummary() {
  await connection();
  const { supabase, userId } = await requireUser('/dashboard');
  const buckets = sellerBuckets(await orderQueries.forSeller(supabase, userId));
  const toShip = bucketSize(buckets.toShip) + bucketSize(buckets.toQuote);
  return (
    <section className={styles.root} aria-labelledby="shop-summary-orders">
      <Heading level={2} size="lg" id="shop-summary-orders">
        {c.heading}
      </Heading>
      <div className={styles.tiles}>
        <KpiTile
          href="/dashboard/orders"
          value={bucketSize(buckets.toClose)}
          label={c.toClose}
          color="orange"
        />
        <KpiTile
          href="/dashboard/orders?tab=toReview"
          value={bucketSize(buckets.toReview)}
          label={c.toReview}
          color="jade"
        />
        <KpiTile href="/dashboard/orders?tab=toShip" value={toShip} label={c.toShip} color="grey" />
      </div>
      <div>
        <Button href="/dashboard/orders" variant="secondary">
          {c.all}
        </Button>
      </div>
    </section>
  );
}
