import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { Alimento } from '@/types';
import { TabelaDeAlimentos } from './TabelaDeAlimentos';

/** A tabelinha com estado de verdade, como no formulário. */
function Montada({ inicial }: { inicial: Alimento[] }) {
  const [alimentos, setAlimentos] = useState(inicial);
  const [cardapio, setCardapio] = useState('');
  return (
    <>
      <TabelaDeAlimentos id="comida-Almoço" refeicao="Almoço" alimentos={alimentos} onAlimentos={setAlimentos} cardapio={cardapio} onCardapio={setCardapio} />
      <output data-testid="estado">{JSON.stringify(alimentos)}</output>
    </>
  );
}

const estado = () => JSON.parse(screen.getByTestId('estado').textContent!) as Alimento[];

describe('TabelaDeAlimentos (varredura de 25/09/2026)', () => {
  it('Sim e Não: as setas trocam, e só o marcado entra na ordem do Tab', () => {
    render(<Montada inicial={[{ nome: 'Arroz', quantidade: '10', fornecedor: 'ANA' }]} />);
    const grupo = screen.getByRole('radiogroup', { name: /precisamos providenciar o alimento 1/i });
    const [sim, nao] = within(grupo).getAllByRole('radio');
    expect(sim).toHaveAttribute('tabindex', '0');
    expect(nao).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(grupo, { key: 'ArrowRight' });
    expect(estado()[0].fornecedor).toBe('Unidade');
    expect(within(grupo).getAllByRole('radio')[1]).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(grupo, { key: 'ArrowLeft' });
    expect(estado()[0].fornecedor).toBe('ANA');
  });

  it('o botão de remover tem nome e tira a linha certa', () => {
    render(<Montada inicial={[{ nome: 'Arroz', quantidade: '', fornecedor: 'ANA' }, { nome: 'Suco', quantidade: '', fornecedor: 'ANA' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover alimento 1 de Almoço' }));
    expect(estado().map(a => a.nome)).toEqual(['Suco']);
  });
});
