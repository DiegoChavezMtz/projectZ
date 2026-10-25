import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { categories, getCategory, tcgCategory } from '@/types/categories';
import type { CategoryDefinition } from '@/types/categories';

describe('categoría tcg', () => {
  it('acepta atributos válidos', () => {
    const r = tcgCategory.schema.safeParse({
      language: 'es',
      condition: 'NM',
      set_name: 'Base Set',
    });
    expect(r.success).toBe(true);
  });

  it('exige idioma y condición', () => {
    expect(tcgCategory.schema.safeParse({}).success).toBe(false);
    expect(tcgCategory.schema.safeParse({ language: 'es' }).success).toBe(false);
  });

  it('rechaza valores fuera del catálogo', () => {
    expect(tcgCategory.schema.safeParse({ language: 'xx', condition: 'NM' }).success).toBe(false);
    expect(tcgCategory.schema.safeParse({ language: 'es', condition: 'MINT' }).success).toBe(false);
  });

  it('define etiquetas y relación de aspecto 63:88', () => {
    expect(tcgCategory.itemLabels).toEqual({ singular: 'carta', plural: 'cartas' });
    expect(tcgCategory.imageAspect).toEqual({ width: 63, height: 88 });
  });

  it('cada campo select requerido existe en el esquema y sus opciones lo satisfacen', () => {
    for (const field of tcgCategory.fields) {
      if (field.kind !== 'select') continue;
      for (const option of field.options) {
        const base = { language: 'es', condition: 'NM', [field.name]: option.value };
        expect(tcgCategory.schema.safeParse(base).success).toBe(true);
      }
    }
  });
});

describe('registro de categorías', () => {
  it('una categoría nueva se registra sin tocar nada más', () => {
    const fake: CategoryDefinition = {
      id: 'fake',
      label: 'Ficticia',
      schema: z.object({ size: z.enum(['S', 'M']) }),
      itemLabels: { singular: 'pieza', plural: 'piezas' },
      imageAspect: { width: 1, height: 1 },
      fields: [
        {
          kind: 'select',
          name: 'size',
          label: 'Talla',
          required: true,
          options: [
            { value: 'S', label: 'Chica' },
            { value: 'M', label: 'Mediana' },
          ],
        },
      ],
    };
    categories.fake = fake;
    try {
      expect(getCategory('fake').schema.safeParse({ size: 'M' }).success).toBe(true);
      expect(getCategory('fake').fields.map((f) => f.name)).toEqual(['size']);
    } finally {
      delete categories.fake;
    }
  });

  it('lanza con categoría desconocida', () => {
    expect(() => getCategory('nope')).toThrow();
  });
});
