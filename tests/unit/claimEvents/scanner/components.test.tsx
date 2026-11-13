import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraCapture } from '@/features/claimEvents/components/CameraCapture';
import { CaptureStrip, type StripItem } from '@/features/claimEvents/components/CaptureStrip';
import { CropAdjuster } from '@/features/claimEvents/components/CropAdjuster';
import { useCamera } from '@/features/claimEvents/hooks/useCamera';
import { useThumbnailUrls } from '@/features/claimEvents/hooks/useThumbnailUrls';
import type { Quad } from '@/features/claimEvents/utils/scanner/types';

const aspect = { width: 63, height: 88 };
const labels = { singular: 'carta', plural: 'cartas' };

function fakeStream() {
  const stop = vi.fn();
  const applyConstraints = vi.fn(async () => undefined);
  const track = {
    stop,
    applyConstraints,
    getCapabilities: () => ({ torch: true }),
  } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stop, applyConstraints };
}

function fakeDevices(stream: MediaStream | { reject: unknown }, videoInputs = 2) {
  return {
    getUserMedia: vi.fn(async () => {
      if ('reject' in stream) throw stream.reject;
      return stream;
    }),
    enumerateDevices: vi.fn(async () =>
      Array.from({ length: videoInputs }, () => ({ kind: 'videoinput' })),
    ),
  } as unknown as MediaDevices;
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('useCamera', () => {
  it('pide la cámara trasera y detecta linterna y cambio de cámara', async () => {
    const { stream } = fakeStream();
    const devices = fakeDevices(stream);
    const { result } = renderHook(() => useCamera(devices));
    await act(() => result.current.start());
    expect(devices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({ facingMode: { ideal: 'environment' } }),
      }),
    );
    expect(result.current).toMatchObject({
      status: 'ready',
      torchSupported: true,
      canSwitch: true,
    });
  });

  it('enciende la linterna con applyConstraints', async () => {
    const { stream, applyConstraints } = fakeStream();
    const { result } = renderHook(() => useCamera(fakeDevices(stream)));
    await act(() => result.current.start());
    await act(() => result.current.toggleTorch());
    expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    expect(result.current.torchOn).toBe(true);
  });

  it('cambia de cámara pidiendo la frontal', async () => {
    const { stream } = fakeStream();
    const devices = fakeDevices(stream);
    const { result } = renderHook(() => useCamera(devices));
    await act(() => result.current.start());
    await act(() => result.current.switchCamera());
    expect(devices.getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({ facingMode: { ideal: 'user' } }),
      }),
    );
    expect(result.current.facing).toBe('user');
  });

  it('libera el stream al desmontar', async () => {
    const { stream, stop } = fakeStream();
    const { result, unmount } = renderHook(() => useCamera(fakeDevices(stream)));
    await act(() => result.current.start());
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('sin permiso queda en denied; sin API, en unsupported', async () => {
    const denied = renderHook(() =>
      useCamera(fakeDevices({ reject: new DOMException('no', 'NotAllowedError') })),
    );
    await act(() => denied.result.current.start());
    expect(denied.result.current.status).toBe('denied');
    const none = renderHook(() => useCamera({} as MediaDevices));
    expect(none.result.current.status).toBe('unsupported');
  });
});

describe('CameraCapture', () => {
  it('sin permiso de cámara ofrece elegir archivos con el mismo callback', async () => {
    const onCapture = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
    render(<CameraCapture aspect={aspect} labels={labels} onCapture={onCapture} />);
    expect(screen.getByText(/no permite abrir la cámara/i)).toBeInTheDocument();
    const file = new File(['x'], 'carta.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByTestId('scanner-file-input'), file);
    expect(onCapture).toHaveBeenCalledWith(file);
    vi.unstubAllGlobals();
  });

  it('rechaza archivos que no son imagen permitida', async () => {
    const onCapture = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
    render(<CameraCapture aspect={aspect} labels={labels} onCapture={onCapture} />);
    const input = screen.getByTestId('scanner-file-input') as HTMLInputElement;
    await userEvent.upload(input, new File(['x'], 'a.gif', { type: 'image/gif' }), {
      applyAccept: false,
    });
    expect(onCapture).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/JPG, PNG o WebP/);
    vi.unstubAllGlobals();
  });

  it('el input de archivo usa la cámara trasera y admite varias fotos', () => {
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: undefined });
    render(<CameraCapture aspect={aspect} labels={labels} onCapture={vi.fn()} />);
    const input = screen.getByTestId('scanner-file-input');
    expect(input).toHaveAttribute('capture', 'environment');
    expect(input).toHaveAttribute('multiple');
    vi.unstubAllGlobals();
  });
});

const item = (
  id: string,
  status: StripItem['status'],
  priceCents: number | null = 1000,
): StripItem => ({
  id,
  status,
  priceCents,
});

describe('CaptureStrip', () => {
  const handlers = () => ({ onRetry: vi.fn(), onRepeatLast: vi.fn(), onRemoveLast: vi.fn() });

  it('muestra estado y precio omitido de cada captura', () => {
    render(
      <CaptureStrip
        items={[item('a', 'done'), item('b', 'uploading', null), item('c', 'error')]}
        aspect={aspect}
        labels={labels}
        {...handlers()}
      />,
    );
    expect(screen.getAllByTestId('strip-item')).toHaveLength(3);
    expect(screen.getByText('3 cartas')).toBeInTheDocument();
    expect(screen.getByText('Sin precio')).toBeInTheDocument();
    expect(screen.getByText('lista')).toBeInTheDocument();
    expect(screen.getByText('subiendo')).toBeInTheDocument();
  });

  it('reintenta una captura con error y opera la última por teclado', async () => {
    const h = handlers();
    render(
      <CaptureStrip
        items={[item('a', 'done'), item('b', 'error')]}
        aspect={aspect}
        labels={labels}
        {...h}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
    expect(h.onRetry).toHaveBeenCalledWith('b');
    screen.getByRole('button', { name: 'Repetir la última' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(h.onRepeatLast).toHaveBeenCalled();
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(h.onRemoveLast).toHaveBeenCalled();
  });

  it('anuncia por aria-live los cambios de estado', async () => {
    const h = handlers();
    const { rerender } = render(
      <CaptureStrip items={[item('a', 'uploading')]} aspect={aspect} labels={labels} {...h} />,
    );
    const live = screen.getByRole('status', { name: '' });
    await waitFor(() => expect(live).toHaveTextContent('Subiendo la captura 1.'));
    rerender(<CaptureStrip items={[item('a', 'done')]} aspect={aspect} labels={labels} {...h} />);
    await waitFor(() => expect(live).toHaveTextContent('La captura 1 está lista.'));
    rerender(<CaptureStrip items={[item('a', 'error')]} aspect={aspect} labels={labels} {...h} />);
    await waitFor(() => expect(live).toHaveTextContent(/no se pudo subir/));
  });

  it('avisa cuando no hay conexión y cuántas faltan por subir', () => {
    render(
      <CaptureStrip
        items={[item('a', 'queued'), item('b', 'queued')]}
        aspect={aspect}
        labels={labels}
        offline
        {...handlers()}
      />,
    );
    expect(screen.getByText(/Sin conexión/)).toBeInTheDocument();
    expect(screen.getByText('Faltan por subir 2 capturas.')).toBeInTheDocument();
  });

  it('lista vacía y etiquetas de otra categoría', () => {
    render(
      <CaptureStrip
        items={[]}
        aspect={aspect}
        labels={{ singular: 'pieza', plural: 'piezas' }}
        {...handlers()}
      />,
    );
    expect(screen.getByText('Aún no hay capturas.')).toBeInTheDocument();
    expect(screen.getByText('0 piezas')).toBeInTheDocument();
  });
});

describe('useThumbnailUrls: sin fugas con 60 capturas', () => {
  it('crea una URL por captura y las revoca al quitarlas y al desmontar', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test/${created.length}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => void revoked.push(url));
    const ids = Array.from({ length: 60 }, (_, i) => `c${i}`);
    const load = vi.fn(async () => new Blob(['x']));
    const { result, rerender, unmount } = renderHook(({ list }) => useThumbnailUrls(list, load), {
      initialProps: { list: ids },
    });
    await waitFor(() => expect(Object.keys(result.current)).toHaveLength(60));
    expect(created).toHaveLength(60);
    rerender({ list: ids.slice(0, 50) });
    await waitFor(() => expect(revoked).toHaveLength(10));
    expect(load).toHaveBeenCalledTimes(60); // no vuelve a leer lo que ya tiene
    unmount();
    expect(revoked).toHaveLength(60);
    expect(new Set(revoked)).toEqual(new Set(created));
  });
});

describe('CropAdjuster', () => {
  const corners: Quad = [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ];

  it('tiene 4 esquinas operables con teclado', async () => {
    const onChange = vi.fn();
    render(
      <CropAdjuster imageUrl="blob:x" imageAspect={0.75} corners={corners} onChange={onChange} />,
    );
    const handles = screen.getAllByRole('button');
    expect(handles).toHaveLength(4);
    handles[0]!.focus();
    await userEvent.keyboard('{ArrowRight}');
    const next = onChange.mock.calls[0]![0] as Quad;
    expect(next[0].x).toBeCloseTo(0.105, 6);
    expect(next[1]).toEqual(corners[1]);
  });

  it('no deja salir las esquinas de la foto', async () => {
    const onChange = vi.fn();
    const edge: Quad = [{ x: 0, y: 0 }, corners[1], corners[2], corners[3]];
    render(
      <CropAdjuster imageUrl="blob:x" imageAspect={0.75} corners={edge} onChange={onChange} />,
    );
    screen.getAllByRole('button')[0]!.focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect((onChange.mock.calls[0]![0] as Quad)[0]).toEqual({ x: 0, y: 0 });
  });
});

describe('cámara en vivo en iOS', () => {
  it('prepara el video como lo exige Safari: playsinline y muted como atributos', async () => {
    const { stream } = fakeStream();
    const devices = fakeDevices(stream);
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 640 });
    const { result } = renderHook(() => useCamera(devices));
    result.current.videoRef.current = video;
    await act(() => result.current.start());
    expect(video.getAttribute('playsinline')).toBe('');
    expect(video.hasAttribute('muted')).toBe(true);
    expect(video.muted).toBe(true);
  });

  it('un cuadro sin dimensiones no se entrega como foto', async () => {
    const { stream } = fakeStream();
    const video = document.createElement('video'); // videoWidth = 0, como antes de loadedmetadata
    const { result } = renderHook(() => useCamera(fakeDevices(stream)));
    result.current.videoRef.current = video;
    expect(await result.current.capture()).toBeNull();
  });

  it('resume: si la pista terminó (iOS en segundo plano) reabre la cámara', async () => {
    const first = fakeStream();
    const second = fakeStream();
    const devices = fakeDevices(first.stream);
    (devices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 640 });
    const { result } = renderHook(() => useCamera(devices));
    result.current.videoRef.current = video;
    await act(() => result.current.start());
    (first.stream.getVideoTracks()[0] as unknown as { readyState: string }).readyState = 'ended';
    await act(() => result.current.resume());
    expect(devices.getUserMedia).toHaveBeenCalledTimes(2);
  });
});

describe('guía de encuadre en vivo (requisito 1)', () => {
  const rect = (x: number, y: number, w: number, h: number) =>
    ({
      left: x,
      top: y,
      width: w,
      height: h,
      right: x + w,
      bottom: y + h,
      x,
      y,
      toJSON: () => ({}),
    }) as DOMRect;

  async function renderReady(
    detect: (frame: ImageBitmap) => Promise<{ corners: Quad; confidence: number } | null>,
  ) {
    const { stream } = fakeStream();
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: fakeDevices(stream) });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({ close: vi.fn() })),
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.fit !== undefined ? rect(100, 50, 200, 280) : rect(0, 0, 400, 400);
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get: () => 400,
    });
    render(
      <CameraCapture aspect={aspect} labels={labels} onCapture={vi.fn()} detectFrame={detect} />,
    );
    await screen.findByTestId('fit-hint');
  }

  const quadAt = (x0: number, y0: number, x1: number, y1: number): Quad => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];

  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('dice "encaja" cuando la pieza llena el marco', async () => {
    await renderReady(async () => ({
      corners: quadAt(0.25, 0.125, 0.75, 0.825),
      confidence: 0.95,
    }));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByTestId('fit-hint')).toHaveTextContent('Encaja');
  });

  it('dice "acércate" cuando la pieza es pequeña', async () => {
    await renderReady(async () => ({ corners: quadAt(0.4, 0.35, 0.6, 0.65), confidence: 0.95 }));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByTestId('fit-hint')).toHaveTextContent('Acércate');
  });

  it('dice "endereza" cuando la pieza está girada', async () => {
    await renderReady(async () => ({
      corners: [
        { x: 0.3, y: 0.13 },
        { x: 0.78, y: 0.22 },
        { x: 0.7, y: 0.85 },
        { x: 0.22, y: 0.76 },
      ],
      confidence: 0.95,
    }));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByTestId('fit-hint')).toHaveTextContent('Endereza');
  });

  it('sin detección confiable orienta de forma neutral, sin alarma', async () => {
    await renderReady(async () => ({ corners: quadAt(0.25, 0.125, 0.75, 0.825), confidence: 0.3 }));
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.getByTestId('fit-hint')).toHaveTextContent('Acerca la pieza al marco');
  });

  it('el mensaje exige dos muestras iguales seguidas (no parpadea)', async () => {
    const answers = [quadAt(0.4, 0.35, 0.6, 0.65), quadAt(0.25, 0.125, 0.75, 0.825)];
    let i = 0;
    await renderReady(async () => ({ corners: answers[i++ % 2]!, confidence: 0.95 }));
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(screen.getByTestId('fit-hint')).toHaveTextContent('Acerca la pieza al marco');
  });
});
