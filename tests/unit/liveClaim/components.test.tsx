import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env.public', () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.test' },
}));

const { Countdown } = await import('@/features/liveClaim/components/Countdown');
const { HowItWorksPanel } = await import('@/features/liveClaim/components/HowItWorksPanel');
const { EndedView } = await import('@/features/liveClaim/components/EndedView');
const { ItemTile } = await import('@/features/liveClaim/components/ItemTile');
const { ConnectionBanner } = await import('@/features/liveClaim/components/ConnectionBanner');
const { ActivityFeed } = await import('@/features/liveClaim/components/ActivityFeed');
const { deriveItemView } = await import('@/features/liveClaim/utils/itemState');
const { getCategory } = await import('@/types/categories');
const { entry, feedEvent, item, session } = await import('./factories');

const category = getCategory('tcg');

describe('Countdown (tiempo simulado)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T00:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  const visibleTime = () => screen.getByText(/^\d{2}:\d{2}/, { selector: 'time' }).textContent;

  it('cuenta hacia atrás y llega a cero llamando onReach una sola vez', () => {
    const onReach = vi.fn();
    render(<Countdown target="2026-10-27T00:00:03.000Z" offsetMs={0} ready label="Empieza en" onReach={onReach} />);
    expect(visibleTime()).toBe('00:03');
    act(() => void vi.advanceTimersByTime(1010));
    expect(visibleTime()).toBe('00:02');
    act(() => void vi.advanceTimersByTime(5000));
    expect(visibleTime()).toBe('00:00');
    expect(onReach).toHaveBeenCalledTimes(1);
  });

  it('sin drift tras 10 minutos y con el reloj del servidor adelantado', () => {
    // El servidor va 30 s adelante del dispositivo: faltan 10 min menos 30 s.
    render(<Countdown target="2026-10-27T00:10:00.000Z" offsetMs={30_000} ready label="Cierra en" />);
    expect(visibleTime()).toBe('09:30');
    act(() => void vi.advanceTimersByTime(9 * 60_000 + 1010));
    expect(visibleTime()).toBe('00:29');
  });

  it('si se extiende el cierre, la cuenta sigue con el nuevo objetivo', () => {
    const { rerender } = render(<Countdown target="2026-10-27T00:00:10.000Z" offsetMs={0} ready label="Cierra en" />);
    expect(visibleTime()).toBe('00:10');
    rerender(<Countdown target="2026-10-27T00:01:00.000Z" offsetMs={0} ready label="Cierra en" />);
    expect(visibleTime()).toBe('01:00');
  });

  it('un cierre ya vencido avisa de inmediato', () => {
    const onReach = vi.fn();
    render(<Countdown target="2026-10-26T23:00:00.000Z" offsetMs={0} ready label="Cierra en" onReach={onReach} />);
    expect(onReach).toHaveBeenCalledTimes(1);
  });

  it('sin reloj medido solo muestra la fecha', () => {
    render(<Countdown target="2026-10-27T02:00:00.000Z" offsetMs={0} ready={false} label="Empieza en" />);
    expect(screen.queryByText(/^\d{2}:\d{2}/)).toBeNull();
    expect(screen.getByText(/octubre de 2026/)).toBeInTheDocument();
  });

  it('no usa animaciones (respeta prefers-reduced-motion por construcción)', () => {
    const { container } = render(<Countdown target="2026-10-27T00:00:30.000Z" offsetMs={0} ready label="x" />);
    expect(container.querySelector('[class*="pulse"], [style*="animation"]')).toBeNull();
  });
});

describe('HowItWorksPanel', () => {
  beforeEach(() => window.localStorage.clear());

  it('aparece, se descarta y no reaparece en la siguiente visita', async () => {
    const user = userEvent.setup();
    const first = render(<HowItWorksPanel showGuardadito={false} />);
    expect(await screen.findByRole('region', { name: '¿Cómo funciona un claim?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('region', { name: '¿Cómo funciona un claim?' })).toBeNull();
    first.unmount();

    render(<HowItWorksPanel showGuardadito={false} />);
    expect(await screen.findByRole('button', { name: '¿Cómo funciona un claim?' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '¿Cómo funciona un claim?' })).toBeNull();
  });

  it('se cierra con Escape y se puede volver a abrir', async () => {
    const user = userEvent.setup();
    render(<HowItWorksPanel showGuardadito={false} />);
    const region = await screen.findByRole('region', { name: '¿Cómo funciona un claim?' });
    await user.click(within(region).getByText('Más sobre claims'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: '¿Cómo funciona un claim?' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '¿Cómo funciona un claim?' }));
    expect(screen.getByRole('region', { name: '¿Cómo funciona un claim?' })).toBeInTheDocument();
  });

  it('el guardadito solo aparece si el vendedor lo ofrece', async () => {
    const { unmount } = render(<HowItWorksPanel showGuardadito={false} />);
    await screen.findByRole('region');
    expect(screen.queryByText('¿Qué es el guardadito?')).toBeNull();
    unmount();
    render(<HowItWorksPanel showGuardadito />);
    await screen.findByRole('region');
    expect(screen.getByText('¿Qué es el guardadito?')).toBeInTheDocument();
  });

  it('funciona aunque el almacenamiento falle', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    render(<HowItWorksPanel showGuardadito={false} />);
    expect(await screen.findByRole('region')).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('EndedView', () => {
  it('muestra vendidos con nombre público y no filtra datos privados', () => {
    const items = [
      item({ id: 'a', title: 'Charizard ex', status: 'sold', leader_display_name: 'Luis', leader_user_id: 'uuid-privado', leader_entry_id: 'entry-secreto' }),
      item({ id: 'b', title: 'Eevee', status: 'available', price_cents: 5_000 }),
    ];
    const { container } = render(
      <EndedView
        session={session({ status: 'ended' })}
        seller={{ id: 'seller-1', shopName: 'Cartas del Centro', handle: null, city: 'CDMX' }}
        items={items}
        category={category}
      />,
    );
    expect(screen.getByText('Charizard ex')).toBeInTheDocument();
    expect(screen.getByText(/Para Luis/)).toBeInTheDocument();
    expect(screen.getByText('Eevee')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('uuid-privado');
    expect(container.innerHTML).not.toContain('entry-secreto');
  });
});

describe('ItemTile', () => {
  const handlers = { onClaim: vi.fn(), onOffer: vi.fn(), onWithdraw: vi.fn() };
  const renderTile = (patch: Parameters<typeof item>[0], opts: { viewerId?: string | null; entries?: ReturnType<typeof entry>[] } = {}) => {
    const it = item(patch);
    const view = deriveItemView({
      item: it,
      sessionStatus: 'live',
      viewerId: opts.viewerId === undefined ? 'me' : opts.viewerId,
      isOwner: false,
      entries: opts.entries ?? [],
    });
    return render(
      <ul>
        <ItemTile item={it} view={view} category={category} interactive {...handlers} />
      </ul>,
    );
  };

  it('muestra título, precio en pesos, atributos y estado', () => {
    renderTile({});
    expect(screen.getByRole('heading', { name: 'Charizard ex' })).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('Español')).toBeInTheDocument();
    expect(screen.getByText('Near Mint (NM)')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
  });

  it('los botones llaman a las acciones', async () => {
    const user = userEvent.setup();
    renderTile({});
    await user.click(screen.getByRole('button', { name: 'Hacer claim' }));
    await user.click(screen.getByRole('button', { name: 'Ofertar' }));
    expect(handlers.onClaim).toHaveBeenCalledOnce();
    expect(handlers.onOffer).toHaveBeenCalledOnce();
  });

  it('muestra al líder con datos mínimos de reputación', () => {
    renderTile({ leader_entry_id: 'e', leader_user_id: 'x', leader_handle: 'luis', leader_display_name: 'Luis', leader_wins_count: 3 });
    expect(screen.getByText('Reclamada')).toBeInTheDocument();
    expect(screen.getByText(/Por Luis · 3 claims ganados/)).toBeInTheDocument();
  });

  it('anuncia en una región de estado la posición del usuario', () => {
    renderTile({ leader_entry_id: 'e1', leader_user_id: 'me' }, { entries: [entry({ id: 'e1' })] });
    expect(screen.getByRole('status')).toHaveTextContent('Vas primero');
    expect(screen.getByRole('button', { name: 'Retirar mi claim' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hacer claim' })).toBeNull();
  });

  it('vendida: sin acciones', () => {
    renderTile({ status: 'sold', leader_display_name: 'Luis' });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Vendida')).toBeInTheDocument();
  });
});

describe('ConnectionBanner y ActivityFeed', () => {
  it('el banner solo avisa cuando no hay conexión', () => {
    const { rerender } = render(<ConnectionBanner status="online" />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(<ConnectionBanner status="reconnecting" />);
    expect(screen.getByRole('status')).toHaveTextContent('Reconectando');
    rerender(<ConnectionBanner status="offline" />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión');
  });

  it('el feed lista los eventos con texto legible', () => {
    render(<ActivityFeed events={[feedEvent(1), feedEvent(2, { type: 'item_sold', actor_display_name: 'Ana' })]} noun={category.itemLabels} />);
    expect(screen.getByText('Luis hizo claim de «Charizard ex».')).toBeInTheDocument();
    expect(screen.getByText('«Charizard ex» pasó a Ana.')).toBeInTheDocument();
  });

  it('el feed vacío lo dice', () => {
    render(<ActivityFeed events={[]} noun={category.itemLabels} />);
    expect(screen.getByText('Aún no hay actividad.')).toBeInTheDocument();
  });
});
