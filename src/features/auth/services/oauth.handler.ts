import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { planOAuthCallback } from '../utils/oauth';

/** Handler de GET /auth/callback: canjea el `code` (PKCE) y redirige a `next` validado o a /login con error. */
export async function handleOAuthCallback(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);

  const plan = planOAuthCallback({
    code: searchParams.get('code'),
    error: searchParams.get('error'),
    next: searchParams.get('next'),
  });
  if (plan.kind === 'failure') return NextResponse.redirect(new URL(plan.to, origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(plan.code);
  if (error) return NextResponse.redirect(new URL('/login?error=oauth_failed', origin));
  return NextResponse.redirect(new URL(plan.next, origin));
}
