import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { scannerContent } from '@/features/claimEvents/content/scanner';
import {
  centeredCropQuad,
  quadSize,
  targetSize,
} from '@/features/claimEvents/utils/scanner/geometry';
import { categories, getCategory, type CategoryDefinition } from '@/types/categories';

const fake: CategoryDefinition = {
  id: 'fake',
  label: 'Ficticia',
  schema: z.object({ size: z.enum(['S', 'M']) }),
  itemLabels: { singular: 'figura', plural: 'figuras' },
  imageAspect: { width: 1, height: 1 },
  draftAttributes: { size: 'M' },
  fields: [],
};

afterEach(() => delete categories.fake);

describe('categorías y el escáner', () => {
  it('TCG: relación 63:88 y borrador con atributos válidos', () => {
    const tcg = getCategory('tcg');
    expect(tcg.imageAspect).toEqual({ width: 63, height: 88 });
    expect(tcg.schema.safeParse(tcg.draftAttributes).success).toBe(true);
  });

  it('una categoría ficticia cambia aspecto, salida y etiquetas sin tocar el escáner', () => {
    categories.fake = fake;
    const category = getCategory('fake');
    expect(targetSize(category.imageAspect, 1000)).toEqual({ width: 1000, height: 1000 });
    const size = quadSize(centeredCropQuad(800, 600, category.imageAspect));
    expect(size.width / size.height).toBeCloseTo(1, 5);
    expect(scannerContent.intro(category.itemLabels)).toContain('figura');
    expect(scannerContent.strip.count(2, category.itemLabels)).toBe('2 figuras');
    expect(scannerContent.draftTitle(category.itemLabels.singular, 3)).toBe('Figura 3');
    expect(category.schema.safeParse(category.draftAttributes).success).toBe(true);
  });
});
