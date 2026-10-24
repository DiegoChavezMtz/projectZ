import { handleOAuthCallback } from '@/features/auth';

// Solo OAuth (Google): canjea el `code` PKCE y redirige a `next` validado.
export function GET(request: Request) {
  return handleOAuthCallback(request);
}
