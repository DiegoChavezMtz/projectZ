import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OpenClaimsView } from '@/features/landing/components/OpenClaims';
import { queryOpenClaims } from '@/features/landing/services/openClaims.service';
import type { OpenClaim } from '@/features/landing/types';
import {
  MAX_OPEN_CLAIMS,
  MAX_SAMPLE_PHOTOS,
  buildOpenClaims,
} from '@/features/landing/utils/openClaims';

vi.mock('@/lib/env.public', () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.test' },
}));

const row = (n: number, patch: Record<string, unknown> = {}) => ({
  id: `s${n}`,
  code: `code${n}`,
  title: `Claim ${n}`,
  status: 'scheduled',
  starts_at: `2026-12-${String(10 + n).padStart(2, '0')}T20:00:00Z`,
  shop_name: `Espacio ${n}`,
  handle: `h${n}`,
  item_count: n,
  ...patch,
});

describe('buildOpenClaims', () => {
  it('solo live y scheduled, ordenados por hora de inicio (sin prioridades)', () => {
    const result = buildOpenClaims(
      [
        row(3),
        row(1, { status: 'live' }),
        row(2, { status: 'ended' }),
        row(4, { status: 'draft' }),
        row(5, { status: 'cancelled' }),
      ],
      [],
    );
    expect(result.map((c) => c.id)).toEqual(['s1', 's3']);
  });

  it('limita a MAX_OPEN_CLAIMS claims y a MAX_SAMPLE_PHOTOS fotos por claim, en orden de posición', () => {
    const claims = Array.from({ length: 10 }, (_, i) => row(i + 1));
    const photos = Array.from({ length: 7 }, (_, i) => ({
      session_id: 's1',
      image_path: `p${7 - i}.webp`,
      position: 7 - i,
    }));
    const result = buildOpenClaims(claims, [
      ...photos,
      { session_id: 's1', image_path: null, position: 0 },
    ]);
    expect(result).toHaveLength(MAX_OPEN_CLAIMS);
    expect(result[0]!.photos).toEqual(['p1.webp', 'p2.webp', 'p3.webp', 'p4.webp']);
    expect(result[0]!.photos).toHaveLength(MAX_SAMPLE_PHOTOS);
    expect(result[1]!.photos).toEqual([]);
  });

  it('no expone campos fuera del contrato público', () => {
    const [claim] = buildOpenClaims([row(1, { seller_id: 'x', description: 'secreto' })], []);
    expect(Object.keys(claim!).sort()).toEqual(
      [
        'code',
        'handle',
        'id',
        'itemCount',
        'photos',
        'shopName',
        'startsAt',
        'status',
        'title',
      ].sort(),
    );
  });
});

type Result = { data: unknown; error: unknown };
function fakeClient(views: Result, items: Result) {
  const chain = (result: Result) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'in', 'order', 'limit', 'not']) q[m] = () => q;
    q.then = (resolve: (r: Result) => unknown) => resolve(result);
    return q;
  };
  return {
    from: (table: string) => chain(table === 'public_open_claims' ? views : items),
  } as never;
}

describe('queryOpenClaims', () => {
  it('une claims y fotos', async () => {
    const result = await queryOpenClaims(
      fakeClient(
        { data: [row(1, { status: 'live' })], error: null },
        { data: [{ session_id: 's1', image_path: 'a.webp', position: 1 }], error: null },
      ),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 's1', status: 'live', photos: ['a.webp'] });
  });

  it('sin la vista aplicada (error) o sin filas devuelve []', async () => {
    expect(
      await queryOpenClaims(
        fakeClient({ data: null, error: { code: '42P01' } }, { data: [], error: null }),
      ),
    ).toEqual([]);
    expect(
      await queryOpenClaims(fakeClient({ data: [], error: null }, { data: [], error: null })),
    ).toEqual([]);
  });

  it('si fallan las fotos, igual muestra los claims', async () => {
    const result = await queryOpenClaims(
      fakeClient({ data: [row(1)], error: null }, { data: null, error: { message: 'x' } }),
    );
    expect(result[0]!.photos).toEqual([]);
  });
});

const claim = (n: number, patch: Partial<OpenClaim> = {}): OpenClaim => ({
  id: `s${n}`,
  code: `code${n}`,
  title: `Claim ${n}`,
  status: 'scheduled',
  startsAt: '2026-12-12T20:00:00Z',
  shopName: `Espacio ${n}`,
  handle: `h${n}`,
  itemCount: 3,
  photos: ['a.webp', 'b.webp'],
  ...patch,
});

describe('OpenClaimsView', () => {
  it('con 0 claims: estado vacío calmado y la muestra marcada como ejemplo', () => {
    render(<OpenClaimsView claims={[]} />);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Por ahora no hay claims abiertos ni próximos',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ejemplo')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Así se ve una sala en vivo' }),
    ).toBeInTheDocument();
  });

  it('con 1 claim: tarjeta con espacio, hora, piezas, muestra y enlaces a /u y /c', () => {
    render(<OpenClaimsView claims={[claim(1, { status: 'live', itemCount: 1 })]} />);
    const card = screen.getByRole('article', { name: 'Claim 1' });
    expect(within(card).getByText('Abierto ahora')).toBeInTheDocument();
    expect(within(card).getByText('1 pieza')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Espacio: Espacio 1' })).toHaveAttribute(
      'href',
      '/u/h1',
    );
    expect(within(card).getByRole('link', { name: 'Ver claim' })).toHaveAttribute(
      'href',
      '/c/code1',
    );
    expect(
      within(card).getByRole('list', { name: 'Piezas de muestra' }).querySelectorAll('li'),
    ).toHaveLength(2);
    expect(screen.queryByText('Ejemplo')).not.toBeInTheDocument();
  });

  it('con N claims: una tarjeta por claim, sin textos de urgencia ni «viendo»', () => {
    const { container } = render(
      <OpenClaimsView claims={[claim(1), claim(2, { handle: null, photos: [] }), claim(3)]} />,
    );
    expect(screen.getAllByRole('article')).toHaveLength(3);
    // Sin handle público no hay enlace al espacio, solo el nombre.
    expect(screen.getByText('Espacio: Espacio 2').closest('a')).toBeNull();
    expect(container.textContent).not.toMatch(/viendo|últim|quedan|corre|apúrate/i);
  });
});
