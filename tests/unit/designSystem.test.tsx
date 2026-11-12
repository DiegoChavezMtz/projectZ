import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PriceCapsule } from '@/components/atoms/PriceCapsule';
import { StatePill } from '@/components/atoms/StatePill';
import { MotionSwitch } from '@/components/molecules/MotionSwitch';
import { PieceFrame } from '@/components/molecules/PieceFrame';
import { PieceStack } from '@/components/molecules/PieceStack';
import { ScreenHeader } from '@/components/molecules/ScreenHeader';
import {
  MOTION_STORAGE_KEY,
  motionInitScript,
  readStoredMotion,
  resolveMotion,
  storeMotion,
} from '@/utils/motion';

describe('StatePill', () => {
  it.each(['available', 'claimed', 'offer', 'sold', 'mine'] as const)(
    'muestra siempre el texto del estado %s (nunca solo color)',
    (state) => {
      render(<StatePill state={state}>Etiqueta {state}</StatePill>);
      expect(screen.getByText(`Etiqueta ${state}`)).toHaveAttribute('data-state', state);
    },
  );
});

describe('PriceCapsule', () => {
  it('renderiza el precio recibido', () => {
    render(<PriceCapsule>$1,550.00</PriceCapsule>);
    expect(screen.getByText('$1,550.00')).toBeInTheDocument();
  });
});

describe('PieceFrame', () => {
  it('usa la proporción 63:88 por defecto y respeta la de la categoría', () => {
    const { container, rerender } = render(<PieceFrame src="/a.webp" alt="Pieza" />);
    expect((container.firstChild as HTMLElement).style.aspectRatio).toBe('var(--zl-ratio-card)');
    rerender(<PieceFrame src="/a.webp" alt="Pieza" aspect={{ width: 1, height: 1 }} />);
    expect((container.firstChild as HTMLElement).style.aspectRatio).toBe('1 / 1');
  });

  it('pinta el estado con texto sobre la foto y no en miniatura', () => {
    const { rerender } = render(
      <PieceFrame src="/a.webp" alt="Pieza" state={{ kind: 'claimed', label: 'Reclamada' }} />,
    );
    expect(screen.getByText('Reclamada')).toBeInTheDocument();
    rerender(
      <PieceFrame
        size="thumb"
        src="/a.webp"
        alt="Pieza"
        state={{ kind: 'claimed', label: 'Reclamada' }}
      />,
    );
    expect(screen.queryByText('Reclamada')).not.toBeInTheDocument();
  });

  it('sin foto muestra el texto de reemplazo', () => {
    render(<PieceFrame alt="Pieza" placeholder="Sin foto" />);
    expect(screen.getByText('Sin foto')).toBeInTheDocument();
  });
});

describe('PieceStack', () => {
  it('solo la pieza de enfrente tiene texto alternativo; las de fondo son decorativas', () => {
    const { container } = render(
      <PieceStack
        front={{ src: '/f.webp', alt: 'Flor Dorada' }}
        back={[{ src: '/b1.webp' }, { src: '/b2.webp' }]}
        caption={{ name: 'Flor Dorada', price: '$100.00' }}
        state={{ kind: 'mine', label: 'Tuya' }}
      />,
    );
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(3);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('Tuya')).toBeInTheDocument();
  });
});

describe('ScreenHeader', () => {
  it('renderiza el titular como h1 por defecto y como h2 si se pide', () => {
    const { rerender } = render(<ScreenHeader title="Tus piezas" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tus piezas' })).toBeInTheDocument();
    rerender(<ScreenHeader title="Tus piezas" titleAs="h2" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Tus piezas' })).toBeInTheDocument();
  });
});

describe('utils/motion', () => {
  it('resuelve: guardado > sistema > on', () => {
    expect(resolveMotion('on', true)).toBe('on');
    expect(resolveMotion('off', false)).toBe('off');
    expect(resolveMotion(null, true)).toBe('off');
    expect(resolveMotion(null, false)).toBe('on');
  });

  it('ignora valores guardados inválidos y errores de almacenamiento', () => {
    expect(readStoredMotion({ getItem: () => 'otro' })).toBeNull();
    expect(
      readStoredMotion({
        getItem: () => {
          throw new Error('bloqueado');
        },
      }),
    ).toBeNull();
    expect(() =>
      storeMotion(
        {
          setItem: () => {
            throw new Error('bloqueado');
          },
        },
        'off',
      ),
    ).not.toThrow();
  });

  it('el script previo al pintado usa la misma clave de almacenamiento', () => {
    expect(motionInitScript).toContain(MOTION_STORAGE_KEY);
  });
});

describe('MotionSwitch', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-motion');
  });
  afterEach(() => {
    document.documentElement.removeAttribute('data-motion');
  });

  it('alterna data-motion en <html>, lo recuerda y expone aria-checked', async () => {
    const user = userEvent.setup();
    render(<MotionSwitch />);
    const toggle = screen.getByRole('switch', { name: /Reducir movimiento/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement).toHaveAttribute('data-motion', 'on');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveAttribute('data-motion', 'off');
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe('off');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement).toHaveAttribute('data-motion', 'on');
  });

  it('respeta lo que el script previo dejó en <html>', () => {
    document.documentElement.setAttribute('data-motion', 'off');
    render(<MotionSwitch />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('UserMenu', () => {
  it('abre con el avatar, muestra datos y enlaces, y cierra con Escape devolviendo el foco', async () => {
    const { UserMenu } = await import('@/components/molecules/UserMenu');
    const user = userEvent.setup();
    render(
      <UserMenu
        name="Diego Chávez"
        email="diego@example.com"
        links={[{ label: 'Perfil', href: '/account' }]}
        signOut={<button type="button">Cerrar sesión</button>}
      />,
    );
    const button = screen.getByRole('button', { name: /Menú de usuario: Diego Chávez/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('diego@example.com')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveAttribute('href', '/account');
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });
});
