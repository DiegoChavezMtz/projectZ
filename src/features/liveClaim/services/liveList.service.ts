import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { createStatelessClient } from '@/lib/supabase/stateless';
import type { LiveListEntry } from '../types';
import { queryLiveList } from './liveQueries';

/**
 * Claims en vivo para `/live`. Es una lista pública igual para todos: se cachea ≤ 30 s con un cliente
 * anónimo sin cookies (la sesión de quien mira no cambia el resultado).
 */
export async function listLiveClaims(): Promise<LiveListEntry[]> {
  'use cache';
  cacheLife({ stale: 15, revalidate: 30, expire: 300 });
  cacheTag('live-claims');
  return queryLiveList(createStatelessClient());
}

export const liveListService = { list: listLiveClaims };
