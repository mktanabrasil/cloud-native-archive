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
