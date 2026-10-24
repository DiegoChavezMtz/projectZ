import { describe, expect, it } from 'vitest';
import { decideRoute } from '@/features/auth/utils/routeGuard';

describe('decideRoute', () => {
  it('protegidas sin sesión → /login?next=', () => {
    expect(decideRoute({ pathname: '/account', hasSession: false })).toEqual({
      action: 'redirect',
      to: '/login?next=%2Faccount',
    });
    expect(
      decideRoute({ pathname: '/dashboard/events', search: '?a=1', hasSession: false }),
    ).toEqual({
      action: 'redirect',
      to: '/login?next=%2Fdashboard%2Fevents%3Fa%3D1',
    });
  });
  it('protegidas con sesión pasan', () => {
    expect(decideRoute({ pathname: '/account/security', hasSession: true }).action).toBe('next');
  });
  it('/login y /signup con sesión → / o next seguro', () => {
    expect(decideRoute({ pathname: '/login', hasSession: true })).toEqual({
      action: 'redirect',
      to: '/',
    });
    expect(
      decideRoute({ pathname: '/signup', search: '?next=/account', hasSession: true }),
    ).toEqual({
      action: 'redirect',
      to: '/account',
    });
    expect(
      decideRoute({ pathname: '/login', search: '?next=//evil.com', hasSession: true }),
    ).toEqual({ action: 'redirect', to: '/' });
  });
  it('rutas públicas y prefijos parecidos pasan', () => {
    expect(decideRoute({ pathname: '/', hasSession: false }).action).toBe('next');
    expect(decideRoute({ pathname: '/login', hasSession: false }).action).toBe('next');
    expect(decideRoute({ pathname: '/verify-email', hasSession: false }).action).toBe('next');
    expect(decideRoute({ pathname: '/accountant', hasSession: false }).action).toBe('next');
  });
});
