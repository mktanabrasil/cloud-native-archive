import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CalendarDays } from 'lucide-react';
import { CampoDataHora } from './CampoDataHora';

/**
 * O calendário nativo abre por `showPicker()`, não mais por CSS. O jsdom não
 * tem `showPicker`; aqui ele é simulado no protótipo para ver se é chamado.
 */
afterEach(() => {
  // limpa o que o teste pôs no protótipo (o jsdom não traz showPicker)
  delete (HTMLInputElement.prototype as Partial<HTMLInputElement>).showPicker;
});

const montar = () => {
  const onChange = vi.fn();
  render(<CampoDataHora value="" onChange={onChange} icone={CalendarDays} aria-label="Início" />);
  return { onChange, campo: screen.getByLabelText('Início') as HTMLInputElement };
};

describe('CampoDataHora', () => {
  it('clicar no campo abre o calendário nativo', () => {
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    const { campo } = montar();

    fireEvent.click(campo);

    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it('clicar no ícone também abre', () => {
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    montar();

    fireEvent.click(screen.getByRole('button', { name: /abrir calendário/i }));

    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it('sem showPicker no navegador, o clique não quebra e o campo fica em foco', () => {
    const { campo } = montar();

    expect(() => fireEvent.click(campo)).not.toThrow();
    campo.focus();
    expect(document.activeElement).toBe(campo);
  });

  it('se o navegador recusar (fora de gesto, por exemplo), cai para o foco', () => {
    HTMLInputElement.prototype.showPicker = () => { throw new DOMException('não permitido', 'NotAllowedError'); };
    const { campo } = montar();

    expect(() => fireEvent.click(campo)).not.toThrow();
    expect(document.activeElement).toBe(campo);
  });

  it('clique com Shift/Ctrl não abre: é seleção de texto', () => {
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    const { campo } = montar();

    fireEvent.click(campo, { shiftKey: true });
    fireEvent.click(campo, { ctrlKey: true });

    expect(showPicker).not.toHaveBeenCalled();
  });

  it('digitar continua mudando o valor', () => {
    const { onChange, campo } = montar();

    fireEvent.change(campo, { target: { value: '2026-10-10T14:00' } });

    expect(onChange).toHaveBeenCalledWith('2026-10-10T14:00');
  });
});
