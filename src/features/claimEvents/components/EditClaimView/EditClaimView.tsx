import { notFound } from 'next/navigation';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { claimEventsContent } from '../../content/es-MX';
import { claimSessionService } from '../../services/claimSession.service';
import { requireSellerId } from '../../services/seller.context';
import { isSessionEditable } from '../../utils/session.utils';
import { ItemsEditor } from '../ItemsEditor';
import { PublishPanel } from '../PublishPanel';
import { SessionForm } from '../SessionForm';
import { StatusBadge } from '../StatusBadge';
import styles from './EditClaimView.module.css';

/** S4-09/10/12: editar evento, administrar artículos y publicar. SSR; los formularios son islas de cliente. */
export async function EditClaimView({ id, siteUrl }: { id: string; siteUrl: string }) {
  const sellerId = await requireSellerId(`/dashboard/claims/${id}/edit`);
  const session = await claimSessionService.getWithItems(sellerId, id);
  if (!session || session.status === 'cancelled') notFound();
  const editable = isSessionEditable(session.status);
  // Al llegar datos nuevos del servidor las islas se remontan con el estado fresco.
  const version = `${session.updated_at}:${session.items.map((i) => `${i.id}${i.updated_at}${i.position}`).join(',')}`;

  return (
    <Container size="narrow" className={styles.root}>
      <header className={styles.header}>
        <Heading level={1} size="xl">
          {claimEventsContent.form.editTitle}
        </Heading>
        <StatusBadge status={session.status} />
      </header>
      <PublishPanel
        key={`p:${version}`}
        session={session}
        items={session.items}
        siteUrl={siteUrl}
      />
      <SessionForm key={`s:${session.status}`} session={session} />
      <ItemsEditor
        key={`i:${version}`}
        sessionId={session.id}
        categoryId={session.category}
        items={session.items}
        editable={editable}
      />
    </Container>
  );
}
