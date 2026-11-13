import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { LandingPage, landingMetadata } from '@/features/landing';
import { getSiteUrl } from '@/utils/site';

vi.mock('@/lib/env.public', () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.test' },
}));

describe('LandingPage', () => {
  it('renderiza las secciones con un único h1 y encabezados ordenados', () => {
    const { container } = render(<LandingPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const name of [
      'Una plaza para todo lo que coleccionas',
      'Cómo funciona',
      'Así se ve una sala en vivo',
      'Para vendedores',
      'Para compradores',
      'Compras gratis. Vendes desde $50 al mes.',
      'Preguntas frecuentes',
      'Que no se te pase el próximo claim',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(container.querySelector('#como-funciona')).not.toBeNull();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(8);
  });

  it('el CTA primario lleva a /signup y el secundario a los precios', () => {
    render(<LandingPage />);
    expect(screen.getByRole('link', { name: 'Quiero mi primer claim' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Soy vendedor' })).toHaveAttribute('href', '#precios');
  });

  it('muestra los dos planes con su precio y la promesa de cero comisión', () => {
    const { container } = render(<LandingPage />);
    const plans = container.querySelectorAll('#precios article');
    expect(plans).toHaveLength(2);
    expect(plans[0]).toHaveTextContent('Básico');
    expect(plans[0]).toHaveTextContent('$50');
    expect(plans[1]).toHaveTextContent('Pro');
    expect(plans[1]).toHaveTextContent('$100');
    expect(screen.getAllByText(/comisión/i).length).toBeGreaterThan(0);
    for (const cta of screen.getAllByRole('link', { name: 'Empezar gratis' })) {
      expect(cta).toHaveAttribute('href', '/signup');
    }
  });

  it('las ilustraciones decorativas no exponen imágenes sin texto alternativo', () => {
    const { container } = render(<LandingPage />);
    for (const img of container.querySelectorAll('img')) {
      expect(img.hasAttribute('alt')).toBe(true);
    }
  });

  it('el acordeón usa <details>/<summary> nativos (teclado cubierto en e2e)', () => {
    const { container } = render(<LandingPage />);
    const items = container.querySelectorAll('details');
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const item of items) {
      expect(item.querySelector(':scope > summary')).not.toBeNull();
      expect(item.open).toBe(false);
    }
  });

  it('incluye datos estructurados WebSite', () => {
    const { container } = render(<LandingPage />);
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? '{}');
    expect(data['@type']).toBe('WebSite');
    expect(data.name).toBe('Zlotify');
  });
});

describe('SEO', () => {
  it('metadata de la landing: título, descripción, canonical, OG y Twitter', () => {
    expect(landingMetadata.title).toEqual({ absolute: expect.stringContaining('Zlotify') });
    expect(landingMetadata.description).toBeTruthy();
    expect(landingMetadata.alternates?.canonical).toBe('/');
    expect(landingMetadata.openGraph).toMatchObject({ type: 'website', locale: 'es_MX' });
    expect(landingMetadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('robots y sitemap apuntan a la URL del sitio', () => {
    const site = getSiteUrl();
    expect(robots().sitemap).toBe(`${site}/sitemap.xml`);
    expect(sitemap()).toEqual([expect.objectContaining({ url: `${site}/` })]);
  });
});
