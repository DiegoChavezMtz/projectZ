import { fulfillmentErrors } from '../content/es-MX';

/** Código de error → texto de UI; un código desconocido cae en `unknown`. */
export function fulfillmentErrorMessage(code: string | undefined): string {
  return (code ? fulfillmentErrors[code] : undefined) ?? fulfillmentErrors.unknown!;
}
