import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeImage } from '@/features/claimEvents/services/scanner/decodeImage';
import { ScannerImageError } from '@/features/claimEvents/services/scanner/scannerImage';
import { encodeWithFallback, type CanvasEncoder } from '@/features/claimEvents/utils/scanner/encode';
import {
  ITEM_IMAGE_MAX_BYTES,
  isItemImageOutputType,
  itemImagePath,
} from '@/features/claimEvents/utils/image';

const blob = (type: string, size = 100) => new Blob([new Uint8Array(size)], { type });

describe('encodeWithFallback (Safari no codifica WebP)', () => {
  it('navegador con WebP: usa WebP', async () => {
    const encode = vi.fn<CanvasEncoder>(async (type) => blob(type));
    const result = await encodeWithFallback(encode);
    expect(result).toMatchObject({ ok: true, type: 'image/webp', webpSupported: true });
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it('Safari: pedir WebP devuelve PNG → cae a JPEG sin fallar', async () => {
    const encode = vi.fn<CanvasEncoder>(async (type) => (type === 'image/webp' ? blob('image/png') : blob('image/jpeg')));
    const result = await encodeWithFallback(encode);
    expect(result).toMatchObject({ ok: true, type: 'image/jpeg', webpSupported: false });
    expect(result.ok && result.blob.type).toBe('image/jpeg');
    // No insiste con WebP una vez que sabe que no lo soporta.
    expect(encode.mock.calls.filter(([type]) => type === 'image/webp')).toHaveLength(1);
  });

  it('baja la calidad hasta caber en 5 MB', async () => {
    const sizes = [ITEM_IMAGE_MAX_BYTES + 1, ITEM_IMAGE_MAX_BYTES + 1, ITEM_IMAGE_MAX_BYTES - 1];
    let call = 0;
    const result = await encodeWithFallback(async (type) => blob(type, sizes[call++] ?? 10));
    expect(result).toMatchObject({ ok: true, type: 'image/webp' });
    expect(call).toBe(3);
  });

  it('WebP pesado en todas las calidades pasa a JPEG', async () => {
    const result = await encodeWithFallback(async (type) =>
      blob(type, type === 'image/webp' ? ITEM_IMAGE_MAX_BYTES + 1 : 1000),
    );
    expect(result).toMatchObject({ ok: true, type: 'image/jpeg', webpSupported: true });
  });

  it('nada cabe: too_large; el navegador no entrega nada útil: unsupported', async () => {
    expect(await encodeWithFallback(async (type) => blob(type, ITEM_IMAGE_MAX_BYTES + 1))).toMatchObject({
      ok: false,
      reason: 'too_large',
    });
    expect(await encodeWithFallback(async () => null)).toMatchObject({ ok: false, reason: 'unsupported' });
    expect(await encodeWithFallback(async () => blob('image/png'))).toMatchObject({ ok: false, reason: 'unsupported' });
  });
});

describe('formatos de salida', () => {
  it('WebP y JPEG se aceptan; PNG, GIF y otros no', () => {
    expect(isItemImageOutputType('image/webp')).toBe(true);
    expect(isItemImageOutputType('image/jpeg')).toBe(true);
    expect(isItemImageOutputType('image/png')).toBe(false);
    expect(isItemImageOutputType('')).toBe(false);
  });
  it('la ruta lleva la extensión del formato', () => {
    expect(itemImagePath('u', 's', 'id')).toBe('u/s/id.webp');
    expect(itemImagePath('u', 's', 'id', 'image/jpeg')).toBe('u/s/id.jpg');
  });
});

describe('decodeImage', () => {
  afterEach(() => vi.unstubAllGlobals());
  const bitmap = { width: 4, height: 3 } as ImageBitmap;

  it('pide la orientación EXIF', async () => {
    const create = vi.fn(async () => bitmap);
    vi.stubGlobal('createImageBitmap', create);
    await decodeImage(blob('image/jpeg'));
    expect(create).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' });
  });

  it('un navegador que rechaza la opción reintenta sin ella', async () => {
    const create = vi.fn(async (_source: unknown, options?: unknown) => {
      if (options) throw new TypeError('imageOrientation inválido');
      return bitmap;
    });
    vi.stubGlobal('createImageBitmap', create);
    await expect(decodeImage(blob('image/jpeg'))).resolves.toBe(bitmap);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('formato que createImageBitmap no abre: prueba con <img>', async () => {
    const create = vi.fn(async (source: unknown) => {
      if (source instanceof Blob) throw new DOMException('no decodable', 'InvalidStateError');
      return bitmap;
    });
    vi.stubGlobal('createImageBitmap', create);
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', FakeImage);
    await expect(decodeImage(blob('image/avif'))).resolves.toBe(bitmap);
  });

  it('si nada la abre: decode_failed con el detalle de la causa', async () => {
    vi.stubGlobal('createImageBitmap', async () => {
      throw new DOMException('The source image could not be decoded.', 'InvalidStateError');
    });
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
    class BrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', BrokenImage);
    const error = await decodeImage(blob('image/heic', 1234)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScannerImageError);
    expect(error).toMatchObject({ code: 'decode_failed' });
    expect((error as ScannerImageError).detail).toContain('image/heic');
    expect((error as ScannerImageError).detail).toContain('1234 B');
  });
});

describe('endurecimiento para Safari/iOS', () => {
  it('randomId: UUID v4 aunque no exista crypto.randomUUID', async () => {
    const { randomId } = await import('@/features/claimEvents/services/scanner/captureQueue');
    const original = crypto.randomUUID;
    // @ts-expect-error se emula Safari < 15.4
    crypto.randomUUID = undefined;
    try {
      const ids = new Set(Array.from({ length: 50 }, () => randomId()));
      expect(ids.size).toBe(50);
      for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      crypto.randomUUID = original;
    }
  });

  it('almacén resiliente: si IndexedDB falla, la cola sigue en memoria sin perder la captura', async () => {
    const { createResilientCaptureStore } = await import('@/features/claimEvents/services/scanner/captureStore');
    const broken = {
      put: async () => {
        throw new DOMException('QuotaExceededError');
      },
      get: async () => {
        throw new Error('no');
      },
      listBySession: async () => {
        throw new Error('no');
      },
      delete: async () => {
        throw new Error('no');
      },
      deleteBySession: async () => {
        throw new Error('no');
      },
    };
    const store = createResilientCaptureStore(() => broken);
    const record = { id: 'a', sessionId: 's', blob: new Blob(['x']) } as never;
    await expect(store.put(record)).resolves.toBeUndefined();
    expect(await store.get('a')).toBe(record);
    expect(await store.listBySession('s')).toHaveLength(1);
  });

  it('almacén resiliente: si ni siquiera se puede abrir IndexedDB, usa memoria', async () => {
    const { createResilientCaptureStore } = await import('@/features/claimEvents/services/scanner/captureStore');
    const store = createResilientCaptureStore(() => {
      throw new Error('indexedDB bloqueado');
    });
    await store.put({ id: 'a', sessionId: 's', blob: new Blob(['x']) } as never);
    expect(await store.listBySession('s')).toHaveLength(1);
  });
});
