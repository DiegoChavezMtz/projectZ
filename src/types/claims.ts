import type { Database } from './database.types';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

// Entidades compartidas del dominio de claims (docs/architecture.md). Se derivan de la BD, nunca a mano.
export type ClaimSession = Tables['claim_sessions']['Row'];
export type ClaimItem = Tables['claim_items']['Row'];

export type SessionStatus = Enums['session_status'];
export type ReleaseMode = Enums['release_mode'];
export type ItemStatus = Enums['item_status'];
