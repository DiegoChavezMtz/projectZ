// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ENGINE_ERROR_CODES } from '@/types/claims';
import { AppError } from '@/utils/errors';

const rpc = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }));

const { claimActionsService } = await import('@/features/liveClaim/services/claimActions.service');
const { liveActionsService } = await import('@/features/claimEvents/services/liveActions.service');
const { liveClaimContent } = await import('@/features/liveClaim/content/es-MX');
const { liveActionErrors } = await import('@/features/claimEvents/content/es-MX');

beforeEach(() => rpc.mockReset());

const caught = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  throw new Error('no lanzó');
};

describe('claimActionsService', () => {
  it('claimItem envía p_item_id y traduce la respuesta', async () => {
    rpc.mockResolvedValue({
      data: { ok: true, entry_id: 'e1', position: 2, item_status: 'available', won: false },
      error: null,
    });
    expect(await claimActionsService.claimItem('i1')).toEqual({
      entryId: 'e1',
      position: 2,
      itemStatus: 'available',
      won: false,
    });
    expect(rpc).toHaveBeenCalledWith('claim_item', { p_item_id: 'i1' });
  });

  it('makeOffer y withdrawEntry usan los parámetros del motor', async () => {
    rpc.mockResolvedValue({ data: { ok: true, entry_id: 'e9' }, error: null });
    expect(await claimActionsService.makeOffer('i1', 5000)).toEqual({ entryId: 'e9' });
    expect(rpc).toHaveBeenCalledWith('make_offer', { p_item_id: 'i1', p_amount_cents: 5000 });
    await claimActionsService.withdrawEntry('e9');
    expect(rpc).toHaveBeenLastCalledWith('withdraw_entry', { p_entry_id: 'e9' });
  });

  it('todos los códigos del motor tienen texto en español para el comprador', async () => {
    for (const code of ENGINE_ERROR_CODES) {
      expect(liveClaimContent.errors[code], code).toBeTruthy();
      rpc.mockResolvedValue({ data: { ok: false, code, message: 'x' }, error: null });
      const error = await caught(claimActionsService.claimItem('i1'));
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(code);
      expect(error.message).toBe(liveClaimContent.errors[code]);
    }
  });

  it('un anónimo (42501) y una falla de red se mapean', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    expect((await caught(claimActionsService.claimItem('i1'))).code).toBe('unauthenticated');
    rpc.mockResolvedValue({ data: null, error: { message: 'fetch failed' } });
    expect((await caught(claimActionsService.claimItem('i1'))).code).toBe('unknown');
  });
});

describe('liveActionsService', () => {
  it('invoca cada RPC con su parámetro', async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });
    await liveActionsService.startSession('s1');
    await liveActionsService.endSession('s1');
    await liveActionsService.releaseItem('i1');
    await liveActionsService.releaseAllItems('s1');
    await liveActionsService.withdrawItem('i1');
    await liveActionsService.postAnnouncement('s1', 'Hola');
    await liveActionsService.featureItem('i1');
    await liveActionsService.featureItem('i1', false);
    await liveActionsService.confirmEntry('e1');
    await liveActionsService.rejectEntry('e1');
    await liveActionsService.acceptOffer('e1');
    await liveActionsService.rejectOffer('e1');
    expect(rpc.mock.calls).toEqual([
      ['start_session', { p_session_id: 's1' }],
      ['end_session', { p_session_id: 's1' }],
      ['release_item', { p_item_id: 'i1' }],
      ['release_all_items', { p_session_id: 's1' }],
      ['withdraw_item', { p_item_id: 'i1' }],
      ['post_announcement', { p_session_id: 's1', p_text: 'Hola' }],
      ['feature_item', { p_item_id: 'i1', p_featured: true }],
      ['feature_item', { p_item_id: 'i1', p_featured: false }],
      ['confirm_entry', { p_entry_id: 'e1' }],
      ['reject_entry', { p_entry_id: 'e1' }],
      ['accept_offer', { p_entry_id: 'e1' }],
      ['reject_offer', { p_entry_id: 'e1' }],
    ]);
  });

  it('mapea los errores del motor a texto del vendedor', async () => {
    rpc.mockResolvedValue({ data: { ok: false, code: 'forbidden', message: 'x' }, error: null });
    const error = await caught(liveActionsService.startSession('s1'));
    expect(error.code).toBe('forbidden');
    expect(error.message).toBe(liveActionErrors.forbidden);
    rpc.mockResolvedValue({ data: { ok: false, code: 'raro', message: 'x' }, error: null });
    expect((await caught(liveActionsService.endSession('s1'))).message).toBe(
      liveActionErrors.unknown,
    );
  });
});
