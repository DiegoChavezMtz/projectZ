import { connection } from 'next/server';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { reputationContent } from '../../content/es-MX';
import { ratingService } from '../../services/rating.service';
import { RatingForm } from '../RatingForm';
import styles from './PendingRatings.module.css';

type Props = {
  /** Ruta que lo muestra (para volver tras un login). */
  next: string;
  /** Solo la cuenta indicada (detalle de una cuenta). Sin él, todas las pendientes. */
  orderId?: string;
};

/** Cuentas completadas por calificar (14 días). No renderiza nada si no hay pendientes. */
export async function PendingRatings({ next, orderId }: Props) {
  await connection(); // la ventana de 14 días se evalúa contra la hora de cada petición
  const all = await ratingService.pendingForCurrentUser();
  const pending = orderId ? all.filter((p) => p.orderId === orderId) : all;
  if (pending.length === 0) return null;

  return (
    <Container as="section" className={styles.root} aria-labelledby="pending-ratings">
      <Heading level={2} size="lg" id="pending-ratings">
        {reputationContent.rating.pendingTitle}
      </Heading>
      <ul className={styles.list}>
        {pending.map((p) => (
          <li key={p.orderId}>
            <RatingForm
              orderId={p.orderId}
              myRole={p.myRole}
              counterpartyName={p.counterpartyName}
              sessionTitle={p.sessionTitle}
              rateUntil={p.rateUntil}
              next={next}
            />
          </li>
        ))}
      </ul>
    </Container>
  );
}
