import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PiecesReview, type ReviewPiece } from '@/features/claimEvents/components/PiecesReview';
import { CameraCapture } from '@/features/claimEvents/components/CameraCapture';
import {
  createCaptureQueue,
  type Uploader,
} from '@/features/claimEvents/services/scanner/captureQueue';
import { createMemoryCaptureStore } from '@/features/claimEvents/services/scanner/captureStore';
import { pickRunnable, type CaptureEntry } from '@/features/claimEvents/utils/scanner/queue';
import { captureInputSchema } from '@/features/claimEvents/utils/scanner/draft.schemas';
import type { Quad } from '@/features/claimEvents/utils/scanner/types';

vi.mock('@/lib/env.public', () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.test' },
}));

const quadAt = (x: number, y: number): Quad => [
  { x, y },
  { x: x + 0.2, y },
  { x: x + 0.2, y: y + 0.28 },
  { x, y: y + 0.28 },
];
const piece = (id: string, x: number, y: number, valid = true): ReviewPiece => ({
  id,
  corners: quadAt(x, y),
  valid,
});

function setup(pieces: ReviewPiece[], warnings: ('touching' | 'none_found')[] = []) {
  const handlers = {
    onCornersChange: vi.fn(),
    onRemove: vi.fn(),
    onAdd: vi.fn(() => 'new-id'),
    onRetake: vi.fn(),
    onConfirm: vi.fn(),
  };
  render(
    <PiecesReview
      imageUrl="blob:photo"
      imageAspect={1}
      pieces={pieces}
      warnings={warnings}
      {...handlers}
    />,
  );
  return handlers;
}

describe('PiecesReview (S11-19)', () => {
  const six = [
    piece('a', 0.05, 0.05),
    piece('b', 0.3, 0.05),
    piece('c', 0.55, 0.05),
    piece('d', 0.05, 0.5),
    piece('e', 0.3, 0.5),
    piece('f', 0.55, 0.5),
  ];

  it('muestra las piezas numeradas y permite confirmarlas', async () => {
    const h = setup(six);
    expect(
      screen.getByRole('heading', { name: /Piezas detectadas \(6 piezas\)/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('piece-row')).toHaveLength(6);
    // Cinco números sobre la foto (la pieza seleccionada se edita con sus esquinas).
    for (const n of [2, 3, 4, 5, 6])
      expect(screen.getByRole('button', { name: `Seleccionar la pieza ${n}` })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar 6 piezas' }));
    expect(h.onConfirm).toHaveBeenCalled();
  });

  it('seleccionar otra pieza por su número cambia la que se ajusta (4 esquinas, teclado)', async () => {
    const h = setup(six);
    await userEvent.click(screen.getByRole('button', { name: 'Seleccionar la pieza 3' }));
    const handle = screen.getAllByRole('button', { name: /Esquina 1 de 4/ })[0]!;
    handle.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(h.onCornersChange).toHaveBeenCalledWith('c', expect.any(Array));
    expect((h.onCornersChange.mock.calls[0]![1] as Quad)[0].x).toBeCloseTo(0.555, 6);
  });

  it('quita una detección falsa', async () => {
    const h = setup(six);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Pieza 4' }));
    expect(h.onRemove).toHaveBeenCalledWith('d');
  });

  it('añade una pieza a mano', async () => {
    const h = setup(six);
    await userEvent.click(screen.getByRole('button', { name: 'Añadir una pieza' }));
    expect(h.onAdd).toHaveBeenCalled();
  });

  it('una pieza por revisar bloquea la confirmación hasta ajustarla o quitarla', () => {
    setup([piece('a', 0.05, 0.05), piece('b', 0.4, 0.4, false)], ['touching']);
    expect(screen.getByRole('button', { name: 'Confirmar 2 piezas' })).toBeDisabled();
    expect(screen.getByText('Por revisar')).toBeInTheDocument();
    expect(screen.getByText(/Ajusta o quita las piezas marcadas/)).toBeInTheDocument();
    expect(screen.getByText(/se tocan o no se distinguen/)).toBeInTheDocument();
  });

  it('sin piezas: mensaje y confirmar deshabilitado; repetir la foto', async () => {
    const h = setup([], ['none_found']);
    expect(screen.getByText(/No hay piezas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Repetir la foto' }));
    expect(h.onRetake).toHaveBeenCalled();
  });
});

describe('alternancia "Varias piezas" en la cámara', () => {
  const props = {
    aspect: { width: 63, height: 88 },
    labels: { singular: 'carta', plural: 'cartas' },
    onCapture: vi.fn(),
  };
  it('una pieza es el modo por defecto y se puede cambiar', async () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
    const onModeChange = vi.fn();
    render(<CameraCapture {...props} mode="single" onModeChange={onModeChange} />);
    const group = screen.getByRole('group', { name: 'Tipo de foto' });
    expect(within(group).getByRole('button', { name: 'Una pieza' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Varias piezas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await userEvent.click(within(group).getByRole('button', { name: 'Varias piezas' }));
    expect(onModeChange).toHaveBeenCalledWith('multi');
    vi.unstubAllGlobals();
  });
  it('sin onModeChange no se muestra la alternancia', () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
    render(<CameraCapture {...props} />);
    expect(screen.queryByRole('group', { name: 'Tipo de foto' })).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('cola: piezas de una misma foto', () => {
  const entry = (id: string, over: Partial<CaptureEntry> = {}): CaptureEntry => ({
    id,
    sessionId: 's',
    status: 'queued',
    priceCents: null,
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: Number(id.split('-').pop()),
    itemId: null,
    replaceItemId: null,
    errorCode: null,
    ...over,
  });

  it('una pieza espera a la anterior de su foto aunque haya subidas libres', () => {
    const list = [
      entry('p-1'),
      entry('p-2', { after: 'p-1' }),
      entry('p-3', { after: 'p-2' }),
      entry('suelta-4'),
    ];
    expect(pickRunnable(list, 100).map((e) => e.id)).toEqual(['p-1', 'suelta-4']);
  });
  it('al terminar la anterior, la siguiente corre; si la anterior ya no está, no espera', () => {
    const list = [
      entry('p-1', { status: 'done' }),
      entry('p-2', { after: 'p-1' }),
      entry('p-4', { after: 'borrada' }),
    ];
    expect(pickRunnable(list, 100).map((e) => e.id)).toEqual(['p-2', 'p-4']);
  });
  it('una anterior con error bloquea a las siguientes hasta reintentarla', () => {
    const list = [entry('p-1', { status: 'error' }), entry('p-2', { after: 'p-1' })];
    expect(pickRunnable(list, 100)).toEqual([]);
  });

  it('las piezas suben en orden, una a la vez, con ids derivados <fotoId>-<n>', async () => {
    vi.useFakeTimers();
    try {
      const order: string[] = [];
      const upload: Uploader = async (e) => {
        order.push(e.id);
        await new Promise((r) => setTimeout(r, 10));
        return { itemId: `item-${e.id}` };
      };
      const queue = createCaptureQueue({ store: createMemoryCaptureStore(), upload });
      const blob = () => new Blob(['x'], { type: 'image/webp' });
      const photo = '11111111-1111-4111-8111-111111111111';
      for (let n = 1; n <= 4; n += 1) {
        await queue.add({
          sessionId: 's',
          blob: blob(),
          priceCents: n * 100,
          id: `${photo}-${n}`,
          after: n > 1 ? `${photo}-${n - 1}` : null,
        });
        vi.setSystemTime(Date.now() + 1);
      }
      await vi.advanceTimersByTimeAsync(200);
      expect(order).toEqual([1, 2, 3, 4].map((n) => `${photo}-${n}`));
      expect(queue.snapshot().every((e) => e.status === 'done')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('un reintento reutiliza el mismo id (no duplica)', async () => {
    const photo = '22222222-2222-4222-8222-222222222222';
    expect(
      captureInputSchema.safeParse({
        sessionId: '11111111-1111-4111-8111-111111111111',
        captureId: `${photo}-3`,
        priceCents: '',
      }).success,
    ).toBe(true);
    expect(
      captureInputSchema.safeParse({
        sessionId: '11111111-1111-4111-8111-111111111111',
        captureId: `${photo}-123`,
        priceCents: '',
      }).success,
    ).toBe(false);
    expect(
      captureInputSchema.safeParse({
        sessionId: '11111111-1111-4111-8111-111111111111',
        captureId: 'no-uuid-3',
        priceCents: '',
      }).success,
    ).toBe(false);
    await waitFor(() => undefined);
  });
});
