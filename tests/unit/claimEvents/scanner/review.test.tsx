import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCategory } from '@/types/categories';
import { item } from '../consoleFactories';

vi.mock('@/lib/env.public', () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.test' },
}));

const updateDraft = vi.fn();
vi.mock('@/features/claimEvents/services/scanner/scanner.actions', () => ({
  updateDraftItemAction: (...args: unknown[]) => updateDraft(...args),
  saveCaptureAction: vi.fn(),
}));
const reorder = vi.fn();
const remove = vi.fn();
vi.mock('@/features/claimEvents/services/claimEvents.actions', () => ({
  reorderItemsAction: (...args: unknown[]) => reorder(...args),
  deleteItemAction: (...args: unknown[]) => remove(...args),
}));

const { BatchReview } = await import('@/features/claimEvents/components/BatchReview');
const { PricePanel } = await import('@/features/claimEvents/components/PricePanel');

const category = getCategory('tcg');
const attrs = { language: 'es', condition: 'NM' };
const items = [
  item({
    id: 'a',
    title: 'Carta 1',
    price_cents: 15000,
    image_path: 'u/s/a.webp',
    position: 1,
    attributes: attrs,
  }),
  item({
    id: 'b',
    title: 'Carta 2',
    price_cents: 0,
    image_path: 'u/s/b.webp',
    position: 2,
    attributes: attrs,
  }),
  item({
    id: 'c',
    title: 'Carta 3',
    price_cents: 9900,
    image_path: 'u/s/c.webp',
    position: 3,
    attributes: attrs,
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  updateDraft.mockResolvedValue({ status: 'success' });
  reorder.mockResolvedValue({ status: 'success' });
  remove.mockResolvedValue({ status: 'success' });
});

function review(extra: Partial<React.ComponentProps<typeof BatchReview>> = {}) {
  const props = {
    sessionId: 'session-1',
    category,
    items,
    capturedIds: new Set(['b']),
    onRepeat: vi.fn(),
    onBack: vi.fn(),
    onFinish: vi.fn(),
    ...extra,
  };
  render(<BatchReview {...props} />);
  return props;
}

describe('revisión por lotes', () => {
  it('resume incompletas y marca las nuevas', () => {
    review();
    expect(screen.getByText('3 en total. 1 incompletas.')).toBeInTheDocument();
    const rows = screen.getAllByTestId('review-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText('Incompleta')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Nueva')).toBeInTheDocument();
    expect(within(rows[0]!).queryByText('Incompleta')).toBeNull();
  });

  it('Enter en un campo guarda la fila con los services (edición rápida con teclado)', async () => {
    review();
    const row = screen.getAllByTestId('review-row')[1]!;
    const price = within(row).getByLabelText('Precio');
    await userEvent.type(price, '1550.50{Enter}');
    await waitFor(() => expect(updateDraft).toHaveBeenCalled());
    expect(updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        itemId: 'b',
        price: '1550.50',
        title: 'Carta 2',
      }),
    );
    await waitFor(() => expect(screen.getByText('Cambios guardados: Carta 2')).toBeInTheDocument());
    // El resumen se actualiza: la pieza ya tiene precio.
    expect(screen.getByText('3 en total. Todas completas.')).toBeInTheDocument();
  });

  it('la nota del vendedor se edita en la fila y viaja al guardar', async () => {
    review();
    const row = screen.getAllByTestId('review-row')[0]!;
    await userEvent.type(within(row).getByLabelText('Nota del vendedor'), 'Ana, 2 nov{Enter}');
    await waitFor(() =>
      expect(updateDraft).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: 'a', note: 'Ana, 2 nov' }),
      ),
    );
  });

  it('muestra los errores por campo que devuelve el servidor', async () => {
    updateDraft.mockResolvedValue({
      status: 'error',
      code: 'validation',
      fieldErrors: { price: 'Precio inválido' },
    });
    review();
    const row = screen.getAllByTestId('review-row')[0]!;
    await userEvent.type(within(row).getByLabelText('Precio'), '9{Enter}');
    expect(await within(row).findByText('Precio inválido')).toBeInTheDocument();
  });

  it('reordena con los botones y manda el orden completo del evento', async () => {
    review();
    await userEvent.click(screen.getByRole('button', { name: 'Bajar Carta 1' }));
    await waitFor(() => expect(reorder).toHaveBeenCalledWith('session-1', ['b', 'a', 'c']));
    expect(screen.getAllByTestId('review-row')[0]).toHaveTextContent('Incompleta');
  });

  it('revierte el orden si el servidor falla', async () => {
    reorder.mockResolvedValue({ status: 'error', code: 'reorder_failed' });
    review();
    await userEvent.click(screen.getByRole('button', { name: 'Bajar Carta 1' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(
      (screen.getAllByTestId('review-row')[0]!.querySelector('input') as HTMLInputElement).value,
    ).toBe('Carta 1');
  });

  it('elimina con confirmación', async () => {
    review();
    await userEvent.click(
      within(screen.getAllByTestId('review-row')[2]!).getByRole('button', { name: 'Eliminar' }),
    );
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('session-1', 'c'));
    await waitFor(() => expect(screen.getAllByTestId('review-row')).toHaveLength(2));
  });

  it('al llegar datos nuevos del servidor no reinicia la pantalla, salvo que cambie el conjunto de artículos', async () => {
    const props = {
      sessionId: 'session-1',
      category,
      capturedIds: new Set<string>(),
      onRepeat: vi.fn(),
      onBack: vi.fn(),
      onFinish: vi.fn(),
    };
    const { rerender } = render(<BatchReview {...props} items={items} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bajar Carta 1' }));
    await waitFor(() => expect(reorder).toHaveBeenCalled());
    // Mismos ids (p. ej. tras guardar una edición): se conserva el orden local.
    rerender(<BatchReview {...props} items={items.map((i) => ({ ...i, updated_at: 'otro' }))} />);
    expect(
      (screen.getAllByTestId('review-row')[0]!.querySelector('input') as HTMLInputElement).value,
    ).toBe('Carta 2');
    // Llegó una captura nueva: la lista se toma del servidor.
    rerender(
      <BatchReview
        {...props}
        items={[
          ...items,
          item({
            id: 'd',
            title: 'Carta 4',
            position: 4,
            price_cents: 100,
            image_path: 'u/s/d.webp',
            attributes: attrs,
          }),
        ]}
      />,
    );
    expect(screen.getAllByTestId('review-row')).toHaveLength(4);
  });

  it('repetir captura y terminar avisan al contenedor', async () => {
    const props = review();
    await userEvent.click(
      within(screen.getAllByTestId('review-row')[0]!).getByRole('button', { name: 'Repetir foto' }),
    );
    expect(props.onRepeat).toHaveBeenCalledWith(items[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Terminar y volver al editor' }));
    expect(props.onFinish).toHaveBeenCalled();
  });
});

describe('panel de precio', () => {
  const setup = (canSkip = true) => {
    const handlers = { onDone: vi.fn(), onAdjust: vi.fn(), onRepeat: vi.fn() };
    render(
      <PricePanel
        cropUrl="blob:crop"
        aspect={category.imageAspect}
        canSkip={canSkip}
        {...handlers}
      />,
    );
    return handlers;
  };
  const tap = async (...keys: string[]) => {
    for (const key of keys) await userEvent.click(screen.getByRole('button', { name: key }));
  };

  it('$1,550.50 con el teclado en pantalla guarda 155050', async () => {
    const h = setup();
    await tap('1', '5', '5', '0', 'Punto decimal', '5', '0');
    expect(screen.getByTestId('price-display')).toHaveTextContent('$1,550.50');
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(h.onDone).toHaveBeenCalledWith(155050);
  });

  it('funciona con el teclado físico', async () => {
    const h = setup();
    await userEvent.keyboard('180{Enter}');
    expect(h.onDone).toHaveBeenCalledWith(18000);
  });

  it('omitir precio entrega null', async () => {
    const h = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Omitir precio' }));
    expect(h.onDone).toHaveBeenCalledWith(null);
  });

  it('en un evento publicado no se puede omitir y pide el precio', async () => {
    const h = setup(false);
    expect(screen.queryByRole('button', { name: 'Omitir precio' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(h.onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/escribe el precio/);
  });

  it('borrar y repetir/ajustar llaman a sus manejadores', async () => {
    const h = setup();
    await tap('1', '2', 'Borrar');
    expect(screen.getByTestId('price-display')).toHaveTextContent('$1');
    await userEvent.click(screen.getByRole('button', { name: 'Repetir foto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ajustar recorte' }));
    expect(h.onRepeat).toHaveBeenCalled();
    expect(h.onAdjust).toHaveBeenCalled();
  });
});

describe('baja resolución (requisito 2)', () => {
  it('avisa sin bloquear: "Listo" sigue funcionando', async () => {
    const onDone = vi.fn();
    render(
      <PricePanel
        cropUrl="blob:crop"
        aspect={category.imageAspect}
        canSkip
        lowResolution
        onDone={onDone}
        onAdjust={vi.fn()}
        onRepeat={vi.fn()}
      />,
    );
    expect(screen.getByText(/poca resolución/i)).toBeInTheDocument();
    await userEvent.keyboard('50');
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onDone).toHaveBeenCalledWith(5000);
  });
  it('sin el aviso cuando la resolución alcanza', () => {
    render(
      <PricePanel
        cropUrl="blob:crop"
        aspect={category.imageAspect}
        canSkip
        onDone={vi.fn()}
        onAdjust={vi.fn()}
        onRepeat={vi.fn()}
      />,
    );
    expect(screen.queryByText(/poca resolución/i)).toBeNull();
  });
  it('el ajuste de recorte siempre está a un toque', () => {
    render(
      <PricePanel
        cropUrl="blob:crop"
        aspect={category.imageAspect}
        canSkip
        onDone={vi.fn()}
        onAdjust={vi.fn()}
        onRepeat={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Ajustar recorte' })).toBeInTheDocument();
  });
});
