import { describe, expect, it, vi } from 'vitest';
import { liveClaimContent } from '@/features/liveClaim/content/es-MX';
import { summarizeEnded } from '@/features/liveClaim/utils/ended';
import { formatFeedEvent, type FeedLabels } from '@/features/liveClaim/utils/feed';
import { readHowItWorksDismissed, writeHowItWorksDismissed } from '@/features/liveClaim/utils/howItWorks';
import { validateOffer } from '@/features/liveClaim/utils/offer';
import { feedEvent, item } from './factories';

const labels: FeedLabels = {
  noun: { singular: 'carta', plural: 'cartas' },
  texts: liveClaimContent.feed.texts,
};
const format = (patch: Parameters<typeof feedEvent>[1]) => formatFeedEvent(feedEvent(1, patch), labels);

describe('formatFeedEvent', () => {
  it('claim, oferta y vendido con el nombre público del comprador', () => {
    expect(format({ type: 'item_claimed' })).toBe('Luis hizo claim de «Charizard ex».');
    expect(format({ type: 'item_offer' })).toBe('Luis ofertó por «Charizard ex».');
    expect(format({ type: 'item_sold', payload: { item_title: 'Mew', won_via: 'offer' } })).toBe('«Mew» pasó a Luis.');
  });

  it('nunca muestra montos', () => {
    const text = format({ type: 'item_offer', payload: { item_title: 'Mew', amount_cents: 9_900 } });
    expect(text).not.toMatch(/99|\$/);
  });

  it('sin nombre o título usa textos neutros', () => {
    expect(format({ type: 'item_claimed', actor_display_name: null, payload: {} })).toBe('Alguien hizo claim de «un artículo».');
  });

  it('liberación individual y masiva, anuncio, destacada y retirada', () => {
    expect(format({ type: 'item_released' })).toBe('Salió «Charizard ex».');
    expect(format({ type: 'item_released', payload: { count: 12 } })).toBe('Salieron 12 cartas.');
    expect(format({ type: 'item_released', payload: { count: 1 } })).toBe('Salieron 1 carta.');
    expect(format({ type: 'announcement', payload: { text: 'Sale la joya a las 9' } })).toBe('Sale la joya a las 9');
    expect(format({ type: 'item_featured' })).toBe('«Charizard ex» es la joya del claim.');
    expect(format({ type: 'item_withdrawn' })).toBe('El vendedor retiró «Charizard ex».');
  });

  it('inicio, fin y extensión del cierre', () => {
    expect(format({ type: 'session_started' })).toBe('El claim comenzó.');
    expect(format({ type: 'session_ended' })).toBe('El claim terminó.');
    expect(format({ type: 'session_extended', payload: { closes_at: '2026-10-31T14:00:00.000Z' } })).toBe(
      'El vendedor movió el cierre (31 de octubre de 2026 a las 8:00 a.m.).',
    );
  });
});

describe('summarizeEnded', () => {
  const items = [
    item({ id: 'a', status: 'sold', leader_display_name: 'Luis', leader_user_id: 'uuid-privado', leader_entry_id: 'entry-secreto' }),
    item({ id: 'b', status: 'available' }),
    item({ id: 'c', status: 'withdrawn' }),
    item({ id: 'd', status: 'hidden' }),
  ];

  it('separa vendidos y no vendidos, sin retirados ni ocultos', () => {
    const summary = summarizeEnded(items);
    expect(summary.sold.map((s) => s.id)).toEqual(['a']);
    expect(summary.unsold.map((s) => s.id)).toEqual(['b']);
  });

  it('no filtra ids de usuario ni de intentos', () => {
    const serialized = JSON.stringify(summarizeEnded(items));
    expect(serialized).not.toContain('uuid-privado');
    expect(serialized).not.toContain('entry-secreto');
    expect(serialized).toContain('Luis');
  });
});

describe('validateOffer', () => {
  it.each([
    ['', 'required'],
    ['abc', 'invalid'],
    ['0', 'tooLow'],
    ['150', 'tooHigh'],
    ['200', 'tooHigh'],
  ] as const)('%j → %s', (input, reason) => {
    expect(validateOffer(input, 15_000)).toEqual({ ok: false, reason });
  });

  it('acepta montos menores al precio, en centavos enteros', () => {
    expect(validateOffer('149.99', 15_000)).toEqual({ ok: true, amountCents: 14_999 });
    expect(validateOffer('$1,200', 150_000)).toEqual({ ok: true, amountCents: 120_000 });
  });
});

describe('howItWorks (descarte)', () => {
  it('se recuerda y funciona sin almacenamiento', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readHowItWorksDismissed(storage)).toBe(false);
    writeHowItWorksDismissed(storage);
    expect(readHowItWorksDismissed(storage)).toBe(true);

    const broken = {
      getItem: vi.fn(() => {
        throw new Error('bloqueado');
      }),
      setItem: vi.fn(() => {
        throw new Error('bloqueado');
      }),
    };
    expect(readHowItWorksDismissed(broken)).toBe(false);
    expect(() => writeHowItWorksDismissed(broken)).not.toThrow();
  });
});
