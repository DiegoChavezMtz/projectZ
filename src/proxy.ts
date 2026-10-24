import { NextResponse, type NextRequest } from 'next/server';
import { decideRoute } from '@/features/auth/utils/routeGuard';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  const { response, user, termsAccepted } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const decision = decideRoute({ pathname, search, hasSession: Boolean(user), termsAccepted });
  if (decision.action === 'next') return response;

  // Se conservan las cookies de sesión refrescadas en la redirección.
  const redirect = NextResponse.redirect(new URL(decision.to, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
