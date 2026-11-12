import { z } from 'zod';
import { getCategory, type CategoryDefinition } from '@/types/categories';
import { parsePesosToCents } from '@/utils/money';
import { claimEventsContent } from '../content/es-MX';

const v = claimEventsContent.validation;

/** Máximo permitido por el entero de la BD (int4) con margen: $10,000,000.00. */
export const MAX_PRICE_CENTS = 1_000_000_000;

export const SELLER_NOTE_MAX = 80;

const flag = z.preprocess(
  (value) => value === true || value === 'on' || value === 'true',
  z.boolean(),
);

/** Los campos opcionales vacíos del formulario ("") equivalen a ausentes. */
function stripBlanks(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => !(typeof v === 'string' && v.trim() === '')),
  );
}

/** `itemFormSchema` compone el esquema de `attributes` de la categoría (el formulario no sabe de TCG). */
export function buildItemFormSchema(category: CategoryDefinition) {
  return z.object({
    title: z.string().trim().min(1, v.required).max(120, v.tooLong(120)),
    price: z
      .string()
      .trim()
      .min(1, v.required)
      .transform((text, ctx) => {
        const cents = parsePesosToCents(text);
        if (cents === null || cents <= 0 || cents > MAX_PRICE_CENTS) {
          ctx.addIssue({ code: 'custom', message: v.price });
          return 0;
        }
        return cents;
      }),
    /** Nota del vendedor (nombre, fecha…): texto del artículo, no parte de la foto. Vacío = sin nota. */
    note: z
      .string()
      .trim()
      .max(SELLER_NOTE_MAX, v.tooLong(SELLER_NOTE_MAX))
      .transform((text) => (text === '' ? null : text))
      .default(null),
    isPreview: flag,
    attributes: z.preprocess(stripBlanks, category.schema),
  });
}

export const itemFormSchema = (categoryId: string) => buildItemFormSchema(getCategory(categoryId));

export type ItemFormValues = z.output<ReturnType<typeof buildItemFormSchema>>;

/** Lee `attributes.<campo>` de un origen tipo FormData según los campos de la categoría. */
export function readAttributes(
  get: (name: string) => string | null | undefined,
  category: CategoryDefinition,
): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const field of category.fields)
    attributes[field.name] = get(`attributes.${field.name}`) ?? '';
  return attributes;
}
