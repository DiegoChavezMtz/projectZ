import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

// Entidades compartidas del dominio de claims (docs/architecture.md). Se derivan de la BD, nunca a mano.
export type ClaimSession = Tables['claim_sessions']['Row'];
export type ClaimItem = Tables['claim_items']['Row'];

export type SessionFeedEvent = Tables['session_feed']['Row'];
export type FeedEventType = Enums['feed_event_type'];

export type SessionStatus = Enums['session_status'];
export type ReleaseMode = Enums['release_mode'];
export type ItemStatus = Enums['item_status'];

// Códigos de error del motor (docs/spec/claims.md). Todas las RPC devuelven {ok:true,...} o {ok:false, code, message}.
export const ENGINE_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'not_found',
  'session_not_live',
  'item_not_available',
  'own_session',
  'rate_limited',
  'already_in_queue',
  'invalid_amount',
  'invalid_state',
  'validation_failed',
] as const;
export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[number];
