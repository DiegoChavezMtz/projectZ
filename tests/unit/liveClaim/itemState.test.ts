import { describe, expect, it } from 'vitest';
import { deriveItemView, publicItemState } from '@/features/liveClaim/utils/itemState';
import type { PendingAction } from '@/features/liveClaim/types';
import type { ItemStatus, SessionStatus } from '@/types/claims';
import { entry, item } from './factories';

const ME = 'me';

describe('publicItemState', () => {
  it.each<[ItemStatus, Partial<ReturnType<typeof item>>, string]>([
    ['hidden', {}, 'upcoming'],
    ['available', {}, 'available'],
    ['available', { leader_entry_id: 'e', leader_user_id: 'x' }, 'claimed'],
    ['available', { offer_count: 2 }, 'offers'],
    ['available', { leader_entry_id: 'e', offer_count: 2 }, 'claimed'], // un claim pesa más que las ofertas
    ['sold', { leader_entry_id: 'e' }, 'sold'],
    ['withdrawn', {}, 'withdrawn'],
  ])('%s %j → %s', (status, patch, expected) => {
    expect(publicItemState(item({ status, ...patch }))).toBe(expected);
  });
});

describe('deriveItemView', () => {
  const view = (
    patch: Partial<Parameters<typeof deriveItemView>[0]> & { sessionStatus?: SessionStatus },
  ) =>
    deriveItemView({
      item: item(),
      sessionStatus: 'live',
      viewerId: ME,
      isOwner: false,
      entries: [],
      ...patch,
    });

  it('disponible y en vivo: se puede hacer claim y ofertar', () => {
    expect(view({})).toMatchObject({ state: 'available', relation: 'none', canClaim: true, canOffer: true });
  });

  it('un visitante sin sesión ve las acciones (llevan a iniciar sesión)', () => {
    expect(view({ viewerId: null })).toMatchObject({ canClaim: true, canOffer: true, relation: 'none' });
  });

  it('el vendedor del evento no compra', () => {
    expect(view({ isOwner: true })).toMatchObject({ canClaim: false, canOffer: false });
  });

  it.each<SessionStatus>(['draft', 'scheduled', 'ended', 'cancelled'])(
    'sin acciones si el evento está %s',
    (sessionStatus) => {
      expect(view({ sessionStatus })).toMatchObject({ canClaim: false, canOffer: false });
    },
  );

  it.each(['upcoming', 'sold', 'withdrawn'] as const)('sin acciones si el artículo es %s', (state) => {
    const status: ItemStatus = state === 'upcoming' ? 'hidden' : state;
    expect(view({ item: item({ status }) })).toMatchObject({ canClaim: false, canOffer: false });
  });

  it('claim propio como líder: "leading" y sin repetir claim', () => {
    const result = view({
      item: item({ leader_entry_id: 'entry-1', leader_user_id: ME }),
      entries: [entry()],
    });
    expect(result).toMatchObject({ state: 'claimed', relation: 'leading', canClaim: false, canOffer: true });
    expect(result.openEntry?.id).toBe('entry-1');
  });

  it('claim propio en la fila (otro es líder): "queued"', () => {
    const result = view({
      item: item({ leader_entry_id: 'other', leader_user_id: 'someone' }),
      entries: [entry()],
    });
    expect(result).toMatchObject({ state: 'claimed', relation: 'queued', canClaim: false });
  });

  it('oferta pendiente: "offered", puede hacer claim al precio completo pero no ofertar de nuevo', () => {
    const result = view({
      item: item({ offer_count: 1 }),
      entries: [entry({ id: 'o1', kind: 'offer', status: 'pending', amount_cents: 9_000 })],
    });
    expect(result).toMatchObject({ state: 'offers', relation: 'offered', canClaim: true, canOffer: false });
  });

  it('con claim y oferta abiertos gana el claim', () => {
    const result = view({
      entries: [
        entry({ id: 'o1', kind: 'offer', status: 'pending', seq: 1 }),
        entry({ id: 'c1', kind: 'claim', status: 'queued', seq: 2 }),
      ],
    });
    expect(result.openEntry?.id).toBe('c1');
  });

  it('artículo vendido a mí: "won"', () => {
    const result = view({
      item: item({ status: 'sold', leader_user_id: ME }),
      entries: [entry({ status: 'accepted' })],
    });
    expect(result).toMatchObject({ state: 'sold', relation: 'won', openEntry: null });
  });

  it('artículo vendido a otro habiendo intentado: "lost"; sin intentos: "none"', () => {
    const sold = item({ status: 'sold', leader_user_id: 'other' });
    expect(view({ item: sold, entries: [entry({ status: 'superseded' })] }).relation).toBe('lost');
    expect(view({ item: sold }).relation).toBe('none');
  });

  it('intentos retirados o rechazados no cuentan como abiertos', () => {
    for (const status of ['withdrawn', 'rejected', 'superseded'] as const) {
      expect(view({ entries: [entry({ status })] })).toMatchObject({ relation: 'none', canClaim: true });
    }
  });

  it('acción optimista en curso: "sending" y sin acciones', () => {
    const pending: PendingAction = { kind: 'claim' };
    expect(view({ pending })).toMatchObject({ relation: 'sending', canClaim: false, canOffer: false });
  });

  it('los intentos de otros artículos no afectan', () => {
    expect(view({ entries: [entry({ item_id: 'otro' })] }).relation).toBe('none');
  });
});
