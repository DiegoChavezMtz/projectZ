import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { categories, getCategory } from '@/types/categories';
import type { CategoryDefinition } from '@/types/categories';
import { buildItemFormSchema, itemFormSchema } from '@/features/claimEvents/utils/item.schemas';
import {
  lockedSessionFormSchema,
  sessionFormSchema,
  toSessionColumns,
} from '@/features/claimEvents/utils/session.schemas';
import {
  areRulesLocked,
  canPublish,
  isItemComplete,
  isSessionEditable,
  reorderItems,
} from '@/features/claimEvents/utils/session.utils';

const validSession = {
  title: 'Claim de viernes',
  description: '',
  rules: '  ',
  startsAt: '2026-11-06T20:00',
  expectedDurationMinutes: '90',
  releaseMode: 'all_at_start',
  autoConfirm: 'on',
  closeDeadlineHours: '24',
  paymentDeadlineHours: '48',
  shippingDeadlineHours: '120',
  allowAccumulate: undefined,
};

describe('sessionFormSchema', () => {
  it('normaliza el formulario a columnas', () => {
    const parsed = sessionFormSchema.parse(validSession);
    expect(toSessionColumns(parsed)).toEqual({
      title: 'Claim de viernes',
      description: null,
      rules: null,
      starts_at: '2026-11-07T02:00:00.000Z',
      expected_duration_minutes: 90,
      release_mode: 'all_at_start',
      auto_confirm: true,
      close_deadline_hours: 24,
      payment_deadline_hours: 48,
      shipping_deadline_hours: 120,
      allow_accumulate: false,
    });
  });

  it.each([
    ['closeDeadlineHours', '0'],
    ['closeDeadlineHours', '169'],
    ['paymentDeadlineHours', '337'],
    ['shippingDeadlineHours', '23'],
    ['shippingDeadlineHours', '721'],
    ['title', 'ab'],
    ['startsAt', ''],
    ['expectedDurationMinutes', '0'],
    ['releaseMode', 'otro'],
  ])('rechaza %s = %j', (field, value) => {
    const result = sessionFormSchema.safeParse({ ...validSession, [field]: value });
    expect(result.success).toBe(false);
  });

  it('acepta los límites de los rangos', () => {
    const edges = {
      ...validSession,
      closeDeadlineHours: '168',
      paymentDeadlineHours: '336',
      shippingDeadlineHours: '24',
    };
    expect(sessionFormSchema.safeParse(edges).success).toBe(true);
    expect(
      sessionFormSchema.safeParse({
        ...edges,
        closeDeadlineHours: '1',
        shippingDeadlineHours: '720',
      }).success,
    ).toBe(true);
  });

  it('tras publicar solo valida los campos editables', () => {
    const { title, description, rules, startsAt, expectedDurationMinutes } = validSession;
    const parsed = lockedSessionFormSchema.parse({
      title,
      description,
      rules,
      startsAt,
      expectedDurationMinutes,
    });
    expect(Object.keys(toSessionColumns(parsed))).toEqual([
      'title',
      'description',
      'rules',
      'starts_at',
      'expected_duration_minutes',
    ]);
  });
});

describe('itemFormSchema', () => {
  const base = {
    title: ' Charizard ',
    price: '$1,550.50',
    isPreview: 'on',
    attributes: { language: 'es', condition: 'NM', set_name: '', collector_number: '4/102' },
  };

  it('convierte el precio a centavos y compone los atributos de la categoría', () => {
    const parsed = itemFormSchema('tcg').parse(base);
    expect(parsed).toEqual({
      title: 'Charizard',
      price: 155050,
      isPreview: true,
      attributes: { language: 'es', condition: 'NM', collector_number: '4/102' },
    });
  });

  it.each(['', '0', 'gratis', '1.234', '-5'])('rechaza precio %j', (price) => {
    expect(itemFormSchema('tcg').safeParse({ ...base, price }).success).toBe(false);
  });

  it('exige los atributos obligatorios de la categoría', () => {
    const result = itemFormSchema('tcg').safeParse({ ...base, attributes: { language: 'es' } });
    expect(result.success).toBe(false);
  });

  it('una categoría nueva se valida sin tocar el esquema del formulario', () => {
    const fake: CategoryDefinition = {
      id: 'fake',
      label: 'Ficticia',
      schema: z.object({ size: z.enum(['S', 'M']) }),
      itemLabels: { singular: 'pieza', plural: 'piezas' },
      imageAspect: { width: 1, height: 1 },
      fields: [],
    };
    categories.fake = fake;
    try {
      const schema = buildItemFormSchema(getCategory('fake'));
      expect(schema.safeParse({ ...base, attributes: { size: 'M' } }).success).toBe(true);
      expect(schema.safeParse({ ...base, attributes: { size: 'XL' } }).success).toBe(false);
    } finally {
      delete categories.fake;
    }
  });
});

describe('utils de evento', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const item = { price_cents: 1000, image_path: 'a/b.webp' };

  it('isSessionEditable / areRulesLocked', () => {
    expect(isSessionEditable('draft')).toBe(true);
    expect(isSessionEditable('scheduled')).toBe(true);
    expect(isSessionEditable('live')).toBe(false);
    expect(areRulesLocked('draft')).toBe(false);
    expect(areRulesLocked('scheduled')).toBe(true);
  });

  it('canPublish replica publish_session', () => {
    expect(canPublish({ status: 'draft', starts_at: future }, [item])).toEqual({
      ok: true,
      reasons: [],
    });
    expect(canPublish({ status: 'draft', starts_at: past }, []).reasons).toEqual([
      'no_items',
      'starts_at_not_future',
    ]);
    expect(
      canPublish({ status: 'draft', starts_at: future }, [item, { ...item, image_path: null }])
        .reasons,
    ).toEqual(['items_missing_image']);
    expect(
      canPublish({ status: 'draft', starts_at: future }, [{ ...item, price_cents: 0 }]).reasons,
    ).toEqual(['items_missing_price']);
    expect(canPublish({ status: 'scheduled', starts_at: future }, [item]).ok).toBe(false);
  });

  it('isItemComplete', () => {
    expect(isItemComplete({ title: 'x', price_cents: 1, image_path: 'a' })).toBe(true);
    expect(isItemComplete({ title: 'x', price_cents: 1, image_path: null })).toBe(false);
  });

  it('reorderItems mueve sin mutar y tolera índices inválidos', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(reorderItems(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderItems(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(reorderItems(list, 1, 9)).toEqual(list);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });
});
