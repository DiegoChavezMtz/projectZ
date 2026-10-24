import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PageShell } from '@/components/templates/PageShell';
import { SiteFooter } from '@/components/templates/SiteFooter';
import { SiteHeader } from '@/components/templates/SiteHeader';

describe('SiteHeader', () => {
  it('muestra logo, navegación y acciones inyectadas', () => {
    render(<SiteHeader actions={<a href="/login">Entrar</a>} />);
    expect(screen.getByRole('link', { name: /Zlotify, ir al inicio/ })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getAllByRole('navigation', { name: 'Navegación principal' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Entrar' }).length).toBeGreaterThan(0);
  });

  it('el menú móvil usa aria-expanded, abre, cierra con Escape y devuelve el foco', async () => {
    render(<SiteHeader actions={<a href="/login">Entrar</a>} />);
    const toggle = screen.getByRole('button', { name: 'Abrir menú' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    const open = screen.getByRole('button', { name: 'Cerrar menú' });
    expect(open).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus();
  });

  it('el menú móvil se cierra al elegir un enlace', async () => {
    render(<SiteHeader actions={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    const control = screen.getByRole('button', { name: 'Cerrar menú' });
    const panel = document.getElementById(
      control.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    await userEvent.click(within(panel).getByRole('link', { name: 'Cómo funciona' }));
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument();
  });
});

describe('SiteFooter', () => {
  it('enlaza a términos y privacidad', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('link', { name: 'Términos y condiciones' })).toHaveAttribute(
      'href',
      '/terminos',
    );
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute(
      'href',
      '/privacidad',
    );
  });
});

describe('PageShell', () => {
  it('por defecto ofrece Iniciar sesión y Crear cuenta, contenido principal y skip link', () => {
    render(
      <PageShell>
        <p>Contenido</p>
      </PageShell>,
    );
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' })[0]).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getAllByRole('link', { name: 'Crear cuenta' })[0]).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('main')).toHaveTextContent('Contenido');
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      '#contenido',
    );
  });
});
