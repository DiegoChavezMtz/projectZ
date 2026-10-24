import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Avatar } from '@/components/atoms/Avatar';
import { useDebounce } from '@/hooks/useDebounce';
import {
  avatarPathFor,
  avatarPublicUrl,
  checkAvatarInput,
  squareCrop,
} from '@/features/auth/utils/avatar';
import { profileSchema, sellerSchema } from '@/features/auth/utils/auth.schemas';
import { slugify } from '@/features/auth/utils/slug';

describe('avatar', () => {
  it('valida tipo y tamaño de lo que elige la persona', () => {
    expect(checkAvatarInput({ type: 'image/png', size: 1000 })).toBeNull();
    expect(checkAvatarInput({ type: 'image/webp', size: 1000 })).toBeNull();
    expect(checkAvatarInput({ type: 'image/gif', size: 1000 })).toBe('type');
    expect(checkAvatarInput({ type: 'application/pdf', size: 1000 })).toBe('type');
    expect(checkAvatarInput({ type: 'image/jpeg', size: 9 * 1024 * 1024 })).toBe('size');
  });

  it('recorta un cuadrado centrado', () => {
    expect(squareCrop(1000, 600)).toEqual({ sx: 200, sy: 0, side: 600 });
    expect(squareCrop(600, 1000)).toEqual({ sx: 0, sy: 200, side: 600 });
    expect(squareCrop(512, 512)).toEqual({ sx: 0, sy: 0, side: 512 });
  });

  it('arma la URL pública y la ruta por usuario', () => {
    expect(avatarPublicUrl('https://x.supabase.co/', 'u1/1.webp')).toBe(
      'https://x.supabase.co/storage/v1/object/public/avatars/u1/1.webp',
    );
    expect(avatarPublicUrl('https://x.supabase.co', null)).toBeNull();
    expect(avatarPathFor('u1', 123)).toBe('u1/123.webp');
  });
});

describe('Avatar', () => {
  it('con foto muestra la imagen con su texto alternativo', () => {
    render(<Avatar src="https://x/a.webp" name="Ana Pérez" />);
    expect(screen.getByRole('img', { name: 'Ana Pérez' })).toHaveAttribute(
      'src',
      'https://x/a.webp',
    );
  });

  it('sin foto muestra iniciales y el nombre accesible', () => {
    render(<Avatar name="Ana Pérez" />);
    expect(screen.getByText('AP')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  });
});

describe('slugify', () => {
  it('normaliza acentos, espacios y símbolos', () => {
    expect(slugify('Cartas de Ñandú & Co.')).toBe('cartas-de-nandu-co');
    expect(slugify('  --Hola   Mundo-- ')).toBe('hola-mundo');
    expect(slugify('x'.repeat(60))).toHaveLength(40);
    expect(slugify('***')).toBe('');
  });
});

describe('schemas de perfil y vendedor', () => {
  it('perfil: handle válido y no reservado', () => {
    expect(profileSchema.safeParse({ displayName: 'Ana', handle: 'ana_1' }).success).toBe(true);
    expect(profileSchema.safeParse({ displayName: 'Ana', handle: 'admin' }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: 'Ana', handle: 'Ana' }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: 'A', handle: 'ana_1' }).success).toBe(false);
  });

  it('vendedor: slug, reservados y opcionales vacíos a null', () => {
    const ok = sellerSchema.parse({
      shopName: 'Mi tienda',
      slug: 'mi-tienda',
      bio: '',
      city: ' Puebla ',
      paymentInstructions: '',
    });
    expect(ok).toMatchObject({ bio: null, city: 'Puebla', paymentInstructions: null });
    const bad = (patch: object) =>
      sellerSchema.safeParse({
        shopName: 'Mi tienda',
        slug: 'mi-tienda',
        bio: '',
        city: '',
        paymentInstructions: '',
        ...patch,
      }).success;
    expect(bad({ slug: 'dashboard' })).toBe(false);
    expect(bad({ slug: 'Mi Tienda' })).toBe(false);
    expect(bad({ slug: 'ab' })).toBe(false);
    expect(bad({ shopName: 'x' })).toBe(false);
    expect(bad({ bio: 'x'.repeat(281) })).toBe(false);
    expect(bad({ paymentInstructions: 'x'.repeat(501) })).toBe(false);
  });
});

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('solo publica el último valor tras el retraso', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'ab' });
    rerender({ value: 'abc' });
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('abc');
  });
});
