// Propósitos de código (enum `code_purpose` de la BD).
export type CodePurpose = 'verify_email' | 'login' | 'reset_password' | 'change_email';

/** Estado serializable que devuelven las Server Actions a `useActionState`. */
export type ActionState = {
  status: 'idle' | 'error' | 'success';
  /** Código estable de error (mapeable a texto de UI). */
  code?: string;
  /** Errores por campo. */
  fieldErrors?: Partial<Record<string, string>>;
  /** Segundos de espera (código `cooldown`). */
  retryAfter?: number;
};

export const initialActionState: ActionState = { status: 'idle' };

/** Fila de `email_codes` (hasta que `pnpm db:types` la tipe). */
export type EmailCodeRow = {
  id: string;
  email: string;
  purpose: CodePurpose;
  user_id: string | null;
  code_hash: string;
  payload: Record<string, unknown>;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  ip_hash: string | null;
  created_at: string;
};

export type CodeFailure = 'invalid' | 'expired' | 'exhausted' | 'incorrect';

export type VerifyCodeResult =
  | { ok: true; userId: string | null; payload: Record<string, unknown> }
  | { ok: false; reason: CodeFailure; attemptsLeft?: number };

/** Perfil propio (fila completa de `profiles`). */
export type Profile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_path: string | null;
  accepted_terms_at: string | null;
  created_at: string;
};

export type SignUpResult = { status: 'verification_sent' } | { status: 'email_exists' };
export type SignInResult = { status: 'signed_in' } | { status: 'unverified' };
