import { parsePesosToCents } from '@/utils/money';

export type OfferValidation =
  | { ok: true; amountCents: number }
  | { ok: false; reason: 'required' | 'invalid' | 'tooLow' | 'tooHigh' };

/** Valida el monto escrito en pesos contra el precio publicado (la oferta debe ser menor). */
export function validateOffer(input: string, priceCents: number): OfferValidation {
  if (!input.trim()) return { ok: false, reason: 'required' };
  const cents = parsePesosToCents(input);
  if (cents === null) return { ok: false, reason: 'invalid' };
  if (cents <= 0) return { ok: false, reason: 'tooLow' };
  if (cents >= priceCents) return { ok: false, reason: 'tooHigh' };
  return { ok: true, amountCents: cents };
}
