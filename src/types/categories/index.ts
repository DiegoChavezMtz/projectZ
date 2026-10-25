import type { CategoryDefinition } from './category';
import { tcgCategory } from './tcg';

export type { CategoryDefinition, CategoryField, CategoryFieldOption } from './category';
export { tcgAttributesSchema, tcgCategory, TCG_CONDITIONS, TCG_LANGUAGES } from './tcg';
export type { TcgAttributes } from './tcg';

// Agregar una categoría = crear su archivo y registrarla aquí. Nada más cambia.
export const categories: Record<string, CategoryDefinition> = {
  [tcgCategory.id]: tcgCategory as CategoryDefinition,
};

export const DEFAULT_CATEGORY_ID = tcgCategory.id;

export function getCategory(id: string): CategoryDefinition {
  const category = categories[id];
  if (!category) throw new RangeError(`Categoría desconocida: ${id}`);
  return category;
}

export const categoryList = (): CategoryDefinition[] => Object.values(categories);
