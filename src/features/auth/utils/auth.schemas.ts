import { z } from 'zod';
import { authContent } from '../content/es-MX';
import { isReservedHandle } from './handle';

const v = authContent.validation;

export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;
export const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: v.emailInvalid }));

export const passwordSchema = z
  .string()
  .min(8, { error: v.passwordMin })
  .regex(/\p{L}/u, { error: v.passwordLetter })
  .regex(/\d/, { error: v.passwordNumber });

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, { error: v.displayNameMin })
  .max(50, { error: v.displayNameMax });

export const handleSchema = z
  .string()
  .regex(HANDLE_PATTERN, { error: v.handleInvalid })
  .refine((value) => !isReservedHandle(value), { error: v.handleReserved });

export const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { error: v.codeInvalid });

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  acceptTerms: z.literal(true, { error: v.termsRequired }),
});

// En login no se valida la fortaleza: solo que haya contraseña (el error es genérico).
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: v.passwordRequired }),
});

export const verifyEmailSchema = z.object({ email: emailSchema, code: codeSchema });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
