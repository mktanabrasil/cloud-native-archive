import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const espiao = vi.hoisted(() => ({ toasts: { success: vi.fn(), error: vi.fn() }, copiado: '' }));
vi.mock('sonner', () => ({ toast: espiao.toasts }));

const { ResumoDeItens } = await import('./ResumoDeItens');

beforeEach(() => {
  espiao.copiado = '';
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { espiao.copiado = t; return Promise.resolve(); } }, configurable: true });
});

describe('ResumoDeItens', () => {
  it('um item por linha, detalhe ao lado; sem detalhe, diz que falta', () => {
    render(<ResumoDeItens titulo="Alimentação" itens={[{ item: 'Almoço', detalhes: '60 crianças, 12h' }, { item: 'Lanche', detalhes: '' }]} />);

    expect(screen.getByText('Alimentação · 2 itens')).toBeInTheDocument();
    expect(screen.getByText('Almoço')).toBeInTheDocument();
    expect(screen.getByText('60 crianças, 12h')).toBeInTheDocument();
    expect(screen.getByText('— sem detalhes ainda')).toBeInTheDocument();
  });

  it('“Nenhum” vira “nenhum” no título e nenhuma linha', () => {
    render(<ResumoDeItens titulo="Equipamentos" itens={[{ item: 'Nenhum', detalhes: '' }]} />);
    expect(screen.getByText('Equipamentos · nenhum')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('“Copiar lista” cola um item por linha', () => {
    render(<ResumoDeItens titulo="Alimentação" copiar itens={[{ item: 'Almoço', detalhes: '60 crianças' }, { item: 'Café', detalhes: '', outro: true }]} />);

    fireEvent.click(screen.getByRole('button', { name: /copiar lista/i }));

    expect(espiao.copiado).toBe('Alimentação:\n• Almoço — 60 crianças\n• Café');
    expect(espiao.toasts.success).toHaveBeenCalledWith('Lista copiada', expect.anything());
  });
});

describe('alimentação por refeição (22/09/2026)', () => {
  const almoco = {
    item: 'Almoço',
    detalhes: '',
    alimentos: [
      { nome: 'Arroz e feijão', quantidade: '120 porções', fornecedor: 'ANA' as const },
      { nome: 'Frango assado', quantidade: '25 kg', fornecedor: 'Parceiro' as const, quem: 'Padaria Sol' },
    ],
    cardapio: 'Arroz, feijão e frango. 12h30.',
  };

  it('uma tabela por refeição, com providenciar e quem fornece, e o cardápio embaixo', () => {
    render(<ResumoDeItens titulo="Alimentação" itens={[almoco]} />);

    const refeicao = screen.getByTestId('refeicao-Almoço');
    expect(refeicao).toHaveTextContent('Arroz e feijão');
    expect(refeicao).toHaveTextContent('120 porções');
    expect(refeicao).toHaveTextContent('Parceiro · Padaria Sol');
    expect(refeicao).toHaveTextContent('Cardápio: Arroz, feijão e frango. 12h30.');
    expect(refeicao.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('"Para providenciar" no topo lista só o que é da ANA', () => {
    render(<ResumoDeItens titulo="Alimentação" itens={[almoco]} />);
    expect(screen.getByTestId('para-providenciar')).toHaveTextContent('Para providenciar: 1 item · Arroz e feijão (120 porções)');
  });

  it('refeição antiga, só com texto, fica na linha de sempre ao lado da nova', () => {
    render(<ResumoDeItens titulo="Alimentação" itens={[almoco, { item: 'Jantar', detalhes: 'pizza pra 30' }]} />);
    expect(screen.getByText('Alimentação · 2 itens')).toBeInTheDocument();
    expect(screen.getByText('pizza pra 30')).toBeInTheDocument();
  });

  it('a observação antiga de uma refeição que ganhou tabela continua visível', () => {
    render(<ResumoDeItens titulo="Alimentação" itens={[{ ...almoco, detalhes: '60 crianças' }]} />);
    expect(screen.getByTestId('refeicao-Almoço')).toHaveTextContent('Observação antiga: 60 crianças');
  });
});
