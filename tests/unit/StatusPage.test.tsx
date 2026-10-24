import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatusPage, StatusPageAction } from '@/components/templates/StatusPage';

describe('StatusPage (componente)', () => {
  it('muestra título, descripción y enlace de acción accesibles', () => {
    render(
      <StatusPage code="404" title="No encontramos esta página" description="Enlace roto">
        <StatusPageAction label="Ir al inicio" href="/" />
      </StatusPage>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');
  });

  it('la acción de botón dispara onClick', async () => {
    const onClick = vi.fn();
    render(<StatusPageAction label="Reintentar" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
