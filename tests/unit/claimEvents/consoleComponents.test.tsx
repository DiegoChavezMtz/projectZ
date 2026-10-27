import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env.public', () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.test' },
}));

const { ItemOperationRow } = await import('@/features/claimEvents/components/ItemOperationRow');
const { ConsoleHeader } = await import('@/features/claimEvents/components/ConsoleHeader');
const { AnnouncementForm } = await import('@/features/claimEvents/components/AnnouncementForm');
const { buildOperations } = await import('@/features/claimEvents/utils/consoleOperations');
const { getCategory } = await import('@/types/categories');
const { consoleEntry, item, session } = await import('./consoleFactories');

const category = getCategory('tcg');
const buyers = {
  'buyer-1': { id: 'buyer-1', name: 'Luis', memberSince: '2026-01-01T00:00:00.000Z' },
};
const handlers = () => ({
  onRelease: vi.fn(),
  onWithdraw: vi.fn(),
  onFeature: vi.fn(),
  onConfirm: vi.fn(),
  onReject: vi.fn(),
  onAcceptOffer: vi.fn(),
  onRejectOffer: vi.fn(),
});

function row(opts: { autoConfirm: boolean; status?: 'live' | 'ended' }) {
  const h = handlers();
  const entries = [
    consoleEntry({ id: 'e1' }),
    consoleEntry({ id: 'o1', seq: 2, kind: 'offer', amount_cents: 9_000, status: 'pending' }),
  ];
  const [operation] = buildOperations(
    [item({ id: 'item-1', leader_entry_id: 'e1', leader_wins_count: 3 })],
    entries,
    buyers,
  );
  render(
    <ul>
      <ItemOperationRow
        operation={operation!}
        category={category}
        sessionStatus={opts.status ?? 'live'}
        autoConfirm={opts.autoConfirm}
        manualRelease={false}
        busy={{}}
        handlers={h}
      />
    </ul>,
  );
  return h;
}

describe('ItemOperationRow (S7-03)', () => {
  it('con auto_confirm desactivado el vendedor da «tuyo» al líder', async () => {
    const h = row({ autoConfirm: false });
    expect(screen.getAllByText('Luis').length).toBeGreaterThan(0);
    expect(screen.getByText(/3 claims ganados/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dar «tuyo»' }));
    expect(h.onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('con auto_confirm activado no hay botón de confirmar', () => {
    row({ autoConfirm: true });
    expect(screen.queryByRole('button', { name: 'Dar «tuyo»' })).toBeNull();
  });

  it('rechazar un claim pide confirmación rápida', async () => {
    const h = row({ autoConfirm: false });
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(h.onReject).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    await userEvent.click(dialog.querySelector('button:not([aria-label])')!);
    expect(h.onReject).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
  });

  it('acepta o rechaza ofertas con su monto', async () => {
    const h = row({ autoConfirm: true });
    expect(screen.getByText(/\$90\.00 de \$150\.00/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aceptar oferta' }));
    expect(h.onAcceptOffer).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar oferta' }));
    expect(h.onRejectOffer).toHaveBeenCalled();
  });

  it('con el evento terminado no hay acciones', () => {
    row({ autoConfirm: false, status: 'ended' });
    expect(screen.queryByRole('button', { name: 'Aceptar oferta' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retirar' })).toBeNull();
  });
});

describe('ConsoleHeader (S7-02, S7-09)', () => {
  const props = (patch = {}) => ({
    session: session({ status: 'live', closes_at: '2026-10-28T02:00:00.000Z' }),
    itemCount: 3,
    nounPlural: 'cartas',
    busy: false,
    now: () => Date.parse('2026-10-26T12:00:00.000Z'),
    onStart: vi.fn(),
    onEnd: vi.fn(),
    onExtend: vi.fn(),
    ...patch,
  });

  it('terminar pide confirmación antes de llamar', async () => {
    const p = props();
    render(<ConsoleHeader {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Terminar claim' }));
    expect(p.onEnd).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Sí, continuar' }));
    expect(p.onEnd).toHaveBeenCalledTimes(1);
  });

  it('un evento programado se puede iniciar', async () => {
    const p = props({ session: session({ status: 'scheduled' }) });
    render(<ConsoleHeader {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar claim' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, continuar' }));
    expect(p.onStart).toHaveBeenCalled();
  });

  it('no deja mover el cierre hacia atrás y sí hacia adelante', async () => {
    const p = props();
    render(<ConsoleHeader {...p} />);
    const input = screen.getByLabelText('Nueva hora de cierre');
    const submit = screen.getByRole('button', { name: 'Extender cierre' });

    await userEvent.type(input, '2026-10-27T10:00');
    await userEvent.click(submit);
    expect(screen.getByText('Elige una hora posterior al cierre actual.')).toBeInTheDocument();
    expect(p.onExtend).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, '2026-10-29T10:00');
    await userEvent.click(submit);
    await userEvent.click(screen.getByRole('button', { name: 'Sí, continuar' }));
    expect(p.onExtend).toHaveBeenCalledWith('2026-10-29T16:00:00.000Z');
  });
});

describe('AnnouncementForm (S7-05)', () => {
  it('se deshabilita fuera de live', () => {
    render(<AnnouncementForm enabled={false} busy={false} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Mensaje para los compradores')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publicar anuncio' })).toBeDisabled();
  });

  it('publica, limita a 200 caracteres y limpia el campo', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<AnnouncementForm enabled busy={false} onSubmit={onSubmit} />);
    const box = screen.getByLabelText('Mensaje para los compradores');
    expect(box).toHaveAttribute('maxlength', '200');
    await userEvent.type(box, 'Salen más cartas');
    await userEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));
    expect(onSubmit).toHaveBeenCalledWith('Salen más cartas');
    expect(box).toHaveValue('');
  });
});
