import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CodeInput } from '@/components/molecules/CodeInput';

function Harness({ onComplete }: { onComplete?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return <CodeInput value={value} onChange={setValue} onComplete={onComplete} name="code" />;
}

const cells = () => screen.getAllByRole('textbox') as HTMLInputElement[];

describe('CodeInput', () => {
  it('tiene 6 casillas etiquetadas y un grupo accesible', () => {
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Código de verificación' })).toBeInTheDocument();
    expect(cells()).toHaveLength(6);
    expect(screen.getByLabelText('Dígito 3 de 6')).toBeInTheDocument();
  });

  it('autoavanza al escribir y llama onComplete al llenar', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Harness onComplete={onComplete} />);
    await user.click(cells()[0]!);
    await user.keyboard('123');
    expect(cells()[3]).toHaveFocus();
    await user.keyboard('456');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('123456');
  });

  it('ignora letras', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(cells()[0]!);
    await user.keyboard('a1b');
    expect(cells()[0]!.value).toBe('1');
    expect(cells()[1]!.value).toBe('');
  });

  it('pegar el código completo llena todo y completa', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<Harness onComplete={onComplete} />);
    await user.click(cells()[2]!);
    await user.paste('482 913');
    expect(
      cells()
        .map((c) => c.value)
        .join(''),
    ).toBe('482913');
    expect(onComplete).toHaveBeenCalledWith('482913');
  });

  it('retroceso borra y regresa el foco; las flechas mueven el foco', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(cells()[0]!);
    await user.keyboard('12');
    expect(cells()[2]).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(cells()[1]!.value).toBe('');
    expect(cells()[1]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(cells()[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(cells()[1]).toHaveFocus();
  });

  it('envía el valor en el campo oculto', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(cells()[0]!);
    await user.keyboard('12');
    expect(container.querySelector('input[type=hidden][name=code]')).toHaveValue('12');
  });
});
