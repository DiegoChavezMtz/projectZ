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
  it('/app (puerta de la app) exige sesión y conserva el destino', () => {
    expect(decideRoute({ pathname: '/app', hasSession: false })).toEqual({
      action: 'redirect',
      to: '/login?next=%2Fapp',
    });
    expect(decideRoute({ pathname: '/app', hasSession: true }).action).toBe('next');
    expect(decideRoute({ pathname: '/apple', hasSession: false }).action).toBe('next');
  });
  it('login con sesión respeta next válido y nunca manda a la landing', () => {
    expect(decideRoute({ pathname: '/login', search: '?next=/orders', hasSession: true })).toEqual({
      action: 'redirect',
      to: '/orders',
    });
  });
  it('protegidas con sesión pasan', () => {
    expect(decideRoute({ pathname: '/account/security', hasSession: true }).action).toBe('next');
  });
  it('/login y /signup con sesión → /app (destino por defecto) o next seguro', () => {
    expect(decideRoute({ pathname: '/login', hasSession: true })).toEqual({
      action: 'redirect',
      to: '/app',
    });
    expect(
      decideRoute({ pathname: '/signup', search: '?next=/account', hasSession: true }),
    ).toEqual({
      action: 'redirect',
      to: '/account',
    });
    expect(
      decideRoute({ pathname: '/login', search: '?next=//evil.com', hasSession: true }),
    ).toEqual({ action: 'redirect', to: '/app' });
  });
  it('rutas públicas y prefijos parecidos pasan', () => {
    expect(decideRoute({ pathname: '/', hasSession: false }).action).toBe('next');
    expect(decideRoute({ pathname: '/login', hasSession: false }).action).toBe('next');
    expect(decideRoute({ pathname: '/verify-email', hasSession: false }).action).toBe('next');
    expect(decideRoute({ pathname: '/accountant', hasSession: false }).action).toBe('next');
  });
});
