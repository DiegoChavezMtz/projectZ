import { notFound } from 'next/navigation';
import { getCategory } from '@/types/categories';
import { getSiteUrl } from '@/utils/site';
import { snapshotService } from '../../services/snapshot.service';
import { sessionPath } from '../../utils/session';
import { LiveClaimView } from '../LiveClaimView';
import { loadLive } from './loadLive';

/**
 * `/c/[code]`: el servidor entrega el snapshot (HTML con los artículos) y el cliente se suscribe
 * a los cambios. `draft` solo lo ve su dueño; `cancelled` y desconocidos son 404.
 */
export async function LiveClaimPage({ code }: { code: string }) {
  const { viewer, snapshot } = await loadLive(code);
  if (!snapshot) notFound();

  const entries = viewer ? await snapshotService.getViewerEntries(snapshot.session.id) : [];
  const { id, itemLabels, imageAspect, fields } = getCategory(snapshot.session.category);
  return (
    <LiveClaimView
      snapshot={snapshot}
      viewer={viewer}
      isOwner={viewer?.id === snapshot.session.seller_id}
      category={{ id, itemLabels, imageAspect, fields }}
      initialEntries={entries}
      eventUrl={`${getSiteUrl()}${sessionPath(snapshot.session.code)}`}
    />
  );
}
