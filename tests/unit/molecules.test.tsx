import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '@/components/atoms/Input';
import { Dialog } from '@/components/molecules/Dialog';
import { FormField } from '@/components/molecules/FormField';
import { Panel } from '@/components/molecules/Panel';
import { ReputationBadge } from '@/components/molecules/ReputationBadge';
import { Skeleton } from '@/components/molecules/Skeleton';
import { ToastProvider, useToast } from '@/context/ToastContext';

describe('FormField', () => {
  it('enlaza label, hint y error con aria-describedby', () => {
    render(
      <FormField label="Correo" hint="Usa tu correo real" error="Correo inválido">
        {(control) => <Input {...control} />}
      </FormField>,
    );
    const input = screen.getByLabelText('Correo');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy.split(' ')).toHaveLength(2);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Correo inválido');
    for (const id of describedBy.split(' ')) expect(document.getElementById(id)).not.toBeNull();
  });

  it('sin hint ni error no define aria-describedby', () => {
    render(<FormField label="Nombre">{(control) => <Input {...control} />}</FormField>);
    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
  });
});

describe('Panel y Skeleton', () => {
  it('Panel renderiza como el elemento pedido y Skeleton se oculta a lectores', () => {
    const { container } = render(
      <Panel as="section" aria-label="info">
        <Skeleton />
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'info' })).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Confirmar">
        <button>Aceptar</button>
        <button>Cancelar</button>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('abre con role=dialog etiquetado y mueve el foco adentro', async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirmar' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('atrapa el foco con Tab y Shift+Tab', async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('Escape cierra y restaura el foco al disparador', async () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('el botón Cerrar cierra el diálogo', async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

function ToastHarness() {
  const toast = useToast();
  return <button onClick={() => toast.show('Guardado', 'success')}>Avisar</button>;
}

describe('Toast', () => {
  afterEach(() => vi.useRealTimers());

  it('anuncia en una región aria-live y se descarta', async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    const live = screen
      .getByRole('region', { name: 'Notificaciones' })
      .querySelector('[aria-live]');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toBeEmptyDOMElement();
    await userEvent.click(screen.getByRole('button', { name: 'Avisar' }));
    expect(live).toHaveTextContent('Guardado');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(live).toBeEmptyDOMElement();
  });

  it('se cierra solo tras unos segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Avisar' }));
    expect(screen.getByText('Guardado')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByText('Guardado')).not.toBeInTheDocument();
  });
});

describe('ReputationBadge', () => {
  const base = {
    handle: 'cartas',
    name: 'Cartas del Centro',
    winsCount: 12,
    memberSince: '2026-10-15T12:00:00Z',
    isSeller: true,
  };

  it('enlaza al perfil y muestra cifras del vendedor', () => {
    render(<ReputationBadge {...base} rating={{ average: 4.66, count: 3 }} />);
    const link = screen.getByRole('link', { name: 'Ver perfil de Cartas del Centro' });
    expect(link).toHaveAttribute('href', '/u/cartas');
    expect(link).toHaveTextContent('12 claims entregados');
    expect(link).toHaveTextContent('4.7');
    expect(link).toHaveTextContent('Desde octubre de 2026');
  });

  it('comprador muestra claims ganados y tasa de pago', () => {
    render(<ReputationBadge {...base} isSeller={false} winsCount={1} paidOnTimeRate={0.667} />);
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('1 claim ganado');
    expect(link).toHaveTextContent('67 % paga a tiempo');
  });

  it('sin tasa ni calificación no inventa cifras', () => {
    render(<ReputationBadge {...base} isSeller={false} paidOnTimeRate={null} rating={null} />);
    const link = screen.getByRole('link');
    expect(link).not.toHaveTextContent('paga a tiempo');
    expect(link).not.toHaveTextContent('★');
  });

  it('variante "Nuevo" sin historial', () => {
    render(<ReputationBadge {...base} winsCount={0} isNew />);
    expect(screen.getByRole('link')).toHaveTextContent('Nuevo');
    expect(screen.getByRole('link')).not.toHaveTextContent('claims');
  });

  it('variante compacta omite la antigüedad', () => {
    render(<ReputationBadge {...base} compact />);
    expect(screen.getByRole('link')).not.toHaveTextContent('Desde');
  });
});
