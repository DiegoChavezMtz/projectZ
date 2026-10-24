import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Container } from '@/components/atoms/Container';
import { Heading } from '@/components/atoms/Heading';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { Spinner } from '@/components/atoms/Spinner';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { VisuallyHidden } from '@/components/atoms/VisuallyHidden';

describe('Button', () => {
  it('es un <button type="button"> por defecto y dispara onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);
    const button = screen.getByRole('button', { name: 'Guardar' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('con href se renderiza como enlace (interno y ancla)', () => {
    render(
      <>
        <Button href="/signup">Crear cuenta</Button>
        <Button href="#como-funciona">Ver</Button>
      </>,
    );
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Ver' })).toHaveAttribute('href', '#como-funciona');
  });

  it('loading deshabilita, marca aria-busy y no dispara onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Enviar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled deshabilita y no es alcanzable con Tab', async () => {
    render(<Button disabled>Nada</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Nada' })).not.toHaveFocus();
  });

  it('es alcanzable con teclado y se activa con Enter', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ir</Button>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Ir' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Input, Textarea y Label', () => {
  it('Label asocia el control por htmlFor', () => {
    render(
      <>
        <Label htmlFor="correo">Correo</Label>
        <Input id="correo" />
      </>,
    );
    expect(screen.getByLabelText('Correo')).toBeInTheDocument();
  });

  it('invalid marca aria-invalid y disabled se respeta', () => {
    render(
      <>
        <Input aria-label="a" invalid />
        <Textarea aria-label="b" invalid disabled />
      </>,
    );
    expect(screen.getByLabelText('a')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('b')).toBeDisabled();
    expect(screen.getByLabelText('b')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Badge, Spinner, Icon, VisuallyHidden', () => {
  it('Badge muestra su texto', () => {
    render(<Badge tone="success">Disponible</Badge>);
    expect(screen.getByText('Disponible')).toBeInTheDocument();
  });

  it('Spinner se anuncia con role=status y texto; decorativo no', () => {
    const { rerender } = render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    rerender(<Spinner decorative />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Icon es decorativo salvo que tenga title', () => {
    const { container, rerender } = render(<Icon name="check" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Icon name="check" title="Listo" />);
    expect(screen.getByRole('img', { name: 'Listo' })).toBeInTheDocument();
  });

  it('VisuallyHidden mantiene el texto en el árbol de accesibilidad', () => {
    render(<VisuallyHidden>Solo lectores</VisuallyHidden>);
    expect(screen.getByText('Solo lectores')).toBeInTheDocument();
  });
});

describe('Heading, Text y Container', () => {
  it('Heading usa el nivel semántico indicado', () => {
    render(<Heading level={2}>Título</Heading>);
    expect(screen.getByRole('heading', { level: 2, name: 'Título' })).toBeInTheDocument();
  });

  it('Text renderiza el elemento pedido y Container el suyo', () => {
    render(
      <Container as="section" aria-label="zona">
        <Text as="span">hola</Text>
      </Container>,
    );
    expect(screen.getByRole('region', { name: 'zona' })).toBeInTheDocument();
    expect(screen.getByText('hola').tagName).toBe('SPAN');
  });
});
