import { createClient } from '@/lib/supabase/client';
import type { ItemStatus } from '@/types/claims';
import { unwrapRpc } from '@/utils/rpc';
import { liveClaimContent } from '../content/es-MX';
import type { ClaimItemResult, MakeOfferResult } from '../types';

const messages = liveClaimContent.errors;

// Acciones del comprador. Van directo a la RPC desde el navegador (latencia y orden: claims.md);
// la hora y el orden los decide Postgres. Los fallos llegan como AppError con texto en español.
export const claimActionsService = {
  async claimItem(itemId: string): Promise<ClaimItemResult> {
    const { data, error } = await createClient().rpc('claim_item', { p_item_id: itemId });
    const result = unwrapRpc<{
      entry_id: string;
      position: number;
      item_status: ItemStatus;
      won: boolean;
    }>(data, error, messages);
    return {
      entryId: result.entry_id,
      position: result.position,
      itemStatus: result.item_status,
      won: result.won,
    };
  },

  async makeOffer(itemId: string, amountCents: number): Promise<MakeOfferResult> {
    const { data, error } = await createClient().rpc('make_offer', {
      p_item_id: itemId,
      p_amount_cents: amountCents,
    });
    const result = unwrapRpc<{ entry_id: string }>(data, error, messages);
    return { entryId: result.entry_id };
  },

  async withdrawEntry(entryId: string): Promise<void> {
    const { data, error } = await createClient().rpc('withdraw_entry', { p_entry_id: entryId });
    unwrapRpc(data, error, messages);
  },
};
