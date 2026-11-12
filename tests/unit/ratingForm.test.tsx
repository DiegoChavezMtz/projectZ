import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const submitRatingAction = vi.fn();
vi.mock('@/features/reputation/services/rating.actions', () => ({
  submitRatingAction: (...args: unknown[]) => submitRatingAction(...args),
}));

import { RatingForm } from '@/features/reputation/components/RatingForm';
import { HistoryList } from '@/features/reputation/components/HistoryList';
import type { HistoryEntry } from '@/features/reputation/types';

const props = {
  orderId: '8f14e45f-ceea-467f-a0e6-5c0e7a0c1b11',
  counterpartyName: 'Cartas del Centro',
  sessionTitle: 'Claim de viernes',
  rateUntil: '2026-11-20T18:00:00Z',
  next: '/orders',
};

beforeEach(() => submitRatingAction.mockReset());

describe('RatingForm', () => {
  it('sin estrellas muestra el error y no envía', async () => {
    render(<RatingForm {...props} myRole="buyer" />);
    await userEvent.click(screen.getByRole('button', { name: 'Enviar calificación' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elige de 1 a 5 estrellas');
    expect(submitRatingAction).not.toHaveBeenCalled();
  });

  it('el comprador ve etiquetas de vendedor y el vendedor las de comprador', () => {
    const { unmount } = render(<RatingForm {...props} myRole="buyer" />);
    expect(screen.getByLabelText('Empaque cuidadoso')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pago rápido')).toBeNull();
    unmount();
    render(<RatingForm {...props} myRole="seller" />);
    expect(screen.getByLabelText('Pago rápido')).toBeInTheDocument();
    expect(screen.queryByLabelText('Empaque cuidadoso')).toBeNull();
  });

  it('envía estrellas, etiquetas y comentario; al terminar agradece', async () => {
    submitRatingAction.mockResolvedValue({ ok: true });
    render(<RatingForm {...props} myRole="buyer" />);
    await userEvent.click(screen.getByRole('radio', { name: '4 estrellas' }));
    await userEvent.click(screen.getByLabelText('Envío rápido'));
    await userEvent.type(screen.getByLabelText('Comentario (opcional)'), 'Muy bien');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar calificación' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Gracias por calificar'),
    );
    expect(submitRatingAction).toHaveBeenCalledWith(
      { orderId: props.orderId, stars: 4, tags: ['envio_rapido'], comment: 'Muy bien' },
      '/orders',
    );
  });

  it('muestra el mensaje del servidor si falla', async () => {
    submitRatingAction.mockResolvedValue({
      ok: false,
      code: 'already_exists',
      message: 'Ya calificaste esta cuenta.',
    });
    render(<RatingForm {...props} myRole="buyer" />);
    await userEvent.click(screen.getByRole('radio', { name: '5 estrellas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar calificación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya calificaste esta cuenta.');
  });
});

describe('HistoryList', () => {
  const entry = (patch: Partial<HistoryEntry>): HistoryEntry => ({
    id: 'e1',
    role: 'buyer',
    kind: 'unpaid',
    status: 'disputed',
    sessionCode: 'ABC123',
    sessionTitle: 'Claim de viernes',
    counterpartyHandle: 'tienda',
    counterpartyName: 'Tienda',
    hours: null,
    method: null,
    stars: null,
    tags: [],
    comment: null,
    releaseReason: null,
    disputeNote: 'Pagué en efectivo',
    disputeResolutionNote: null,
    occurredAt: '2026-10-27T12:00:00Z',
    ...patch,
  });

  it('cada entrada enlaza a su claim y las disputadas muestran la nota', () => {
    render(
      <HistoryList handle="luis" history={{ entries: [entry({})], page: 1, hasMore: false }} />,
    );
    expect(screen.getByRole('link', { name: 'Claim de viernes' })).toHaveAttribute(
      'href',
      '/c/ABC123',
    );
    expect(screen.getByText('En disputa')).toBeInTheDocument();
    expect(screen.getByText(/Pagué en efectivo/)).toBeInTheDocument();
  });

  it('filtro por rol y paginación conservan el estado en la URL', () => {
    render(
      <HistoryList
        handle="luis"
        role="seller"
        history={{
          entries: [entry({ status: 'active', disputeNote: null })],
          page: 2,
          hasMore: true,
        }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Como vendedor' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Ver más' })).toHaveAttribute(
      'href',
      '/u/luis?role=seller&page=3',
    );
    expect(screen.getByRole('link', { name: 'Anteriores' })).toHaveAttribute(
      'href',
      '/u/luis?role=seller',
    );
  });

  it('sin entradas muestra el estado vacío', () => {
    render(<HistoryList handle="luis" history={{ entries: [], page: 1, hasMore: false }} />);
    expect(screen.getByText('Aún no hay historial.')).toBeInTheDocument();
  });
});
