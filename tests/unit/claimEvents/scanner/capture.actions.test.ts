import { beforeEach, describe, expect, it, vi } from 'vitest';
import { session } from '../consoleFactories';
import { item } from '../consoleFactories';

const getWithItems = vi.fn();
const findByImagePath = vi.fn();
const create = vi.fn();
const update = vi.fn();
vi.mock('@/features/claimEvents/services/claimSession.service', () => ({
  claimSessionService: { getWithItems: (...a: unknown[]) => getWithItems(...a) },
}));
vi.mock('@/features/claimEvents/services/claimItem.service', () => ({
  claimItemService: {
    findByImagePath: (...a: unknown[]) => findByImagePath(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
  },
}));
vi.mock('@/features/claimEvents/services/seller.context', () => ({
  requireSellerId: async () => 'seller-1',
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { saveCaptureAction, updateDraftItemAction } =
  await import('@/features/claimEvents/services/scanner/scanner.actions');
const { uploadCapture } = await import('@/features/claimEvents/services/scanner/uploader.client');

const SESSION = '11111111-1111-4111-8111-111111111111';
const CAPTURE = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';

const form = (over: Record<string, string | File> = {}) => {
  const data = new FormData();
  const base = {
    sessionId: SESSION,
    captureId: CAPTURE,
    priceCents: '155050',
    image: new File(['x'], 'item.webp', { type: 'image/webp' }),
    ...over,
  };
  for (const [k, v] of Object.entries(base)) data.set(k, v);
  return data;
};
const open = (status = 'draft', items: unknown[] = []) =>
  getWithItems.mockResolvedValue({
    ...session({ id: SESSION, status: status as never, category: 'tcg' }),
    items,
  });

beforeEach(() => {
  vi.clearAllMocks();
  findByImagePath.mockResolvedValue(null);
  create.mockImplementation(async (_u, _s, input) => ({ id: ITEM, ...input }));
});

describe('saveCaptureAction (S11-05)', () => {
  it('crea el borrador oculto con precio, título por categoría y atributos de borrador', async () => {
    open();
    const result = await saveCaptureAction(form());
    expect(result).toEqual({ status: 'success', itemId: ITEM });
    const [userId, sessionId, input, , imageId] = create.mock.calls[0]!;
    expect(userId).toBe('seller-1');
    expect(sessionId).toBe(SESSION);
    expect(input).toMatchObject({
      title: 'Carta 1',
      price_cents: 155050,
      category: 'tcg',
      is_preview: false,
    });
    expect(input.attributes).toEqual({ language: 'es', condition: 'NM' });
    expect(imageId).toBe(CAPTURE);
  });

  it('la posición y el título siguen a los artículos existentes', async () => {
    open('draft', [item({ id: 'x', position: 7 })]);
    await saveCaptureAction(form());
    expect(create.mock.calls[0]![2].title).toBe('Carta 8');
  });

  it('sin precio en borrador guarda 0 (incompleto)', async () => {
    open();
    await saveCaptureAction(form({ priceCents: '' }));
    expect(create.mock.calls[0]![2].price_cents).toBe(0);
  });

  it('sin precio en un evento programado se rechaza', async () => {
    open('scheduled');
    expect(await saveCaptureAction(form({ priceCents: '' }))).toMatchObject({
      status: 'error',
      code: 'validation',
      retryable: false,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('acepta el JPEG de respaldo (navegador sin WebP) y lo manda al service con su tipo', async () => {
    open();
    const jpeg = new File(['x'], 'item.jpg', { type: 'image/jpeg' });
    expect(await saveCaptureAction(form({ image: jpeg }))).toEqual({ status: 'success', itemId: ITEM });
    expect(create.mock.calls[0]![3].type).toBe('image/jpeg');
  });

  it('es idempotente: un reintento devuelve el artículo ya creado', async () => {
    open();
    findByImagePath.mockResolvedValue({ id: 'already' });
    expect(await saveCaptureAction(form())).toEqual({ status: 'success', itemId: 'already' });
    expect(findByImagePath).toHaveBeenCalledWith(SESSION, [
      `seller-1/${SESSION}/${CAPTURE}.webp`,
      `seller-1/${SESSION}/${CAPTURE}.jpg`,
    ]);
    expect(create).not.toHaveBeenCalled();
  });

  it('rechaza eventos no editables, imágenes que no son WebP y datos inválidos', async () => {
    open('live');
    expect(await saveCaptureAction(form())).toMatchObject({
      code: 'invalid_state',
      retryable: false,
    });
    open();
    expect(
      await saveCaptureAction(form({ image: new File(['x'], 'a.png', { type: 'image/png' }) })),
    ).toMatchObject({ code: 'image_type' });
    expect(await saveCaptureAction(form({ captureId: 'no-uuid' }))).toMatchObject({
      code: 'validation',
    });
    expect(await saveCaptureAction(form({ priceCents: '-5' }))).toMatchObject({
      code: 'validation',
    });
    getWithItems.mockResolvedValue(null);
    expect(await saveCaptureAction(form())).toMatchObject({ code: 'not_found' });
  });

  it('un error inesperado del service es reintentable', async () => {
    open();
    create.mockRejectedValue(new Error('boom'));
    expect(await saveCaptureAction(form())).toMatchObject({
      status: 'error',
      code: 'unknown',
      retryable: true,
    });
  });

  it('repetir captura reemplaza la imagen conservando precio y título', async () => {
    open('draft', [
      item({
        id: ITEM,
        title: 'Mew',
        price_cents: 42000,
        position: 1,
        attributes: { language: 'es', condition: 'NM' },
      }),
    ]);
    const result = await saveCaptureAction(form({ replaceItemId: ITEM, priceCents: '' }));
    expect(result).toEqual({ status: 'success', itemId: ITEM });
    expect(update.mock.calls[0]![2]).toMatchObject({ title: 'Mew', price_cents: 42000 });
    expect(update.mock.calls[0]![2]).not.toHaveProperty('seller_note'); // repetir la foto no toca la nota
    expect(create).not.toHaveBeenCalled();
  });
});

describe('updateDraftItemAction (S11-08)', () => {
  const input = (over = {}) => ({
    sessionId: SESSION,
    itemId: ITEM,
    title: ' Pikachu ex ',
    price: '650',
    attributes: { language: 'es', condition: 'LP', set_name: '', collector_number: '' },
    ...over,
  });

  it('guarda título, precio en centavos y atributos de la categoría', async () => {
    open('draft', [item({ id: ITEM })]);
    expect(await updateDraftItemAction(input())).toEqual({ status: 'success' });
    expect(update.mock.calls[0]![2]).toEqual({
      title: 'Pikachu ex',
      price_cents: 65000,
      is_preview: false,
      seller_note: null,
      attributes: { language: 'es', condition: 'LP' },
    });
  });

  it('guarda la nota del vendedor (vacía = sin nota) fuera de la imagen', async () => {
    open('draft', [item({ id: ITEM })]);
    await updateDraftItemAction(input({ note: ' Cartas del Centro, 2 nov ' }));
    expect(update.mock.calls[0]![2].seller_note).toBe('Cartas del Centro, 2 nov');
    await updateDraftItemAction(input({ note: '   ' }));
    expect(update.mock.calls[1]![2].seller_note).toBeNull();
    expect(await updateDraftItemAction(input({ note: 'x'.repeat(81) }))).toMatchObject({
      status: 'error',
      code: 'validation',
    });
  });

  it('precio vacío = incompleto, solo en borrador', async () => {
    open('draft', [item({ id: ITEM })]);
    expect(await updateDraftItemAction(input({ price: '' }))).toEqual({ status: 'success' });
    expect(update.mock.calls[0]![2].price_cents).toBe(0);
    open('scheduled', [item({ id: ITEM })]);
    expect(await updateDraftItemAction(input({ price: '' }))).toMatchObject({
      status: 'error',
      code: 'validation',
    });
  });

  it('valida atributos y título', async () => {
    open('draft', [item({ id: ITEM })]);
    const bad = await updateDraftItemAction(
      input({ title: '', attributes: { language: '', condition: 'NM' } }),
    );
    expect(bad).toMatchObject({ status: 'error', code: 'validation' });
    expect(bad.fieldErrors).toMatchObject({ title: expect.any(String) });
  });
});

describe('uploadCapture (cliente → Server Action)', () => {
  const entry = { id: CAPTURE, sessionId: SESSION, priceCents: 9900, replaceItemId: null } as never;
  it('arma el FormData con la captura y devuelve el artículo', async () => {
    open();
    const result = await uploadCapture(entry, new Blob(['x'], { type: 'image/webp' }));
    expect(result.itemId).toBe(ITEM);
    expect(create.mock.calls[0]![2].price_cents).toBe(9900);
  });
  it('un error no reintentable se propaga como tal', async () => {
    open('live');
    await expect(uploadCapture(entry, new Blob(['x'], { type: 'image/webp' }))).rejects.toMatchObject({
      code: 'invalid_state',
      retryable: false,
    });
  });
});
