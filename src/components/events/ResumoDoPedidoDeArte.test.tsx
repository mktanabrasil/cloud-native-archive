import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MarketingItem } from '@/types';

const espiao = vi.hoisted(() => ({ toasts: { success: vi.fn(), error: vi.fn() }, copiado: '' }));
vi.mock('sonner', () => ({ toast: espiao.toasts }));

const { ResumoDoPedidoDeArte } = await import('./ResumoDoPedidoDeArte');

const itens: MarketingItem[] = [
  { type: 'demanda_grafica', item: 'Cartaz', description: 'A3 colorido' },
  { type: 'arte_whatsapp', item: 'Arte para o WhatsApp', description: '', legenda: 'Vem comemorar!', conteudo: 'Título e data' },
  { type: 'cartaz_a4', item: 'Cartaz A4', description: '', legenda: 'Vem comemorar!', conteudo: 'Título e data', quantidade: 6 },
];

beforeEach(() => {
  espiao.copiado = '';
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { espiao.copiado = t; return Promise.resolve(); } }, configurable: true });
});

describe('ResumoDoPedidoDeArte', () => {
  it('pílulas do que foi pedido, legenda, o que vai na arte e o pedido antigo', () => {
    render(<ResumoDoPedidoDeArte itens={itens} />);
    const r = screen.getByTestId('resumo-do-pedido-de-arte');
    expect(r).toHaveTextContent('Arte para o WhatsApp');
    expect(r).toHaveTextContent('Cartaz A4 · 6');
    expect(r).toHaveTextContent('Legenda');
    expect(r).toHaveTextContent('Vem comemorar!');
    expect(r).toHaveTextContent('Na arte');
    expect(r).toHaveTextContent('Título e data');
    expect(r).toHaveTextContent('Arte (pedido antigo) · Cartaz');
    expect(r).toHaveTextContent('A3 colorido');
  });

  it('"Copiar legenda" leva a legenda para o WhatsApp', () => {
    render(<ResumoDoPedidoDeArte itens={itens} />);
    fireEvent.click(screen.getByRole('button', { name: /copiar legenda/i }));
    expect(espiao.copiado).toBe('Vem comemorar!');
    expect(espiao.toasts.success).toHaveBeenCalledWith('Legenda copiada', expect.anything());
  });

  it('compacto (painel) não tem botão; sem arte, não renderiza nada', () => {
    const { container } = render(<ResumoDoPedidoDeArte itens={itens} compacto />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
    const vazio = render(<ResumoDoPedidoDeArte itens={[{ type: 'cobertura', item: 'Cobertura', description: '' }]} />);
    expect(vazio.container).toBeEmptyDOMElement();
  });
});
