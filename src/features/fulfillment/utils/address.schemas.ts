import { z } from 'zod';
import type { AddressSnapshot } from '../types';

const required = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} es obligatorio`).max(max, `${label} es demasiado largo`);

/** Dirección de envío (`fulfillment.md`). Espejo en cliente de `is_valid_address`; Postgres es la autoridad. */
export const addressSchema = z.object({
  recipient: required('El nombre de quien recibe'),
  phone: required('El teléfono').regex(/^[0-9+()\s-]{8,20}$/, 'Escribe un teléfono válido'),
  street: required('La calle'),
  exterior: required('El número exterior'),
  interior: z.string().trim().max(120).optional(),
  neighborhood: required('La colonia'),
  city: required('La ciudad'),
  state: required('El estado'),
  postal_code: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, 'El código postal tiene 5 dígitos'),
  references: z.string().trim().max(200, 'Las referencias son demasiado largas').optional(),
});

export type AddressInput = z.input<typeof addressSchema>;

/** Quita opcionales vacíos para enviar un objeto limpio a la RPC. */
export function toAddressSnapshot(data: z.output<typeof addressSchema>): AddressSnapshot {
  const { interior, references, ...rest } = data;
  return {
    ...rest,
    ...(interior ? { interior } : {}),
    ...(references ? { references } : {}),
  };
}

export const ADDRESS_FIELDS = [
  'recipient',
  'phone',
  'street',
  'exterior',
  'interior',
  'neighborhood',
  'city',
  'state',
  'postal_code',
  'references',
] as const;
