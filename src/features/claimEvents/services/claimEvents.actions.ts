'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCategory } from '@/types/categories';
import { AppError } from '@/utils/errors';
import { claimEventsContent } from '../content/es-MX';
import type { ActionState } from '../types';
import { failure, fieldErrors, optionalFile, text } from '../utils/formData';
import { ITEM_IMAGE_MAX_BYTES, isItemImageOutputType } from '../utils/image';
import { itemFormSchema, readAttributes } from '../utils/item.schemas';
import {
  lockedSessionFormSchema,
  sessionFormSchema,
  toSessionColumns,
} from '../utils/session.schemas';
import { areRulesLocked, isSessionEditable, sameMinute } from '../utils/session.utils';
import { claimItemService } from './claimItem.service';
import { claimSessionService } from './claimSession.service';
import { requireSellerId } from './seller.context';

const errorCode = (error: unknown) => (error instanceof AppError ? error.code : 'unknown');

const sessionInput = (formData: FormData) => ({
  title: text(formData, 'title'),
  description: text(formData, 'description'),
  rules: text(formData, 'rules'),
  startsAt: text(formData, 'startsAt'),
  closesAt: text(formData, 'closesAt'),
  expectedDurationMinutes: text(formData, 'expectedDurationMinutes'),
  releaseMode: text(formData, 'releaseMode'),
  autoConfirm: formData.get('autoConfirm'),
  closeDeadlineHours: text(formData, 'closeDeadlineHours'),
  paymentDeadlineHours: text(formData, 'paymentDeadlineHours'),
  shippingDeadlineHours: text(formData, 'shippingDeadlineHours'),
  allowAccumulate: formData.get('allowAccumulate'),
  accumulateDays: text(formData, 'accumulateDays'),
});

const refresh = (sessionId: string) => {
  revalidatePath('/dashboard/claims');
  revalidatePath(`/dashboard/claims/${sessionId}/edit`);
};

// --- Eventos ----------------------------------------------------------------------------------

export async function createSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sellerId = await requireSellerId('/dashboard/claims/new');
  const parsed = sessionFormSchema.safeParse(sessionInput(formData));
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  let id: string;
  try {
    id = (await claimSessionService.create(sellerId, toSessionColumns(parsed.data))).id;
  } catch (error) {
    return failure(errorCode(error));
  }
  revalidatePath('/dashboard/claims');
  redirect(`/dashboard/claims/${id}/edit`);
}

export async function updateSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sellerId = await requireSellerId('/dashboard/claims');
  const id = text(formData, 'id');
  const session = await claimSessionService.getWithItems(sellerId, id);
  if (!session) return failure('not_found');
  if (!isSessionEditable(session.status)) return failure('invalid_state');

  // Tras publicar solo se validan (y guardan) los campos editables: el resto lo bloquea también la BD.
  const schema = areRulesLocked(session.status) ? lockedSessionFormSchema : sessionFormSchema;
  const parsed = schema.safeParse(sessionInput(formData));
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });
  try {
    await claimSessionService.update(id, toSessionColumns(parsed.data));
    // Publicado: el cierre solo se mueve por la RPC, y solo si cambió (el valor guardado puede ya ser pasado).
    if (session.status !== 'draft' && !sameMinute(parsed.data.closesAt, session.closes_at)) {
      await claimSessionService.setSessionClose(id, parsed.data.closesAt);
    }
  } catch (error) {
    if (error instanceof AppError && error.code === 'validation_failed') {
      return failure('validation', {
        fieldErrors: { closesAt: claimEventsContent.validation.closesInvalid },
      });
    }
    return failure(errorCode(error));
  }
  refresh(id);
  return { status: 'success' };
}

export async function cancelSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSellerId('/dashboard/claims');
  try {
    await claimSessionService.cancel(text(formData, 'id'));
  } catch (error) {
    return failure(errorCode(error));
  }
  revalidatePath('/dashboard/claims');
  redirect('/dashboard/claims');
}

export async function publishSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSellerId('/dashboard/claims');
  const id = text(formData, 'id');
  try {
    const publicCode = await claimSessionService.publish(id);
    refresh(id);
    return { status: 'success', publicCode };
  } catch (error) {
    if (error instanceof AppError && error.code === 'validation_failed') {
      const reasons = (error.details as { reasons?: string[] } | undefined)?.reasons ?? [];
      return failure('validation_failed', { reasons });
    }
    return failure(errorCode(error));
  }
}

// --- Artículos --------------------------------------------------------------------------------

export async function saveItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const sellerId = await requireSellerId('/dashboard/claims');
  const sessionId = text(formData, 'sessionId');
  const itemId = text(formData, 'itemId');

  const session = await claimSessionService.getWithItems(sellerId, sessionId);
  if (!session) return failure('not_found');
  if (!isSessionEditable(session.status)) return failure('invalid_state');

  const category = getCategory(session.category);
  const parsed = itemFormSchema(session.category).safeParse({
    title: text(formData, 'title'),
    price: text(formData, 'price'),
    note: text(formData, 'note'),
    isPreview: formData.get('isPreview'),
    attributes: readAttributes((name) => text(formData, name), category),
  });
  if (!parsed.success)
    return failure('validation', { fieldErrors: fieldErrors(parsed.error.issues) });

  const image = optionalFile(formData, 'image');
  if (image && !isItemImageOutputType(image.type)) return failure('image_type');
  if (image && image.size > ITEM_IMAGE_MAX_BYTES) return failure('image_size');

  const input = {
    title: parsed.data.title,
    price_cents: parsed.data.price,
    is_preview: parsed.data.isPreview,
    seller_note: parsed.data.note,
    attributes: parsed.data.attributes as Record<string, unknown>,
  };
  try {
    if (itemId) {
      if (!session.items.some((item) => item.id === itemId)) return failure('not_found');
      await claimItemService.update(sellerId, itemId, input, image);
    } else {
      await claimItemService.create(
        sellerId,
        sessionId,
        { ...input, category: session.category },
        image,
      );
    }
  } catch (error) {
    return failure(errorCode(error));
  }
  refresh(sessionId);
  return { status: 'success' };
}

export async function deleteItemAction(sessionId: string, itemId: string): Promise<ActionState> {
  const sellerId = await requireSellerId('/dashboard/claims');
  try {
    await claimItemService.remove(sellerId, itemId);
  } catch (error) {
    return failure(errorCode(error));
  }
  refresh(sessionId);
  return { status: 'success' };
}

export async function duplicateItemAction(sessionId: string, itemId: string): Promise<ActionState> {
  const sellerId = await requireSellerId('/dashboard/claims');
  try {
    await claimItemService.duplicate(sellerId, itemId);
  } catch (error) {
    return failure(errorCode(error));
  }
  refresh(sessionId);
  return { status: 'success' };
}

export async function reorderItemsAction(
  sessionId: string,
  orderedIds: string[],
): Promise<ActionState> {
  await requireSellerId('/dashboard/claims');
  try {
    await claimItemService.reorder(sessionId, orderedIds);
  } catch (error) {
    return failure(errorCode(error) === 'unknown' ? 'reorder_failed' : errorCode(error));
  }
  refresh(sessionId);
  return { status: 'success' };
}
