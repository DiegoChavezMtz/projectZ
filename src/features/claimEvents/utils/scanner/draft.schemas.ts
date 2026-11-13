import { z } from 'zod';
import { getCategory, type CategoryDefinition } from '@/types/categories';
import { parsePesosToCents } from '@/utils/money';
import { claimEventsContent } from '../../content/es-MX';
import { MAX_PRICE_CENTS, SELLER_NOTE_MAX } from '../item.schemas';

const v = claimEventsContent.validation;

/** Datos de una captura que llegan a la Server Action (todo viene como texto del FormData). */
export const captureInputSchema = z.object({
  sessionId: z.uuid(),
  /** UUID de la captura, o `<uuid>-<n>` para la pieza n de una foto con varias piezas. */
  captureId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-[0-9]{1,2})?$/i),
  replaceItemId: z.uuid().optional(),
  /** Centavos enteros; vacío = sin precio. */
  priceCents: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null;
      const n = Number(value);
      if (!Number.isSafeInteger(n) || n < 0 || n > MAX_PRICE_CENTS) {
        ctx.addIssue({ code: 'custom', message: v.price });
        return null;
      }
      return n === 0 ? null : n;
    }),
});

/** Edición de un borrador en la revisión por lotes: el precio puede quedar vacío (incompleto). */
export function buildDraftEditSchema(category: CategoryDefinition) {
  return z.object({
    title: z.string().trim().min(1, v.required).max(120, v.tooLong(120)),
    price: z
      .string()
      .trim()
      .transform((text, ctx) => {
        if (text === '') return 0;
        const cents = parsePesosToCents(text);
        if (cents === null || cents <= 0 || cents > MAX_PRICE_CENTS) {
          ctx.addIssue({ code: 'custom', message: v.price });
          return 0;
        }
        return cents;
      }),
    note: z
      .string()
      .trim()
      .max(SELLER_NOTE_MAX, v.tooLong(SELLER_NOTE_MAX))
      .transform((text) => (text === '' ? null : text))
      .default(null),
    attributes: z.preprocess(
      (value) =>
        typeof value === 'object' && value !== null
          ? Object.fromEntries(
              Object.entries(value).filter(([, x]) => !(typeof x === 'string' && x.trim() === '')),
            )
          : value,
      category.schema,
    ),
  });
}

export const draftEditSchema = (categoryId: string) =>
  buildDraftEditSchema(getCategory(categoryId));
