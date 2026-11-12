import { notFound, redirect } from 'next/navigation';
import { claimSessionService } from '../../services/claimSession.service';
import { requireSellerId } from '../../services/seller.context';
import { isSessionEditable } from '../../utils/session.utils';
import { ScannerWorkspace } from '../ScannerWorkspace';

/** S11: ruta del modo escáner de un evento. Solo eventos editables (borrador o programado). */
export async function ScannerPage({ id }: { id: string }) {
  const sellerId = await requireSellerId(`/dashboard/claims/${id}/scanner`);
  const session = await claimSessionService.getWithItems(sellerId, id);
  if (!session || session.status === 'cancelled') notFound();
  const editorHref = `/dashboard/claims/${id}/edit`;
  if (!isSessionEditable(session.status)) redirect(editorHref);
  return (
    <ScannerWorkspace
      sessionId={session.id}
      categoryId={session.category}
      canSkipPrice={session.status === 'draft'}
      items={session.items}
      editorHref={editorHref}
    />
  );
}
