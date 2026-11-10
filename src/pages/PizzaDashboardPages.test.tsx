import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const estado = vi.hoisted(() => ({
  pedidos: [] as Array<Record<string, unknown>>,
  pedidosCom: [] as Array<string | undefined>,
  erro: null as string | null,
  papel: { isMarketing: true, bondType: null as string | null, isActive: true, loading: false },
}));

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => estado.papel }));
vi.mock('@/lib/pizza/dashboard', async (original) => ({
  ...(await original<typeof import('@/lib/pizza/dashboard')>()),
  lerDashboard: async (codigo?: string) => {
    estado.pedidosCom.push(codigo);
    if (estado.erro) throw new Error(estado.erro);
    // O link da gestão não traz o número, como a função do banco.
    return { agora: '2026-11-20T15:00:00Z', pedidos: estado.pedidos.map((p) => (codigo ? { ...p, numero: undefined } : p)) };
  },
}));

const { PizzaAcompanharPage, PizzaDashboardPage } = await import('./PizzaDashboardPages');

const P = (o: Record<string, unknown>) => ({
  numero: 'PZ-AAAAA', nome: 'Maria Souza', unidade_id: 'ana-dic', unidade_nome: 'ANA DIC', area: 'social', sabores: { frango: 1 }, quantidade: 1, total: 55,
  forma: 'mercado_pago', mp_forma: 'bank_transfer', mp_bandeira: 'pix', retirada: false, retirada_em: null, created_at: '2026-11-10T16:13:00Z', ...o,
});

beforeEach(() => {
  estado.pedidos = [
    P({}),
    P({ numero: 'PZ-BBBBB', nome: 'João Lima', unidade_id: 'cei-x', unidade_nome: 'CEI X', area: 'educacao', sabores: { calabresa: 2 }, quantidade: 2, total: 110, forma: 'dinheiro', mp_forma: null, mp_bandeira: null, retirada: true, retirada_em: '2026-12-17T17:02:00Z', created_at: '2026-11-12T12:00:00Z' }),
  ];
  estado.pedidosCom = []; estado.erro = null;
  estado.papel = { isMarketing: true, bondType: null, isActive: true, loading: false };
});

const gestao = (codigo = 'abc123') => render(
  <MemoryRouter initialEntries={[`/pizza-da-alegria/acompanhar/${codigo}`]}>
    <Routes><Route path="/pizza-da-alegria/acompanhar/:codigo" element={<PizzaAcompanharPage />} /></Routes>
  </MemoryRouter>,
);

describe('dashboard da Pizza', () => {
  it('o link da gestão lê com o código e não mostra o número do pedido', async () => {
    gestao();
    expect(await screen.findAllByTestId('linha-pedido')).toHaveLength(2);
    expect(estado.pedidosCom).toEqual(['abc123']);
    expect(screen.getByText('Acompanhamento')).toBeInTheDocument();
    expect(screen.queryByText('PZ-AAAAA')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Nº' })).toBeNull();
    expect(screen.getByTestId('kpi-arrecadado')).toHaveTextContent('R$ 165');
    expect(screen.getByTestId('kpi-Retiradas')).toHaveTextContent('1 de 2');
    expect(within(screen.getByTestId('formas')).getByText('Pix')).toBeInTheDocument();
  });

  it('a equipe vê o número; os filtros mudam números e tabela juntos', async () => {
    render(<MemoryRouter><PizzaDashboardPage /></MemoryRouter>);
    expect(await screen.findByText('PZ-AAAAA')).toBeInTheDocument();
    expect(estado.pedidosCom).toEqual([undefined]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Área' }), { target: { value: 'educacao' } });
    expect(screen.getAllByTestId('linha-pedido')).toHaveLength(1);
    expect(screen.getByTestId('kpi-Pizzas')).toHaveTextContent('2');
    // Tocar numa unidade do ranking filtra por ela.
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    fireEvent.click(within(screen.getByTestId('ranking')).getByRole('button', { name: /ANA DIC/ }));
    expect(screen.getAllByTestId('linha-pedido')).toHaveLength(1);
    expect(screen.getByText('Maria Souza')).toBeInTheDocument();
  });

  it('a busca acha por nome', async () => {
    gestao();
    await screen.findAllByTestId('linha-pedido');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar pedido' }), { target: { value: 'joão' } });
    expect(screen.getAllByTestId('linha-pedido')).toHaveLength(1);
  });

  it('link com código trocado avisa; gestora sem acesso não entra', async () => {
    estado.erro = 'codigo_invalido';
    const { unmount } = gestao('velho');
    expect(await screen.findByText('Este link não vale mais')).toBeInTheDocument();
    unmount();
    estado.papel = { isMarketing: false, bondType: 'gestao_social', isActive: true, loading: false };
    render(<MemoryRouter><PizzaDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
  });
});
