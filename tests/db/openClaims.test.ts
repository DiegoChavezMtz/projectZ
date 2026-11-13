import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient } from '../helpers/supabase';
import { cleanupTestData } from '../helpers/cleanup';
import { supabaseCleanupStore } from '../helpers/cleanup.supabase';
import { createLiveSession, createTestSeller, type TestSeller } from '../helpers/claims';

// Migración 29 (GATE-DB): vista pública `public_open_claims`. Requiere aplicarla antes de correr.
// Los claims de cuentas is_test nunca aparecen en la vista, así que aquí se prueba el contrato y la exclusión.

let seller: TestSeller;
beforeAll(async () => {
  seller = await createTestSeller();
  await createLiveSession(seller, { items: 2 });
}, 120_000);
afterAll(async () => {
  await cleanupTestData(supabaseCleanupStore());
});

describe('public_open_claims', () => {
  it('es legible sin sesión con las columnas explícitas', async () => {
    const { error } = await anonClient()
      .from('public_open_claims' as never)
      .select('id, code, title, status, starts_at, started_at, shop_name, handle, item_count')
      .limit(1);
    expect(error).toBeNull();
  });

  it('no expone descripción, reglas, plazos ni ids internos del vendedor', async () => {
    for (const column of ['description', 'rules', 'seller_id', 'auto_confirm', 'is_test']) {
      const { error } = await anonClient()
        .from('public_open_claims' as never)
        .select(column)
        .limit(1);
      expect(error, column).not.toBeNull();
    }
  });

  it('excluye los claims de cuentas de prueba', async () => {
    const { data, error } = await anonClient()
      .from('public_open_claims' as never)
      .select('shop_name')
      .eq('shop_name', 'Tienda de prueba');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
