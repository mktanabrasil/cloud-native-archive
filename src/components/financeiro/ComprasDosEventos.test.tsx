import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EventoDoFinanceiro } from '@/lib/financeiro/compras';

/** Administração › Financeiro: compras e cotações dos eventos (19/11/2026). */
const espiao = vi.hoisted(() => ({ eventos: [] as EventoDoFinanceiro[], meses: [] as string[], marcas: [] as unknown[], semBanco: false }));
vi.mock('@/lib/financeiro/comprasApi', () => ({
  lerComprasDoMes: vi.fn(async (mes: string) => { espiao.meses.push(mes); if (espiao.semBanco) throw Object.assign(new Error('semBanco'), { semBanco: true }); return espiao.eventos; }),
  marcarItem: vi.fn(async (p: unknown) => { espiao.marcas.push(p); }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { ComprasDosEventos } = await import('./ComprasDosEventos');
const ev = (o: Partial<EventoDoFinanceiro>): EventoDoFinanceiro => ({
  id: 'e', title: 'Evento', unit: 'DIC', location: null, start_datetime: '2026-12-08T11:00:00Z', end_datetime: null, status: 'confirmado',
  food_items: [], transport_passengers: null, transport_external_support: false, transport_extra_equipment: false,
  transport_vehicle: null, transport_support_vehicle: null, itens: [], ...o,
});
const abrir = (vista: 'eventos' | 'lista') => render(<MemoryRouter initialEntries={['/administracao/financeiro?mes=2026-12']}><ComprasDosEventos vista={vista} /></MemoryRouter>);

beforeEach(() => {
  espiao.meses = []; espiao.marcas = []; espiao.semBanco = false;
  espiao.eventos = [
    ev({ id: 'n', title: 'Natal Feliz', food_items: [{ item: 'Almoço', alimentos: [{ nome: 'Marmitex', quantidade: '450', fornecedor: 'ANA' }] }], transport_external_support: true, transport_passengers: 120 }),
    ev({ id: 'p', title: 'Espetáculo', status: 'pendente', start_datetime: '2026-12-13T22:00:00Z', food_items: [{ item: 'Café', alimentos: [{ nome: 'Pão de queijo', quantidade: '40', fornecedor: 'ANA' }] }] }),
  ];
});

describe('Compras dos eventos', () => {
  it('cada evento com a comida da ANA e o transporte de fora; o pendente leva o selo', async () => {
    abrir('eventos');
    const lista = await screen.findByRole('list', { name: 'Eventos com compras' });
    expect(espiao.meses).toEqual(['2026-12']);
    expect(within(lista).getByRole('list', { name: 'Almoço de Natal Feliz' })).toHaveTextContent('Marmitex · 450');
    expect(within(lista).getByRole('list', { name: 'Transporte de fora de Natal Feliz' })).toHaveTextContent('120 passageiros');
    expect(within(lista).getByText('aguardando aprovação')).toBeInTheDocument();
    expect(screen.getByText('a cotar').previousSibling).toHaveTextContent('3');
  });

  it('marcar "Cotado" grava e abre valor e fornecedor; o valor é salvo ao sair do campo', async () => {
    abrir('eventos');
    const grupo = await screen.findByRole('group', { name: 'Situação de Marmitex' });
    fireEvent.click(within(grupo).getByRole('button', { name: 'Cotado' }));
    await waitFor(() => expect(espiao.marcas).toEqual([expect.objectContaining({ eventoId: 'n', chave: 'alimento:almoco:marmitex', situacao: 'cotado', assinatura: 'Marmitex|450' })]));
    const valor = await screen.findByLabelText('Valor de Marmitex');
    fireEvent.change(valor, { target: { value: '4.500,00' } });
    fireEvent.blur(valor);
    await waitFor(() => expect(espiao.marcas.at(-1)).toEqual(expect.objectContaining({ situacao: 'cotado', valor: 4500 })));
  });

  it('trocar a situação leva o valor digitado; mexer no valor de um pedido que mudou mantém o aviso', async () => {
    espiao.eventos = [ev({ id: 'n', title: 'Natal Feliz',
      food_items: [{ item: 'Almoço', alimentos: [{ nome: 'Marmitex', quantidade: '500', fornecedor: 'ANA' }, { nome: 'Suco', quantidade: '10', fornecedor: 'ANA' }] }],
      itens: [
        { chave: 'alimento:almoco:marmitex', situacao: 'cotado', valor: 4500, fornecedor: 'X', assinatura: 'Marmitex|450', atualizado_em: null, atualizado_por_nome: null },
        { chave: 'alimento:almoco:suco', situacao: 'cotado', valor: null, fornecedor: null, assinatura: 'Suco|10', atualizado_em: null, atualizado_por_nome: null },
        { chave: 'alimento:almoco:bolo', situacao: 'comprado', valor: 90, fornecedor: null, assinatura: 'Bolo|5', atualizado_em: null, atualizado_por_nome: null },
      ] })];
    abrir('eventos');
    expect((await screen.findByText(/Saiu do pedido ou mudou de nome/)).closest('p')).toHaveTextContent('Bolo (Comprado');
    const valor = screen.getByLabelText('Valor de Marmitex');
    fireEvent.change(valor, { target: { value: '5.000' } });
    fireEvent.blur(valor);
    await waitFor(() => expect(espiao.marcas.at(-1)).toEqual(expect.objectContaining({ valor: 5000, assinatura: 'Marmitex|450' })));
    expect(screen.getByText(/O pedido mudou/)).toBeInTheDocument();
    const suco = screen.getByLabelText('Valor de Suco');
    fireEvent.change(suco, { target: { value: '80' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Situação de Suco' })).getByRole('button', { name: 'Comprado' }));
    await waitFor(() => expect(espiao.marcas.at(-1)).toEqual(expect.objectContaining({ chave: 'alimento:almoco:suco', situacao: 'comprado', valor: 80 })));
  });

  it('o filtro de tipo mostra só o transporte', async () => {
    abrir('eventos');
    await screen.findByRole('list', { name: 'Eventos com compras' });
    fireEvent.click(screen.getByRole('button', { name: 'Transporte' }));
    expect(screen.queryByText(/Marmitex/)).toBeNull();
    expect(screen.getByText(/120 passageiros/)).toBeInTheDocument();
  });

  it('a lista do mês, com copiar para a planilha', async () => {
    abrir('lista');
    const tabela = await screen.findByRole('table');
    expect(within(tabela).getAllByRole('row').slice(1).map(l => l.querySelector('b')?.textContent)).toEqual(['Marmitex', 'Pão de queijo', 'Ônibus ou van fretados']);
    expect(screen.getByRole('button', { name: /Copiar o mês/ })).toBeInTheDocument();
  });

  it('sem o SQL, avisa em vez de quebrar', async () => {
    espiao.semBanco = true;
    abrir('eventos');
    expect(await screen.findByText(/ainda depende de uma atualização do banco/)).toBeInTheDocument();
  });
});
