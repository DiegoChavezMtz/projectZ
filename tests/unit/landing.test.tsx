import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { LandingPage, landingMetadata } from '@/features/landing';
import { getSiteUrl } from '@/utils/site';

describe('LandingPage', () => {
  it('renderiza las secciones con un único h1 y encabezados ordenados', () => {
    const { container } = render(<LandingPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    for (const name of [
      'Cómo funciona',
      'Para vendedores',
      'Para compradores',
      'Así se ve una sala en vivo',
      'Preguntas frecuentes',
      'Listo para tu primer claim',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(container.querySelector('#como-funciona')).not.toBeNull();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(8);
  });

  it('el CTA primario lleva a /signup y el secundario al ancla', () => {
    render(<LandingPage />);
    expect(screen.getAllByRole('link', { name: 'Crear cuenta' })[0]).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Ver cómo funciona' })).toHaveAttribute(
      'href',
      '#como-funciona',
    );
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
