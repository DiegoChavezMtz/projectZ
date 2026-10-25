import { z } from 'zod';
import { mexicoLocalToIso } from '@/utils/dates';
import { claimEventsContent } from '../content/es-MX';

const v = claimEventsContent.validation;

const flag = z.preprocess(
  (value) => value === true || value === 'on' || value === 'true',
  z.boolean(),
);

const blankToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max, v.tooLong(max)).nullable());

const hours = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, v.integer)
    .transform(Number)
    .refine((n) => n >= min && n <= max, v.range(min, max));

export const DEADLINE_RANGES = {
  close: { min: 1, max: 168 },
  payment: { min: 1, max: 336 },
  shipping: { min: 24, max: 720 },
} as const;

/** Campos que siguen editables después de publicar. */
const editableShape = {
  title: z.string().trim().min(3, v.titleMin).max(80, v.tooLong(80)),
  description: optionalText(1000),
  rules: optionalText(1000),
  startsAt: z
    .string()
    .min(1, v.required)
    .transform((local, ctx) => {
      const iso = mexicoLocalToIso(local);
      if (!iso) ctx.addIssue({ code: 'custom', message: v.date });
      return iso ?? '';
    }),
  expectedDurationMinutes: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .regex(/^\d+$/, v.integer)
      .transform(Number)
      .refine((n) => n >= 1 && n <= 1440, v.range(1, 1440))
      .nullable(),
  ),
};

/** Reglas del evento: se bloquean al publicar. */
const rulesShape = {
  releaseMode: z.enum(['all_at_start', 'manual'], { error: v.required }),
  autoConfirm: flag,
  closeDeadlineHours: hours(DEADLINE_RANGES.close.min, DEADLINE_RANGES.close.max),
  paymentDeadlineHours: hours(DEADLINE_RANGES.payment.min, DEADLINE_RANGES.payment.max),
  shippingDeadlineHours: hours(DEADLINE_RANGES.shipping.min, DEADLINE_RANGES.shipping.max),
  allowAccumulate: flag,
};

/** Formulario completo (evento en borrador). */
export const sessionFormSchema = z.object({ ...editableShape, ...rulesShape });
/** Evento ya publicado: solo los campos editables. */
export const lockedSessionFormSchema = z.object(editableShape);

export type SessionFormValues = z.output<typeof sessionFormSchema>;
export type LockedSessionFormValues = z.output<typeof lockedSessionFormSchema>;

/** Valores del formulario → columnas de `claim_sessions`. */
export function toSessionColumns(values: LockedSessionFormValues | SessionFormValues) {
  const base = {
    title: values.title,
    description: values.description,
    rules: values.rules,
    starts_at: values.startsAt,
    expected_duration_minutes: values.expectedDurationMinutes,
  };
  if (!('releaseMode' in values)) return base;
  return {
    ...base,
    release_mode: values.releaseMode,
    auto_confirm: values.autoConfirm,
    close_deadline_hours: values.closeDeadlineHours,
    payment_deadline_hours: values.paymentDeadlineHours,
    shipping_deadline_hours: values.shippingDeadlineHours,
    allow_accumulate: values.allowAccumulate,
  };
}
