import { z } from 'zod';
import type { CategoryDefinition } from './category';

export const TCG_LANGUAGES = [
  'es',
  'en',
  'ja',
  'ko',
  'zh',
  'fr',
  'de',
  'it',
  'pt',
  'other',
] as const;
export const TCG_CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;

export const tcgAttributesSchema = z.object({
  set_name: z.string().trim().min(1).max(80).optional(),
  collector_number: z.string().trim().min(1).max(20).optional(),
  language: z.enum(TCG_LANGUAGES),
  condition: z.enum(TCG_CONDITIONS),
});

export type TcgAttributes = z.infer<typeof tcgAttributesSchema>;

export const tcgCategory: CategoryDefinition<TcgAttributes> = {
  id: 'tcg',
  label: 'Cartas coleccionables',
  schema: tcgAttributesSchema,
  itemLabels: { singular: 'carta', plural: 'cartas' },
  imageAspect: { width: 63, height: 88 },
  draftAttributes: { language: 'es', condition: 'NM' },
  fields: [
    { kind: 'text', name: 'set_name', label: 'Set o colección', required: false, maxLength: 80 },
    {
      kind: 'text',
      name: 'collector_number',
      label: 'Número de coleccionista',
      required: false,
      maxLength: 20,
    },
    {
      kind: 'select',
      name: 'language',
      label: 'Idioma',
      required: true,
      options: [
        { value: 'es', label: 'Español' },
        { value: 'en', label: 'Inglés' },
        { value: 'ja', label: 'Japonés' },
        { value: 'ko', label: 'Coreano' },
        { value: 'zh', label: 'Chino' },
        { value: 'fr', label: 'Francés' },
        { value: 'de', label: 'Alemán' },
        { value: 'it', label: 'Italiano' },
        { value: 'pt', label: 'Portugués' },
        { value: 'other', label: 'Otro' },
      ],
    },
    {
      kind: 'select',
      name: 'condition',
      label: 'Condición',
      required: true,
      options: [
        { value: 'NM', label: 'Near Mint (NM)' },
        { value: 'LP', label: 'Poco jugada (LP)' },
        { value: 'MP', label: 'Moderadamente jugada (MP)' },
        { value: 'HP', label: 'Muy jugada (HP)' },
        { value: 'DMG', label: 'Dañada (DMG)' },
      ],
    },
  ],
};
