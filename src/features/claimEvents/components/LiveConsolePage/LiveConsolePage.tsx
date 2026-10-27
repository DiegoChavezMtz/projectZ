import { notFound } from 'next/navigation';
import { getCategory } from '@/types/categories';
import { liveConsoleService } from '../../services/liveConsole.service';
import { requireSellerId } from '../../services/seller.context';
import { LiveConsoleView } from '../LiveConsoleView';

/**
 * `/dashboard/claims/[id]/live`: consola del dueño. Un evento ajeno, cancelado o borrador responde 404
 * (el borrador se opera desde la edición, no desde la consola).
 */
export async function LiveConsolePage({ id }: { id: string }) {
  const sellerId = await requireSellerId(`/dashboard/claims/${id}/live`);
  const snapshot = await liveConsoleService.getSnapshot(sellerId, id);
  if (!snapshot || snapshot.session.status === 'draft' || snapshot.session.status === 'cancelled')
    notFound();
  const { imageAspect, itemLabels } = getCategory(snapshot.session.category);
  return <LiveConsoleView snapshot={snapshot} category={{ imageAspect, itemLabels }} />;
}
