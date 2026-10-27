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

export const ACCUMULATE_DAYS = { min: 30, max: 120, default: 60 } as const;

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
  closesAt: z.preprocess(
    (value) => (value === undefined ? null : blankToNull(value)),
    z
      .string()
      .nullable()
      .transform((local, ctx) => {
        if (local === null) return null;
        const iso = mexicoLocalToIso(local);
        if (!iso) ctx.addIssue({ code: 'custom', message: v.date });
        return iso;
      }),
  ),
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
  /** Solo se exige (y guarda) si `allowAccumulate`; si no, queda el valor por defecto. */
  accumulateDays: z.string().trim().optional(),
};

type CloseFields = { startsAt: string; closesAt: string | null };

/** El cierre programado, si existe, debe ser posterior al inicio. */
function checkCloseAfterStart(values: CloseFields, ctx: z.RefinementCtx) {
  if (!values.closesAt || !values.startsAt) return;
  if (new Date(values.closesAt).getTime() <= new Date(values.startsAt).getTime()) {
    ctx.addIssue({ code: 'custom', path: ['closesAt'], message: v.closesAfterStart });
  }
}

/** Formulario completo (evento en borrador). */
export const sessionFormSchema = z
  .object({ ...editableShape, ...rulesShape })
  .superRefine(checkCloseAfterStart)
  .superRefine((values, ctx) => {
    if (!values.allowAccumulate) return;
    const raw = values.accumulateDays ?? '';
    const days = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
    if (!(days >= ACCUMULATE_DAYS.min && days <= ACCUMULATE_DAYS.max)) {
      ctx.addIssue({
        code: 'custom',
        path: ['accumulateDays'],
        message: v.range(ACCUMULATE_DAYS.min, ACCUMULATE_DAYS.max),
      });
    }
  })
  .transform((values) => ({
    ...values,
    accumulateDays: values.allowAccumulate
      ? Number(values.accumulateDays)
      : ACCUMULATE_DAYS.default,
  }));
/** Evento ya publicado: solo los campos editables. */
export const lockedSessionFormSchema = z.object(editableShape).superRefine(checkCloseAfterStart);

export type SessionFormValues = z.output<typeof sessionFormSchema>;
export type LockedSessionFormValues = z.output<typeof lockedSessionFormSchema>;

/**
 * Valores del formulario → columnas de `claim_sessions`. Tras publicar (esquema bloqueado) no incluye
 * `closes_at`: el trigger solo permite cambiarlo con la RPC `set_session_close`.
 */
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
    accumulate_days: values.accumulateDays,
    closes_at: values.closesAt,
  };
}
