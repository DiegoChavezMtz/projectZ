import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageShell } from '@/components/templates/PageShell';
import { AppShell } from '@/components/templates/AppShell';
import { APP_SECTIONS, isItemActive, sectionForPath } from '@/utils/appNav';

const state = vi.hoisted(() => ({ pathname: '/dashboard' }));
const mediaQuery = vi.hoisted(() => ({ matches: false }));
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));

describe('utils/appNav', () => {
  it.each([
    ['/dashboard', 'shop'],
    ['/dashboard/claims/abc/live', 'shop'],
    ['/onboarding/seller', 'shop'],
    ['/orders', 'accounts'],
    ['/orders/123', 'accounts'],
    ['/orders/history', 'accounts'],
    ['/account/security', 'accounts'],
  ])('%s pertenece a %s', (path, section) => {
    expect(sectionForPath(path)).toBe(section);
  });

  it('Resumen es activo solo en /dashboard; Claims también en sus subrutas', () => {
    const [summary, claims] = APP_SECTIONS[0]!.items;
    expect(isItemActive('/dashboard', summary!)).toBe(true);
    expect(isItemActive('/dashboard/claims', summary!)).toBe(false);
    expect(isItemActive('/dashboard/claims/x/edit', claims!)).toBe(true);
    expect(isItemActive('/dashboardx', claims!)).toBe(false);
  });

  it('Por pagar y enviar es exacto en /orders; Historial cubre /orders/history', () => {
    const [toPay, history] = APP_SECTIONS[1]!.items;
    expect(isItemActive('/orders', toPay!)).toBe(true);
    expect(isItemActive('/orders/history', toPay!)).toBe(false);
    expect(isItemActive('/orders/42', toPay!)).toBe(true);
    expect(isItemActive('/orders/history', history!)).toBe(true);
  });
  it('Mis cuentas ya no incluye Cuenta y seguridad (vive en el menú de usuario)', () => {
    const hrefs = APP_SECTIONS[1]!.items.map((item) => item.href);
    expect(hrefs).toEqual(['/orders', '/orders/history']);
  });
});

describe('AppShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    state.pathname = '/dashboard';
    mediaQuery.matches = false;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width') ? !mediaQuery.matches : mediaQuery.matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });

  const renderShell = () =>
    render(
      <AppShell userMenu={<button type="button">Usuario</button>}>
        <p>Contenido</p>
      </AppShell>,
    );

  it('barra superior con Mi tienda y Mis cuentas; marca la sección activa con aria-current', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Secciones de la app' });
    expect(within(nav).getByRole('link', { name: 'Mi tienda' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Mis cuentas' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('button', { name: 'Usuario' })).toBeInTheDocument();
    expect(screen.getAllByRole('switch', { name: /Reducir movimiento/ }).length).toBeGreaterThan(0);
    expect(screen.getByText('Contenido')).toBeInTheDocument();
  });

  it('el menú lateral cambia con la sección y marca el ítem actual', () => {
    renderShell();
    const side = screen.getByRole('complementary', { name: 'Menú lateral de Mi tienda' });
    const labels = within(side)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(labels).toEqual(['Resumen', 'Claims', 'Órdenes', 'Ajustes de la tienda']);
    expect(within(side).getByRole('link', { name: 'Resumen' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('en /orders el menú lateral es el de Mis cuentas', () => {
    state.pathname = '/orders/9';
    renderShell();
    const side = screen.getByRole('complementary', { name: 'Menú lateral de Mis cuentas' });
    expect(within(side).getByRole('link', { name: 'Por pagar y enviar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(side).getByRole('link', { name: 'Historial' })).toBeInTheDocument();
  });

  it('en escritorio el botón contrae a riel y recuerda la preferencia', async () => {
    mediaQuery.matches = true; // ≥ 1024 px
    const user = userEvent.setup();
    renderShell();
    const collapse = screen.getByRole('button', { name: 'Contraer el menú' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await user.click(collapse);
    expect(screen.getByRole('button', { name: 'Expandir el menú' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(window.localStorage.getItem('zl-smenu-rail')).toBe('1');
  });

  it('sin configurar: solo la configuración está activa; el resto lleva candado', () => {
    state.pathname = '/onboarding/seller';
    render(
      <AppShell shopLocked userMenu={<span />}>
        <p>Alta</p>
      </AppShell>,
    );
    const side = screen.getByRole('complementary', { name: 'Menú lateral de Mi tienda' });
    expect(within(side).getByRole('link', { name: 'Configurar mi espacio' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const claims = within(side).getByRole('link', { name: /Claims/ });
    expect(claims).toHaveAttribute('aria-disabled', 'true');
    expect(claims).toHaveTextContent('Disponible al configurar tu espacio');
  });

  it('móvil: el riel se expande con el botón, cierra con Escape y devuelve el foco', async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole('button', { name: 'Expandir el menú' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    const open = screen.getByRole('button', { name: 'Contraer el menú' });
    expect(open).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    const closed = screen.getByRole('button', { name: 'Expandir el menú' });
    expect(closed).toHaveAttribute('aria-expanded', 'false');
    expect(closed).toHaveFocus();
  });

  it('móvil: un toque fuera (el velo) cierra el panel', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    await user.click(screen.getByRole('button', { name: 'Expandir el menú' }));
    const scrim = container.querySelector('[aria-hidden="true"][class*="scrim"]') as HTMLElement;
    expect(scrim).not.toBeNull();
    await user.click(scrim);
    expect(screen.getByRole('button', { name: 'Expandir el menú' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

describe('zona pública', () => {
  it('PageShell no muestra menú lateral ni las secciones de la app', () => {
    render(
      <PageShell>
        <p>Landing</p>
      </PageShell>,
    );
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Secciones de la app' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mi tienda' })).not.toBeInTheDocument();
  });
});
