import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
  getUser: vi.fn(),
  getSeller: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/features/auth/services/auth.service', () => ({
  authService: {
    requireUser: async () => ({ user: { id: 'u1' }, profile: {} }),
    getUser: mocks.getUser,
  },
}));
vi.mock('@/features/auth/services/profile.service', () => ({
  profileService: { getSeller: mocks.getSeller },
}));
vi.mock('@/features/auth/services/auth.actions', () => ({ signOutAction: vi.fn() }));

describe('AppEntry (/app)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('con tienda va a /dashboard', async () => {
    mocks.getSeller.mockResolvedValue({ slug: 'x' });
    const { AppEntry } = await import('@/features/auth/components/AppEntry');
    await expect(AppEntry()).rejects.toThrow('REDIRECT:/dashboard');
  });

  it('sin tienda va a Mis cuentas (/orders)', async () => {
    mocks.getSeller.mockResolvedValue(null);
    const { AppEntry } = await import('@/features/auth/components/AppEntry');
    await expect(AppEntry()).rejects.toThrow('REDIRECT:/orders');
  });
});

describe('SessionMenu (header público)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('visitante: Iniciar sesión y Crear cuenta', async () => {
    mocks.getUser.mockResolvedValue(null);
    const { SessionMenu } = await import('@/features/auth/components/SessionMenu');
    const { render, screen } = await import('@testing-library/react');
    render(await SessionMenu());
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ir a mi cuenta' })).not.toBeInTheDocument();
  });

  it('con sesión: «Ir a mi cuenta» en lugar de Iniciar sesión (sin redirigir)', async () => {
    mocks.getUser.mockResolvedValue({ id: 'u1' });
    const { SessionMenu } = await import('@/features/auth/components/SessionMenu');
    const { render, screen } = await import('@testing-library/react');
    render(await SessionMenu());
    expect(screen.getByRole('link', { name: 'Ir a mi cuenta' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
