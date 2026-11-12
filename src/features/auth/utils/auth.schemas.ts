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

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, { error: v.slugInvalid })
  .refine((value) => !isReservedHandle(value), { error: v.slugReserved });

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

export const requestCodeSchema = z.object({ email: emailSchema });

// Contraseña nueva con confirmación (recuperar y cambiar).
const confirmedPassword = {
  password: passwordSchema,
  confirmPassword: z.string().min(1, { error: v.confirmRequired }),
};
const mustMatch = (data: { password: string; confirmPassword: string }) =>
  data.password === data.confirmPassword;
const mismatch = { error: v.passwordMismatch, path: ['confirmPassword'] };

export const resetPasswordSchema = z.object(confirmedPassword).refine(mustMatch, mismatch);

export const changePasswordSchema = z
  .object({
    // Vacía para quien solo tiene Google y establece su primera contraseña (el servidor decide si la exige).
    currentPassword: z.string().default(''),
    ...confirmedPassword,
  })
  .refine(mustMatch, mismatch);

export const changeEmailSchema = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().default(''),
});

export const deleteAccountSchema = z.object({
  handle: z.string().trim().min(1, { error: v.handleRequired }),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const profileSchema = z.object({ displayName: displayNameSchema, handle: handleSchema });

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .transform((value) => (value === '' ? null : value));

export const sellerSchema = z.object({
  shopName: z.string().trim().min(2, { error: v.shopNameMin }).max(60, { error: v.shopNameMax }),
  slug: slugSchema,
  bio: optionalText(280, v.bioMax),
  city: optionalText(80, v.cityMax),
  paymentInstructions: optionalText(500, v.paymentMax),
});

/** Perfil de la tienda editable (el enlace no cambia después del alta). */
export const shopProfileSchema = sellerSchema.pick({ shopName: true, bio: true, city: true });

export type ProfileInput = z.infer<typeof profileSchema>;
export type SellerInput = z.input<typeof sellerSchema>;
export type ShopProfileInput = z.input<typeof shopProfileSchema>;
