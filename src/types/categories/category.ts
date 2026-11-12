import type { ZodType } from 'zod';

export type CategoryFieldOption = { value: string; label: string };

/** Campo de `attributes` que el formulario de artículo renderiza a partir de la definición. */
export type CategoryField =
  | { kind: 'text'; name: string; label: string; required: boolean; maxLength: number }
  | {
      kind: 'select';
      name: string;
      label: string;
      required: boolean;
      options: CategoryFieldOption[];
    };

export type CategoryDefinition<TAttributes = Record<string, unknown>> = {
  id: string;
  /** Nombre de la categoría para selectores. */
  label: string;
  /** Esquema Zod de `claim_items.attributes`. */
  schema: ZodType<TAttributes>;
  /** Textos de UI del artículo: "carta" / "cartas". */
  itemLabels: { singular: string; plural: string };
  /** Relación de aspecto de la imagen (ancho:alto). */
  imageAspect: { width: number; height: number };
  fields: CategoryField[];
  /** Valores de `attributes` con los que nace un borrador del modo escáner (se corrigen en la revisión). */
  draftAttributes: Record<string, unknown>;
};
