import type { RealtimeChannel } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createLiveSession,
  createTestBuyers,
  createTestSeller,
  rpc,
  type TestBuyer,
  type TestSeller,
} from '../helpers/claims';
import { anonClient, type AnyClient } from '../helpers/supabase';

// S6-13: medición ACOTADA (no es prueba de carga): 3 clientes realtime anónimos y ~20 acciones de un
// comprador sobre un evento de 40 artículos. Mide la propagación desde que la RPC responde hasta que el
// cambio llega a cada cliente, y el tamaño del snapshot. El razonamiento de escala está en el sprint.
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => anonClient() }));
const { snapshotService } = await import('@/features/liveClaim/services/snapshot.service');

const CLIENTS = 3;
const ACTIONS = 20;
let seller: TestSeller;
let buyer: TestBuyer;
let prefiller: TestBuyer;
const open: { client: AnyClient; channel: RealtimeChannel }[] = [];

beforeAll(async () => {
  seller = await createTestSeller();
  [buyer, prefiller] = (await createTestBuyers(2)) as [TestBuyer, TestBuyer];
});
afterAll(async () => {
  for (const { client, channel } of open) await client.removeChannel(channel);
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
};

describe('rendimiento acotado del visor', () => {
  it('propagación p95 < 1 s con 3 clientes y tamaño del snapshot', async () => {
    const live = await createLiveSession(seller, { items: 40, autoConfirm: false });
    const code = (
      await seller.client.from('claim_sessions').select('code').eq('id', live.sessionId).single()
    ).data!.code;

    // Un feed realista: unas decenas de eventos antes de medir.
    await Promise.all(
      live.itemIds
        .slice(20, 30)
        .map((id) => rpc(prefiller.client, 'claim_item', { p_item_id: id })),
    );

    const snapshot = await snapshotService.getSnapshot(code);
    const snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot));
    console.log(
      `[S6-13] snapshot: ${snapshot!.items.length} artículos, ${snapshot!.feed.length} eventos, ${snapshotBytes} bytes`,
    );
    expect(snapshotBytes).toBeLessThan(150_000);

    const arrivals: Map<string, number>[] = Array.from({ length: CLIENTS }, () => new Map());
    for (let c = 0; c < CLIENTS; c++) {
      const client = anonClient();
      const channel = client
        .channel(`perf-${live.sessionId}-${c}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'claim_items',
            filter: `session_id=eq.${live.sessionId}`,
          },
          (payload) => {
            const row = payload.new as { id: string; leader_entry_id: string | null };
            if (row.leader_entry_id && !arrivals[c]!.has(row.id))
              arrivals[c]!.set(row.id, Date.now());
          },
        );
      open.push({ client, channel });
      await new Promise<void>((resolve, reject) =>
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve();
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
        }),
      );
    }
    await wait(2_000);

    // Acciones espaciadas (no ráfaga): cada una se mide por separado.
    const sentAt = new Map<string, number>();
    for (const id of live.itemIds.slice(0, ACTIONS)) {
      const result = await rpc(buyer.client, 'claim_item', { p_item_id: id });
      sentAt.set(id, Date.now());
      expect(result.ok).toBe(true);
      await wait(250);
    }
    await wait(3_000);

    const latencies: number[] = [];
    for (const received of arrivals) {
      for (const [id, sent] of sentAt) {
        const at = received.get(id);
        expect(at, `un cliente no recibió el cambio de ${id}`).toBeDefined();
        latencies.push(Math.max(0, at! - sent));
      }
    }
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    console.log(
      `[S6-13] propagación (${latencies.length} muestras): p50=${p50} ms, p95=${p95} ms, max=${Math.max(...latencies)} ms`,
    );
    expect(p95).toBeLessThan(1_000);
  }, 180_000);
});
