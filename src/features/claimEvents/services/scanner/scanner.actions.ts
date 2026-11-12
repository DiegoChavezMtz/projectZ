'use server';

import { revalidatePath } from 'next/cache';
import { getCategory } from '@/types/categories';
import { AppError } from '@/utils/errors';
import { scannerContent } from '../../content/scanner';
import type { ActionState } from '../../types';
import { failure, fieldErrors, optionalFile, text } from '../../utils/formData';
import { ITEM_IMAGE_MAX_BYTES, itemImagePath } from '../../utils/image';
import { isSessionEditable } from '../../utils/session.utils';
import { captureInputSchema, draftEditSchema } from '../../utils/scanner/draft.schemas';
import { claimItemService } from '../claimItem.service';
import { claimSessionService } from '../claimSession.service';
import { requireSellerId } from '../seller.context';

export type SaveCaptureResult =
  { status: 'success'; itemId: string } | { status: 'error'; code: string; retryable: boolean };

const NON_RETRYABLE = new Set([
  'not_found',
  'forbidden',
  'invalid_state',
  'validation',
  'image_type',
  'image_size',
]);
const fail = (code: string): SaveCaptureResult => ({
  status: 'error',
  code,
  retryable: !NON_RETRYABLE.has(code),
});

const refresh = (sessionId: string) => revalidatePath(`/dashboard/claims/${sessionId}/edit`);

/**
 * S11-05: crea el borrador de un artículo desde una captura (o reemplaza la imagen de uno existente) con los
 * mismos services y validaciones de S4. Idempotente por `captureId`: un reintento tras perder la respuesta
 * devuelve el artículo ya creado en lugar de duplicarlo.
 */
export async function saveCaptureAction(formData: FormData): Promise<SaveCaptureResult> {
  const sellerId = await requireSellerId('/dashboard/claims');
  const parsed = captureInputSchema.safeParse({
    sessionId: text(formData, 'sessionId'),
    captureId: text(formData, 'captureId'),
    replaceItemId: text(formData, 'replaceItemId') || undefined,
    priceCents: text(formData, 'priceCents'),
  });
  if (!parsed.success) return fail('validation');
  const { sessionId, captureId, replaceItemId, priceCents } = parsed.data;
  const image = optionalFile(formData, 'image');
  if (!image) return fail('validation');
  if (image.type !== 'image/webp') return fail('image_type');
  if (image.size > ITEM_IMAGE_MAX_BYTES) return fail('image_size');

  try {
    const session = await claimSessionService.getWithItems(sellerId, sessionId);
    if (!session) return fail('not_found');
    if (!isSessionEditable(session.status)) return fail('invalid_state');
    const category = getCategory(session.category);

    if (replaceItemId) {
      const item = session.items.find((i) => i.id === replaceItemId);
      if (!item) return fail('not_found');
      const price = priceCents ?? item.price_cents;
      if (price <= 0 && session.status !== 'draft') return fail('validation');
      await claimItemService.update(
        sellerId,
        replaceItemId,
        {
          title: item.title,
          price_cents: price,
          is_preview: item.is_preview,
          attributes: item.attributes as Record<string, unknown>,
        },
        image,
      );
      refresh(sessionId);
      return { status: 'success', itemId: replaceItemId };
    }

    // Un evento ya publicado no admite artículos sin precio (la BD también lo impide).
    if (priceCents === null && session.status !== 'draft') return fail('validation');
    const existing = await claimItemService.findByImagePath(
      sessionId,
      itemImagePath(sellerId, sessionId, captureId),
    );
    if (existing) return { status: 'success', itemId: existing.id };

    const position = session.items.reduce((max, i) => Math.max(max, i.position), 0) + 1;
    const created = await claimItemService.create(
      sellerId,
      sessionId,
      {
        title: scannerContent.draftTitle(category.itemLabels.singular, position),
        price_cents: priceCents ?? 0,
        is_preview: false,
        category: category.id,
        attributes: category.schema.parse(category.draftAttributes) as Record<string, unknown>,
      },
      image,
      captureId,
    );
    refresh(sessionId);
    return { status: 'success', itemId: created.id };
  } catch (error) {
    return fail(error instanceof AppError ? error.code : 'unknown');
  }
}

/** S11-08: edición de un borrador desde la revisión por lotes (título, precio y atributos de la categoría). */
export async function updateDraftItemAction(input: {
  sessionId: string;
  itemId: string;
  title: string;
  price: string;
  note?: string;
  attributes: Record<string, string>;
}): Promise<ActionState> {
  const sellerId = await requireSellerId('/dashboard/claims');
  try {
    const session = await claimSessionService.getWithItems(sellerId, input.sessionId);
    if (!session) return failure('not_found');
    if (!isSessionEditable(session.status)) return failure('invalid_state');
    const item = session.items.find((i) => i.id === input.itemId);
    if (!item) return failure('not_found');

    const parsed = draftEditSchema(session.category).safeParse({
      title: input.title,
      price: input.price,
      note: input.note ?? '',
      attributes: input.attributes,
    });
    if (!parsed.success)
      return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
    if (parsed.data.price <= 0 && session.status !== 'draft')
      return failure('validation', { fieldErrors: { price: scannerContent.price.needsPrice } });

    await claimItemService.update(
      sellerId,
      input.itemId,
      {
        title: parsed.data.title,
        price_cents: parsed.data.price,
        is_preview: item.is_preview,
        seller_note: parsed.data.note,
        attributes: parsed.data.attributes as Record<string, unknown>,
      },
      null,
    );
  } catch (error) {
    return failure(error instanceof AppError ? error.code : 'unknown');
  }
  refresh(input.sessionId);
  return { status: 'success' };
}
